"""
Regras de cobrança usadas pela API, pelo comando mensal e (futuramente) pelo webhook.

"Vencida" não é gravado: o status salvo fica aberta/parcial e a situação é
calculada pela data de vencimento, para nunca depender de um job ter rodado.
"""
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from . import asaas
from .models import Cobranca, Competencia, PerfilCobranca, RecebimentoExterno

ABERTAS = (Competencia.Status.ABERTA, Competencia.Status.PARCIAL, Competencia.Status.VENCIDA)
COBRANCA_EM_ABERTO = (Cobranca.Status.PENDING, Cobranca.Status.OVERDUE)


def hoje():
    return timezone.localdate()


def q_vencidas(data=None):
    return Q(status__in=ABERTAS, data_vencimento__lt=data or hoje())


def situacao(competencia, data=None):
    if competencia.status in ABERTAS and competencia.data_vencimento < (data or hoje()):
        return 'vencida'
    return competencia.status


def valor_devido(competencia, data_pagamento):
    """Em dia (até o vencimento) vale o valor com desconto; depois, o cheio."""
    if competencia.valor_desconto is not None and data_pagamento <= competencia.data_vencimento:
        return competencia.valor_desconto
    return competencia.valor_cheio


def saldo(competencia, data_pagamento):
    return max(valor_devido(competencia, data_pagamento) - competencia.valor_pago, Decimal('0'))


def cobranca_atual(competencia):
    """Última cobrança do Asaas que ainda vale (não removida/estornada)."""
    validas = [c for c in competencia.cobrancas.all()
               if c.status not in (Cobranca.Status.DELETED, Cobranca.Status.REFUNDED)]
    return max(validas, key=lambda c: c.data_criacao, default=None)


def descricao(competencia):
    periodo = f'{competencia.mes:02d}/{competencia.ano}' if competencia.mes else str(competencia.ano)
    return f'Mensalidade AFSB {periodo} – {competencia.perfil.nome_pagador}'


# ---------- geração mensal ----------

def gerar_competencia(perfil, ano, mes):
    """Cria (se ainda não existir) a competência do perfil no período. Devolve (competencia, criada)."""
    anual = perfil.forma_pagamento == PerfilCobranca.FormaPagamento.CARTAO_PARCELADO
    filtro = {'perfil': perfil, 'ano': ano, 'mes': None if anual else mes}
    if existente := Competencia.objects.filter(**filtro).first():
        return existente, False

    dia = min(perfil.dia_vencimento, monthrange(ano, mes)[1])
    vencimento = date(ano, mes, dia)
    cheio, desconto = perfil.valores_vigentes(vencimento)
    return Competencia.objects.create(
        **filtro,
        periodicidade=Competencia.Periodicidade.ANUAL if anual else Competencia.Periodicidade.MENSAL,
        valor_cheio=cheio,
        valor_desconto=desconto,
        valor_personalizado=perfil.valor_personalizado_vigente(vencimento),
        data_vencimento=vencimento,
    ), True


# ---------- Asaas ----------

def _garantir_customer(perfil):
    if not perfil.asaas_customer_id:
        usuario = perfil.usuario
        perfil.asaas_customer_id = asaas.buscar_ou_criar_cliente(
            perfil.nome_pagador, perfil.documento, usuario.email, usuario.whatsapp
        )
        # Perfis do mesmo documento compartilham o customer.
        PerfilCobranca.objects.filter(documento=perfil.documento).update(
            asaas_customer_id=perfil.asaas_customer_id
        )
    return perfil.asaas_customer_id


# Sem atomic: cada passo no Asaas é gravado na hora; um rollback deixaria o
# banco dizendo que a cobrança antiga segue válida quando já foi removida lá.
def emitir_cobranca(competencia, tipo=Cobranca.TipoCobranca.BOLETO, vencimento=None):
    """
    (Re)gera a cobrança no Asaas para o saldo da competência. Remove antes as
    cobranças ainda em aberto, para o associado não ter dois boletos válidos.
    """
    if not settings.COBRANCA_EMISSAO_LIBERADA:
        raise asaas.AsaasErro(
            'Emissão de cobranças ainda não liberada (aguardando comunicado aos associados). '
            'Para liberar: COBRANCA_EMISSAO_LIBERADA=1.'
        )
    if competencia.status in (Competencia.Status.PAGA, Competencia.Status.CANCELADA):
        raise asaas.AsaasErro('Competência já paga ou cancelada.')

    for antiga in competencia.cobrancas.filter(status__in=COBRANCA_EM_ABERTO):
        asaas.remover_cobranca(antiga.asaas_payment_id)
        antiga.status = Cobranca.Status.DELETED
        antiga.save(update_fields=['status', 'data_atualizacao'])

    em_dia = competencia.data_vencimento >= hoje()
    vencimento = vencimento or (competencia.data_vencimento if em_dia else hoje() + timedelta(days=3))
    if vencimento < hoje():
        raise asaas.AsaasErro('O novo vencimento não pode ser no passado.')

    cheio = competencia.valor_cheio - competencia.valor_pago
    desconto = None
    if em_dia and competencia.valor_desconto is not None and vencimento <= competencia.data_vencimento:
        desconto = competencia.valor_cheio - competencia.valor_desconto
    if cheio <= 0:
        raise asaas.AsaasErro('Não há saldo a cobrar nesta competência.')

    # Texto exigido pela AFSB no boleto: só a data de vencimento daquele perfil.
    mensagem = competencia.perfil.mensagem_boleto
    pagamento = asaas.criar_cobranca(
        _garantir_customer(competencia.perfil), tipo, cheio, vencimento,
        mensagem, str(competencia.id), desconto,
    )
    competencia.perfil.save(update_fields=['asaas_customer_id', 'data_atualizacao'])
    return Cobranca.objects.create(
        competencia=competencia,
        asaas_payment_id=pagamento['id'],
        tipo_cobranca=tipo,
        status=pagamento.get('status', Cobranca.Status.PENDING),
        valor=cheio,
        valor_liquido=pagamento.get('netValue'),
        data_vencimento=vencimento,
        descricao=mensagem,
        invoice_url=pagamento.get('invoiceUrl'),
        boleto_url=pagamento.get('bankSlipUrl'),
        pix_copia_cola=asaas.pix_copia_cola(pagamento['id']),
        payload=pagamento,
    )


# ---------- recebimento manual ----------

@transaction.atomic
def registrar_recebimento(competencia, valor, data_pagamento, forma, comprovante, usuario, observacao=None):
    """
    PIX/transferência feito fora do Asaas. Quitando a competência, baixa no Asaas
    (receiveInCash) as cobranças em aberto para o associado não pagar de novo.
    Pagamento parcial não mexe no Asaas: a cobrança lá continua com o valor cheio.
    """
    if competencia.status in (Competencia.Status.PAGA, Competencia.Status.CANCELADA):
        raise asaas.AsaasErro('Competência já paga ou cancelada.')

    recebimento = RecebimentoExterno.objects.create(
        competencia=competencia, forma_pagamento=forma, valor=valor, data_pagamento=data_pagamento,
        comprovante=comprovante, registrado_por=usuario, observacao=observacao or None,
    )
    competencia.valor_pago += valor
    quitada = competencia.valor_pago >= valor_devido(competencia, data_pagamento)
    competencia.status = Competencia.Status.PAGA if quitada else Competencia.Status.PARCIAL
    competencia.data_pagamento = data_pagamento if quitada else None
    competencia.save(update_fields=['valor_pago', 'status', 'data_pagamento', 'data_atualizacao'])

    if quitada:
        for cobranca in competencia.cobrancas.filter(status__in=COBRANCA_EM_ABERTO):
            asaas.receber_em_dinheiro(cobranca.asaas_payment_id, data_pagamento, cobranca.valor)
            cobranca.status = Cobranca.Status.RECEIVED_IN_CASH
            cobranca.data_pagamento = data_pagamento
            cobranca.valor_pago = cobranca.valor
            cobranca.save(update_fields=['status', 'data_pagamento', 'valor_pago', 'data_atualizacao'])
            recebimento.cobranca = recebimento.cobranca or cobranca
        recebimento.save(update_fields=['cobranca'])
    return recebimento

from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.usuario.models import Usuario
from apps.usuario.ver_como import usuario_alvo, vendo_como
from apps.utils.custom_permissions import AssociadoAtivo

from . import asaas, servicos
from .models import Cobranca, Competencia, PerfilCobranca, TabelaValor
from .serializers import (
    CompetenciaSerializer,
    PerfilCobrancaSerializer,
    ReceberSerializer,
    ReemitirSerializer,
    SalvarTabelaSerializer,
    TabelaValorSerializer,
)


def _erro(e):
    return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class TabelaValorViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Tabela padrão de valores. Mudança vale para as competências geradas depois; as já geradas mantêm o valor."""

    queryset = TabelaValor.objects.all()
    serializer_class = TabelaValorSerializer

    @action(detail=False, methods=['post'])
    def salvar(self, request):
        entrada = SalvarTabelaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        modalidade, linhas = entrada.validated_data['modalidade'], entrada.validated_data['linhas']

        atuais = TabelaValor.objects.filter(modalidade=modalidade)
        removidas = set(atuais.values_list('qtd_lojas', flat=True)) - {l['qtd_lojas'] for l in linhas}
        if removidas:
            # Perfil ativo sem linha na tabela não gera cobrança (gerar_competencias pula).
            parcelado = PerfilCobranca.FormaPagamento.CARTAO_PARCELADO
            perfis = PerfilCobranca.objects.filter(ativo=True, qtd_lojas__in=removidas)
            perfis = perfis.filter(forma_pagamento=parcelado) if modalidade == 'anual' else perfis.exclude(forma_pagamento=parcelado)
            if em_uso := sorted(set(perfis.values_list('qtd_lojas', flat=True))):
                faixas = ', '.join(f'{q} loja(s)' for q in em_uso)
                return _erro(f'Não dá para remover {faixas}: há perfis de cobrança ativos nessa faixa.')

        with transaction.atomic():
            atuais.filter(qtd_lojas__in=removidas).delete()
            for l in linhas:
                TabelaValor.objects.update_or_create(
                    modalidade=modalidade, qtd_lojas=l['qtd_lojas'],
                    defaults={'valor_cheio': l['valor_cheio'], 'valor_desconto': l['valor_desconto']},
                )
        return Response(TabelaValorSerializer(TabelaValor.objects.filter(modalidade=modalidade), many=True).data)


class PerfilCobrancaViewSet(viewsets.ModelViewSet):
    queryset = PerfilCobranca.objects.select_related('usuario').prefetch_related('franquias')
    serializer_class = PerfilCobrancaSerializer
    filter_backends = (filters.SearchFilter,)
    search_fields = ('nome_pagador', 'documento', 'usuario__first_name', 'usuario__last_name', '=usuario__nro_associado')

    def get_queryset(self):
        qs = super().get_queryset()
        if usuario := self.request.query_params.get('usuario'):
            qs = qs.filter(usuario=usuario)
        return qs


class CompetenciaViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Competências (o que cada perfil deve em cada período). Criação é automática
    (comando gerar_competencias); aqui o admin acompanha, reemite e dá baixa manual.
    """
    serializer_class = CompetenciaSerializer
    parser_classes = (JSONParser, MultiPartParser, FormParser)
    filter_backends = (filters.SearchFilter,)
    search_fields = (
        'perfil__nome_pagador', 'perfil__documento', 'perfil__usuario__first_name',
        'perfil__usuario__last_name', 'perfil__usuario__email', '=perfil__usuario__nro_associado',
    )

    def get_queryset(self):
        qs = (
            Competencia.objects.select_related('perfil__usuario')
            .prefetch_related('cobrancas', 'recebimentos_externos__registrado_por')
            .order_by('-data_vencimento', 'perfil__nome_pagador')
        )
        p = self.request.query_params
        if p.get('ano'):
            qs = qs.filter(data_vencimento__year=p['ano'])
        if p.get('mes'):
            qs = qs.filter(data_vencimento__month=p['mes'])
        if p.get('usuario'):
            qs = qs.filter(perfil__usuario=p['usuario'])
        match p.get('situacao'):
            case 'vencida':
                qs = qs.filter(servicos.q_vencidas())
            case 'aberta':
                qs = qs.filter(status__in=servicos.ABERTAS, data_vencimento__gte=servicos.hoje())
            case 'parcial' | 'paga' | 'cancelada' as s:
                qs = qs.filter(status=s)
        return qs

    @action(detail=True, methods=['post'])
    def reemitir(self, request, pk=None):
        competencia = self.get_object()
        dados = ReemitirSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        try:
            servicos.emitir_cobranca(
                competencia, dados.validated_data['tipo_cobranca'], dados.validated_data.get('data_vencimento')
            )
        except asaas.AsaasErro as e:
            return _erro(e)
        return Response(self.get_serializer(self.get_queryset().get(pk=competencia.pk)).data)

    @action(detail=True, methods=['post'])
    def receber(self, request, pk=None):
        competencia = self.get_object()
        dados = ReceberSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        d = dados.validated_data
        try:
            servicos.registrar_recebimento(
                competencia, d['valor'], d['data_pagamento'], d['forma_pagamento'],
                d['comprovante'], request.user, d.get('observacao'),
            )
        except asaas.AsaasErro as e:
            return _erro(e)
        return Response(self.get_serializer(self.get_queryset().get(pk=competencia.pk)).data)

    @action(detail=True, methods=['post'], url_path='enviar-email')
    def enviar_email(self, request, pk=None):
        competencia = self.get_object()
        cobranca = servicos.cobranca_atual(competencia)
        if not cobranca or not cobranca.invoice_url:
            return _erro('Gere a cobrança antes de enviar.')
        usuario = competencia.perfil.usuario
        send_mail(
            subject=f'AFSB – {servicos.descricao(competencia)}',
            message=(
                f'Olá, {usuario.first_name or usuario.email}!\n\n'
                f'Segue o link para pagamento da sua mensalidade AFSB '
                f'(vencimento {cobranca.data_vencimento:%d/%m/%Y}, R$ {cobranca.valor:.2f}):\n'
                f'{cobranca.invoice_url}\n\n'
                + (f'PIX copia e cola:\n{cobranca.pix_copia_cola}\n\n' if cobranca.pix_copia_cola else '')
                + f'{competencia.perfil.mensagem_boleto}\n\nAFSB'
            ),
            from_email=None,
            recipient_list=[usuario.email],
        )
        return Response({'detail': f'E-mail enviado para {usuario.email}.'})


class MinhasCompetenciasViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Extrato do associado logado: só as competências dos próprios perfis.
    `pagar` devolve uma cobrança válida no Asaas (reaproveita a aberta ou gera
    outra) para o associado pagar online na fatura do Asaas.
    """
    serializer_class = CompetenciaSerializer
    permission_classes = (AssociadoAtivo,)

    def get_queryset(self):
        return (
            Competencia.objects.filter(perfil__usuario=usuario_alvo(self.request))
            .exclude(status=Competencia.Status.CANCELADA)
            .select_related('perfil__usuario')
            .prefetch_related('cobrancas', 'recebimentos_externos__registrado_por')
            .order_by('-data_vencimento')
        )

    @action(detail=True, methods=['post'])
    def pagar(self, request, pk=None):
        if vendo_como(request):
            return Response({'detail': 'Visualização como associado é somente leitura.'}, status=status.HTTP_403_FORBIDDEN)
        competencia = self.get_object()
        if competencia.status == Competencia.Status.PAGA:
            return _erro('Esta mensalidade já está paga.')
        atual = servicos.cobranca_atual(competencia)
        valida = (
            atual
            and atual.invoice_url
            and atual.status == Cobranca.Status.PENDING
            and atual.data_vencimento >= servicos.hoje()
        )
        if not valida:
            if not asaas.configurado():
                return _erro('Pagamento online indisponível no momento. Fale com a AFSB pelo WhatsApp.')
            try:
                # "Cliente escolhe": na fatura do Asaas ele paga com PIX, boleto ou cartão.
                servicos.emitir_cobranca(competencia, Cobranca.TipoCobranca.UNDEFINED)
            except asaas.AsaasErro as e:
                return _erro(e)
        return Response(self.get_serializer(self.get_queryset().get(pk=competencia.pk)).data)


def _meses_ate(ano, mes, n):
    """Os n meses terminando em (ano, mes), do mais antigo ao mais recente."""
    meses = []
    for _ in range(n):
        meses.append((ano, mes))
        ano, mes = (ano, mes - 1) if mes > 1 else (ano - 1, 12)
    return meses[::-1]


class DashboardView(APIView):
    """Resumo financeiro do mês (pelo vencimento) + inadimplência acumulada."""

    def get(self, request):
        hoje = servicos.hoje()
        ano = int(request.query_params.get('ano', hoje.year))
        mes = int(request.query_params.get('mes', hoje.month))
        meses = _meses_ate(ano, mes, 12)
        inicio = date(*meses[0], 1)

        competencias = list(
            Competencia.objects.select_related('perfil__usuario')
            .prefetch_related('cobrancas', 'recebimentos_externos')
            .exclude(status=Competencia.Status.CANCELADA)
            .filter(Q(data_vencimento__gte=inicio) | servicos.q_vencidas(hoje) | Q(data_pagamento__isnull=False))
        )

        def esperado(c):
            return c.valor_desconto if c.valor_desconto is not None else c.valor_cheio

        serie = {m: {'previsto': Decimal(0), 'recebido': Decimal(0)} for m in meses}
        do_mes = []
        atrasados = defaultdict(lambda: {'qtd': 0, 'total': Decimal(0), 'desde': None})
        for c in competencias:
            chave = (c.data_vencimento.year, c.data_vencimento.month)
            if chave in serie:
                serie[chave]['previsto'] += esperado(c)
                serie[chave]['recebido'] += c.valor_pago
            if chave == (ano, mes):
                do_mes.append(c)
            if servicos.situacao(c, hoje) == 'vencida':
                a = atrasados[c.perfil.usuario]
                a['qtd'] += 1
                a['total'] += c.valor_cheio - c.valor_pago
                a['desde'] = min(filter(None, [a['desde'], c.data_vencimento]))

        previsto = sum((esperado(c) for c in do_mes), Decimal(0))
        recebido = sum((c.valor_pago for c in do_mes), Decimal(0))
        a_vencer = sum((servicos.saldo(c, hoje) for c in do_mes if servicos.situacao(c, hoje) in ('aberta', 'parcial')), Decimal(0))
        vencido_mes = sum((c.valor_cheio - c.valor_pago for c in do_mes if servicos.situacao(c, hoje) == 'vencida'), Decimal(0))

        pagas = sorted((c for c in competencias if c.data_pagamento), key=lambda c: c.data_pagamento, reverse=True)[:8]
        ativos = Usuario.objects.filter(status=Usuario.Status.ATIVO, perfis_cobranca__ativo=True).distinct().count()

        return Response({
            'referencia': {'ano': ano, 'mes': mes},
            'asaas_configurado': asaas.configurado(),
            'kpis': {
                'previsto': previsto,
                'recebido': recebido,
                'a_vencer': a_vencer,
                'vencido_mes': vencido_mes,
                'vencido_total': sum((a['total'] for a in atrasados.values()), Decimal(0)),
                'inadimplentes': len(atrasados),
                'associados_cobrados': ativos,
                'competencias_mes': len(do_mes),
                'pagas_mes': sum(1 for c in do_mes if c.status == Competencia.Status.PAGA),
            },
            'serie': [{'ano': a, 'mes': m, **v} for (a, m), v in serie.items()],
            'atrasados': sorted(
                (
                    {
                        'id': str(u.id), 'nome': u.get_full_name() or u.email, 'nro': u.nro_associado,
                        'whatsapp': u.whatsapp, 'email': u.email, 'qtd': a['qtd'], 'total': a['total'],
                        'dias': (hoje - a['desde']).days,
                    }
                    for u, a in atrasados.items()
                ),
                key=lambda x: (-x['dias'], -x['total']),
            ),
            'ultimos_pagamentos': [
                {
                    'id': str(c.id), 'nome': c.perfil.usuario.get_full_name() or c.perfil.nome_pagador,
                    'periodo': f'{c.mes:02d}/{c.ano}' if c.mes else str(c.ano),
                    'valor': c.valor_pago, 'data': c.data_pagamento,
                    'origem': 'Manual' if c.recebimentos_externos.all() else 'Asaas',
                }
                for c in pagas
            ],
        })

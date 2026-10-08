"""
Geração mensal: cria a competência de cada perfil ativo e, para PIX/boleto,
emite a cobrança no Asaas. Idempotente (pode rodar de novo no mesmo mês).
Cartão recorrente é cobrado pela assinatura do Asaas; parcelado gera uma
competência anual.

Uso (agendar todo dia 1º): python manage.py gerar_competencias [--ano 2026 --mes 11] [--sem-asaas]
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.cobranca import asaas, servicos
from apps.cobranca.models import PerfilCobranca, TabelaValor


class Command(BaseCommand):
    help = 'Gera as competências do mês para os perfis de cobrança ativos.'

    def add_arguments(self, parser):
        hoje = servicos.hoje()
        parser.add_argument('--ano', type=int, default=hoje.year)
        parser.add_argument('--mes', type=int, default=hoje.month)
        parser.add_argument('--sem-asaas', action='store_true', help='Só cria as competências.')

    def handle(self, ano, mes, sem_asaas, **_):
        if not settings.COBRANCA_EMISSAO_LIBERADA:
            # Competência criada já aparece como débito na área do associado.
            raise CommandError('Cobrança ainda não liberada (COBRANCA_EMISSAO_LIBERADA=0).')
        criadas = emitidas = 0
        perfis = PerfilCobranca.objects.filter(ativo=True, usuario__status='ativo').select_related('usuario')
        for perfil in perfis:
            try:
                competencia, criada = servicos.gerar_competencia(perfil, ano, mes)
            except TabelaValor.DoesNotExist:
                self.stderr.write(f'Sem tabela de valor para {perfil} ({perfil.qtd_lojas} lojas).')
                continue
            criadas += criada
            emitir = (
                not sem_asaas
                and asaas.configurado()
                and perfil.forma_pagamento == PerfilCobranca.FormaPagamento.PIX_BOLETO
                and not competencia.cobrancas.exists()
            )
            if emitir:
                try:
                    servicos.emitir_cobranca(competencia)
                    emitidas += 1
                except asaas.AsaasErro as e:
                    self.stderr.write(f'{perfil}: {e}')
        self.stdout.write(self.style.SUCCESS(f'{criadas} competências criadas, {emitidas} cobranças emitidas.'))

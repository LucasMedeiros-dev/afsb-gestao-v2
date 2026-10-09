import tempfile
from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.cobranca import servicos
from apps.cobranca.models import Cobranca, Competencia, PerfilCobranca, TabelaValor
from apps.usuario.models import Usuario

ARMAZENAMENTO_LOCAL = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
        'OPTIONS': {'location': tempfile.mkdtemp()},
    },
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


def criar_usuario(email, cargo=Usuario.Cargos.FRANQUEADO, cpf='529.982.247-25', **extra):
    u = Usuario(username=email, email=email, cargo=cargo, cpf=cpf, whatsapp='+5511999998888',
                status=Usuario.Status.ATIVO, first_name=email.split('@')[0], **extra)
    u.set_password('senha-forte-123')
    u.save()
    return u


@override_settings(STORAGES=ARMAZENAMENTO_LOCAL, ASAAS_API_KEY='', COBRANCA_EMISSAO_LIBERADA=True)
class PainelAdminTests(TestCase):
    def setUp(self):
        self.admin = criar_usuario('admin@afsb.com.br', Usuario.Cargos.ADMIN, cpf='111.444.777-35')
        self.associado = criar_usuario('joao@loja.com', nro_associado=10)
        TabelaValor.objects.create(modalidade='mensal', qtd_lojas=1, valor_cheio=125, valor_desconto=100)
        self.perfil = PerfilCobranca.objects.create(
            usuario=self.associado, tipo_documento='cpf', documento='529.982.247-25',
            nome_pagador='João', forma_pagamento='pix_boleto', dia_vencimento=15, qtd_lojas=1,
        )
        self.api = APIClient()

    def logar(self, email):
        r = self.api.post('/usuario/login/', {'username': email, 'password': 'senha-forte-123'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.api.credentials(HTTP_AUTHORIZATION=f"Token {r.json()['token']}")
        return r.json()['usuario']

    def test_cargo_admin_vira_staff_e_login_informa(self):
        self.assertTrue(self.admin.is_staff)
        self.assertFalse(self.associado.is_staff)
        self.assertTrue(self.logar('admin@afsb.com.br')['admin'])

    def test_associado_e_anonimo_nao_acessam_painel(self):
        for rota in ('/usuario/', '/franquia/', '/cobranca/dashboard/', '/cobranca/competencias/'):
            self.assertIn(self.api.get(rota).status_code, (401, 403), rota)
        self.assertIn(self.api.get('/documento/').status_code, (401, 403))
        self.logar('joao@loja.com')
        self.assertEqual(self.api.get('/usuario/').status_code, 403)
        self.assertEqual(self.api.get('/documento/').status_code, 200)
        self.assertEqual(self.api.get('/franquia/por-estado/').status_code, 200)

    def test_crud_usuario(self):
        self.logar('admin@afsb.com.br')
        r = self.api.post('/usuario/', {
            'first_name': 'Maria', 'last_name': 'Silva', 'email': 'MARIA@x.com', 'cpf': '390.533.447-05',
            'whatsapp': '+5511988887777', 'cargo': 'franqueado', 'status': 'ativo',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        novo = Usuario.objects.get(email='maria@x.com')
        self.assertFalse(novo.has_usable_password())
        r = self.api.patch(f'/usuario/{novo.id}/', {'status': 'bloqueado'}, format='json')
        self.assertEqual(r.json()['status'], 'bloqueado')
        self.assertEqual(len(self.api.get('/usuario/?search=maria').json()), 1)

    def test_geracao_dashboard_e_recebimento_manual(self):
        venc = date.today() - timedelta(days=10)
        call_command('gerar_competencias', ano=venc.year, mes=venc.month, stdout=mock.MagicMock())
        comp = Competencia.objects.get()
        self.assertEqual(comp.valor_desconto, Decimal('100'))

        self.logar('admin@afsb.com.br')
        if comp.data_vencimento < date.today():
            d = self.api.get(f'/cobranca/dashboard/?ano={comp.ano}&mes={comp.mes}').json()
            self.assertEqual(d['kpis']['inadimplentes'], 1)
            self.assertEqual(d['atrasados'][0]['nro'], 10)
            self.assertEqual(len(self.api.get('/cobranca/competencias/?situacao=vencida').json()), 1)

        # Sem Asaas configurado a reemissão avisa em vez de quebrar.
        r = self.api.post(f'/cobranca/competencias/{comp.id}/reemitir/', {}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('ASAAS_API_KEY', r.json()['detail'])

        comprovante = SimpleUploadedFile('pix.pdf', b'%PDF-1.4', content_type='application/pdf')
        r = self.api.post(f'/cobranca/competencias/{comp.id}/receber/', {
            'valor': '125.00', 'data_pagamento': date.today().isoformat(), 'comprovante': comprovante,
        }, format='multipart')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()['situacao'], 'paga')
        self.assertEqual(len(r.json()['recebimentos']), 1)

    def test_recebimento_quitando_baixa_cobranca_no_asaas(self):
        comp, _ = servicos.gerar_competencia(self.perfil, 2026, 1)
        Cobranca.objects.create(competencia=comp, asaas_payment_id='pay_1', tipo_cobranca='BOLETO',
                                valor=125, data_vencimento=comp.data_vencimento)
        with mock.patch('apps.cobranca.asaas.receber_em_dinheiro') as baixa:
            rec = servicos.registrar_recebimento(
                comp, Decimal('125'), date.today(), 'pix_direto',
                SimpleUploadedFile('c.png', b'x'), self.admin,
            )
        baixa.assert_called_once()
        self.assertEqual(rec.cobranca.status, Cobranca.Status.RECEIVED_IN_CASH)

    def test_reemissao_remove_antiga_e_cria_nova(self):
        comp, _ = servicos.gerar_competencia(self.perfil, date.today().year + 1, 1)
        antiga = Cobranca.objects.create(competencia=comp, asaas_payment_id='pay_old', tipo_cobranca='BOLETO',
                                         valor=125, data_vencimento=comp.data_vencimento)
        criar = mock.Mock(return_value={'id': 'pay_new', 'status': 'PENDING', 'invoiceUrl': 'https://x'})
        with mock.patch.multiple(
            'apps.cobranca.asaas',
            remover_cobranca=mock.DEFAULT,
            buscar_ou_criar_cliente=mock.Mock(return_value='cus_1'),
            criar_cobranca=criar,
            pix_copia_cola=mock.Mock(return_value='000201'),
        ):
            nova = servicos.emitir_cobranca(comp)
        antiga.refresh_from_db()
        self.assertEqual(antiga.status, Cobranca.Status.DELETED)
        self.assertEqual(nova.pix_copia_cola, '000201')
        # Em dia: cobra o cheio com desconto até o vencimento.
        args = criar.call_args.args
        self.assertEqual((args[2], args[6]), (Decimal('125'), Decimal('25')))
        # Mensagem exigida pela AFSB, só com o dia de vencimento do perfil.
        self.assertEqual(
            args[4], 'Mensalidade da AFSB – Pagamentos realizados até o dia 15 de cada mês têm 20% de desconto.'
        )

    @override_settings(COBRANCA_EMISSAO_LIBERADA=False)
    def test_tabela_de_valores(self):
        url = '/cobranca/tabela/salvar/'
        linha = lambda q, cheio, desc=None: {'qtd_lojas': q, 'valor_cheio': cheio, 'valor_desconto': desc}  # noqa: E731
        self.assertEqual(self.api.post(url, {'modalidade': 'mensal', 'linhas': [linha(1, 130, 104)]}, format='json').status_code, 401)
        self.api.force_authenticate(self.admin)

        r = self.api.post(url, {'modalidade': 'mensal', 'linhas': [linha(1, 130, 104), linha(2, 180, 144)]}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual([(l['qtd_lojas'], l['valor_cheio']) for l in r.json()], [(1, '130.00'), (2, '180.00')])
        self.assertEqual(self.perfil.valores_vigentes(date(2026, 10, 15)), (Decimal('130.00'), Decimal('104.00')))
        # Anual ignora desconto; mensal exige desconto <= normal e faixas sem repetição.
        r = self.api.post(url, {'modalidade': 'anual', 'linhas': [linha(1, 1200, 999)]}, format='json')
        self.assertIsNone(r.json()[0]['valor_desconto'])
        for linhas in ([linha(1, 130)], [linha(1, 130, 140)], [linha(1, 130, 104), linha(1, 120, 96)]):
            self.assertEqual(self.api.post(url, {'modalidade': 'mensal', 'linhas': linhas}, format='json').status_code, 400)
        # Faixa usada por perfil ativo não pode sair; sem uso, sai.
        r = self.api.post(url, {'modalidade': 'mensal', 'linhas': [linha(2, 180, 144)]}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('1 loja(s)', r.json()['detail'])
        r = self.api.post(url, {'modalidade': 'mensal', 'linhas': [linha(1, 130, 104)]}, format='json')
        self.assertEqual(len(r.json()), 1)
        self.assertEqual(len(self.api.get('/cobranca/tabela/').json()), 2)

    def test_trava_impede_emissao_e_geracao(self):
        comp, _ = servicos.gerar_competencia(self.perfil, date.today().year + 1, 1)
        with self.assertRaisesMessage(servicos.asaas.AsaasErro, 'não liberada'):
            servicos.emitir_cobranca(comp)
        from django.core.management.base import CommandError
        with self.assertRaises(CommandError):
            call_command('gerar_competencias', stdout=mock.MagicMock())


@override_settings(STORAGES=ARMAZENAMENTO_LOCAL, ASAAS_API_KEY='chave-teste', COBRANCA_EMISSAO_LIBERADA=True)
class AreaAssociadoTests(TestCase):
    def setUp(self):
        TabelaValor.objects.create(modalidade='mensal', qtd_lojas=1, valor_cheio=125, valor_desconto=100)
        self.joao = criar_usuario('joao@loja.com', nro_associado=10)
        self.maria = criar_usuario('maria@loja.com', cpf='390.533.447-05', nro_associado=11)
        perfis = [
            PerfilCobranca.objects.create(
                usuario=u, tipo_documento='cpf', documento=u.cpf, nome_pagador=u.first_name,
                forma_pagamento='pix_boleto', dia_vencimento=15, qtd_lojas=1,
            )
            for u in (self.joao, self.maria)
        ]
        ano = date.today().year + 1
        self.minha, _ = servicos.gerar_competencia(perfis[0], ano, 1)
        self.alheia, _ = servicos.gerar_competencia(perfis[1], ano, 1)
        self.api = APIClient()
        self.api.force_authenticate(self.joao)

    def test_ve_so_o_proprio_extrato_e_dados(self):
        ids = [c['id'] for c in self.api.get('/cobranca/minhas/').json()]
        self.assertEqual(ids, [str(self.minha.id)])
        self.assertEqual(self.api.get(f'/cobranca/minhas/{self.alheia.id}/').status_code, 404)
        self.assertEqual(self.api.get('/usuario/me/dados/').json()['nro_associado'], 10)
        self.assertEqual(self.api.get('/franquia/minhas/').status_code, 200)

    def test_pagar_gera_uma_vez_e_reaproveita(self):
        resposta = {'id': 'pay_1', 'status': 'PENDING', 'invoiceUrl': 'https://asaas/i/1'}
        with mock.patch.multiple(
            'apps.cobranca.asaas',
            buscar_ou_criar_cliente=mock.Mock(return_value='cus_1'),
            criar_cobranca=mock.Mock(return_value=resposta),
            pix_copia_cola=mock.Mock(return_value=None),
        ) as _:
            primeira = self.api.post(f'/cobranca/minhas/{self.minha.id}/pagar/').json()
            segunda = self.api.post(f'/cobranca/minhas/{self.minha.id}/pagar/').json()
        self.assertEqual(primeira['cobranca']['invoice_url'], 'https://asaas/i/1')
        self.assertEqual(segunda['cobranca']['id'], primeira['cobranca']['id'])
        self.assertEqual(Cobranca.objects.filter(competencia=self.minha).count(), 1)
        self.assertEqual(self.api.post(f'/cobranca/minhas/{self.alheia.id}/pagar/').status_code, 404)

    def test_bloqueado_perde_acesso(self):
        self.joao.status = Usuario.Status.BLOQUEADO
        self.joao.save()
        for rota in ('/cobranca/minhas/', '/usuario/me/dados/', '/franquia/minhas/'):
            self.assertEqual(self.api.get(rota).status_code, 403, rota)
        # Painel admin continua fechado para associado.
        self.assertEqual(self.api.get('/cobranca/competencias/').status_code, 403)


@override_settings(STORAGES=ARMAZENAMENTO_LOCAL, ASAAS_API_KEY='')
class VerComoEAprovacaoTests(TestCase):
    def setUp(self):
        TabelaValor.objects.create(modalidade='mensal', qtd_lojas=1, valor_cheio=125, valor_desconto=100)
        self.admin = criar_usuario('admin@afsb.com.br', Usuario.Cargos.ADMIN, cpf='111.444.777-35')
        self.joao = criar_usuario('joao@loja.com', nro_associado=10)
        perfil = PerfilCobranca.objects.create(
            usuario=self.joao, tipo_documento='cpf', documento=self.joao.cpf, nome_pagador='João',
            forma_pagamento='pix_boleto', dia_vencimento=25, qtd_lojas=1,
        )
        self.comp, _ = servicos.gerar_competencia(perfil, date.today().year + 1, 1)
        self.api = APIClient()

    def test_admin_ve_como_associado_somente_leitura(self):
        self.api.force_authenticate(self.admin)
        cab = {'HTTP_X_VER_COMO': str(self.joao.id)}
        self.assertEqual(self.api.get('/usuario/me/dados/', **cab).json()['nro_associado'], 10)
        self.assertEqual(len(self.api.get('/cobranca/minhas/', **cab).json()), 1)
        self.assertEqual(self.api.post(f'/cobranca/minhas/{self.comp.id}/pagar/', **cab).status_code, 403)
        self.assertEqual(self.api.get('/usuario/me/dados/', HTTP_X_VER_COMO='lixo').status_code, 404)

    def test_associado_nao_consegue_ver_como_outro(self):
        maria = criar_usuario('maria@loja.com', cpf='390.533.447-05', nro_associado=11)
        self.api.force_authenticate(maria)
        dados = self.api.get('/usuario/me/dados/', HTTP_X_VER_COMO=str(self.joao.id)).json()
        self.assertEqual(dados['nro_associado'], 11)
        self.assertEqual(self.api.get('/cobranca/minhas/', HTTP_X_VER_COMO=str(self.joao.id)).json(), [])

    def test_pre_cadastro_aprovacao_e_reprovacao(self):
        r = self.api.post('/usuario/cadastro/', {
            'nome': 'Ana Paula Souza', 'email': 'ANA@loja.com', 'whatsapp': '(21) 98888-7777',
            'cpf': '39053344705', 'senha': 'Subway#2026forte',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        ana = Usuario.objects.get(email='ana@loja.com')
        self.assertEqual((ana.status, ana.whatsapp, ana.cpf), ('aguardando_validacao', '+5521988887777', '390.533.447-05'))
        # Aguardando: login barrado com o código que abre o popup de pendência.
        r = self.api.post('/usuario/login/', {'username': 'ana@loja.com', 'password': 'Subway#2026forte'}, format='json')
        self.assertEqual(r.json()['code'], 'acesso_pendente')
        # Duplicado e CPF inválido são recusados com mensagem.
        r = self.api.post('/usuario/cadastro/', {
            'nome': 'X', 'email': 'ana@loja.com', 'whatsapp': '11999998888', 'cpf': '123', 'senha': 'abc',
        }, format='json')
        self.assertEqual(set(r.json()), {'email', 'cpf'})

        self.api.force_authenticate(self.admin)
        fila = self.api.get('/usuario/aprovacoes/').json()
        self.assertEqual([p['email'] for p in fila['pendentes']], ['ana@loja.com'])
        self.assertEqual(fila['proximo_nro'], 11)
        self.assertEqual(self.api.post(f'/usuario/{ana.id}/aprovar/', {'nro_associado': 10}, format='json').status_code, 400)
        r = self.api.post(f'/usuario/{ana.id}/aprovar/', {'nro_associado': 11}, format='json')
        self.assertEqual((r.json()['status'], r.json()['nro_associado']), ('ativo', 11))
        self.assertEqual(self.api.post(f'/usuario/{ana.id}/reprovar/', {'motivo': 'x' * 5}, format='json').status_code, 400)
        decisao = self.api.get('/usuario/aprovacoes/').json()['decisoes'][0]
        self.assertTrue(decisao['aprovado'])

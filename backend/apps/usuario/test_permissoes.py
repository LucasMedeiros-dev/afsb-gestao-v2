"""
Auditoria de permissões: cada rota x método x perfil de acesso.

Regra: rotas públicas (conteúdo do site, mapa, login, pré-cadastro) abertas para
leitura; o resto exige login. Admin altera tudo; associado ativo só lê o que a
área dele mostra (documentos + os próprios dados/lojas/cobranças) e paga as
próprias cobranças. Cadastro não ativo (bloqueado, inativo...) perde tudo isso,
mesmo com um token emitido antes.

"permitido" = passou da checagem de acesso (2xx, 400 de validação ou 404 de id
inexistente). "negado" = 401/403.
"""
import tempfile
import uuid
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.cobranca import servicos
from apps.cobranca.models import PerfilCobranca, TabelaValor
from apps.documento.models import Documento
from apps.evento.models import Evento
from apps.franquia.models import Franquia
from apps.usuario.models import Usuario

ARMAZENAMENTO_LOCAL = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage', 'OPTIONS': {'location': tempfile.mkdtemp()}},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
P, N = 'permitido', 'negado'
FALSO = uuid.uuid4()


def usuario(email, cpf, cargo='franqueado', status='ativo', nro=None):
    u = Usuario(username=email, email=email, cpf=cpf, whatsapp='+5511999998888', cargo=cargo, status=status, nro_associado=nro)
    u.set_password('x')
    u.save()
    return u


@override_settings(STORAGES=ARMAZENAMENTO_LOCAL, ASAAS_API_KEY='', COBRANCA_EMISSAO_LIBERADA=False)
class MatrizPermissoesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = usuario('admin@afsb.com.br', '111.444.777-35', cargo='admin')
        cls.assoc = usuario('joao@loja.com', '529.982.247-25', nro=10)
        cls.bloq = usuario('bloq@loja.com', '390.533.447-05', status='bloqueado', nro=11)
        cls.admin_inativo = usuario('exadmin@afsb.com.br', '714.602.380-01', cargo='admin', status='inativo')
        cls.outro = usuario('maria@loja.com', '935.411.347-80', nro=12)
        TabelaValor.objects.create(modalidade='mensal', qtd_lojas=1, valor_cheio=125, valor_desconto=100)
        perfil = PerfilCobranca.objects.create(
            usuario=cls.outro, tipo_documento='cpf', documento=cls.outro.cpf, nome_pagador='Maria',
            forma_pagamento='pix_boleto', dia_vencimento=15, qtd_lojas=1,
        )
        cls.comp_outro, _ = servicos.gerar_competencia(perfil, 2027, 1)
        cls.loja = Franquia.objects.create(
            nro_da_loja=1, nome_fantasia='A', razao_social='A', cnpj='11.222.333/0001-81', estado='SP',
            cidade='SP', bairro='C', rua='R', numero='1', cep='01001-000',
        )
        cls.loja.usuarios.add(cls.assoc, cls.outro)
        cls.evento = Evento.objects.create(titulo='E', data_hora='2027-01-01T10:00:00-03:00')
        cls.doc = Documento.objects.create(titulo='D', tipo='documento', arquivo=SimpleUploadedFile('d.pdf', b'%PDF'))

    def cliente(self, quem):
        c = APIClient()
        if quem != 'anonimo':
            c.force_authenticate(getattr(self, quem))
        return c

    def conferir(self, metodo, rota, esperado):
        """esperado: dict perfil -> P/N."""
        for quem, deve in esperado.items():
            r = getattr(self.cliente(quem), metodo)(rota, {}, format='json')
            obtido = N if r.status_code in (401, 403) else P
            with self.subTest(rota=rota, metodo=metodo, perfil=quem):
                self.assertEqual(obtido, deve, f'{metodo.upper()} {rota} como {quem}: HTTP {r.status_code}')

    def test_conteudo_publico_le_todos_escreve_admin(self):
        for base, item in (('/evento/', self.evento.id), ('/noticia/', FALSO), ('/membro/', FALSO), ('/parceiro/', FALSO)):
            self.conferir('get', base, dict(anonimo=P, assoc=P, bloq=P, admin=P))
            for metodo, rota in (('post', base), ('patch', f'{base}{item}/'), ('delete', f'{base}{FALSO}/')):
                self.conferir(metodo, rota, dict(anonimo=N, assoc=N, bloq=N, admin=P))
        self.conferir('get', '/franquia/por-estado/', dict(anonimo=P, assoc=P, admin=P))

    def test_documentos_so_associado_ativo_le(self):
        for rota in ('/documento/', f'/documento/{self.doc.id}/'):
            self.conferir('get', rota, dict(anonimo=N, assoc=P, bloq=N, admin=P))
        for metodo, rota in (('post', '/documento/'), ('patch', f'/documento/{self.doc.id}/'), ('delete', f'/documento/{FALSO}/')):
            self.conferir(metodo, rota, dict(anonimo=N, assoc=N, bloq=N, admin=P))

    def test_area_do_associado(self):
        for rota in ('/usuario/me/dados/', '/franquia/minhas/', '/cobranca/minhas/', f'/cobranca/minhas/{FALSO}/'):
            self.conferir('get', rota, dict(anonimo=N, assoc=P, bloq=N, admin=P))
        self.conferir('post', f'/cobranca/minhas/{FALSO}/pagar/', dict(anonimo=N, assoc=P, bloq=N, admin=P))
        self.conferir('get', '/usuario/me/', dict(anonimo=N, assoc=P, bloq=P, admin=P))
        self.conferir('post', '/usuario/logout/', dict(anonimo=N, assoc=P))

    def test_associado_nao_ve_dado_de_outro(self):
        c = self.cliente('assoc')
        self.assertEqual(c.get(f'/cobranca/minhas/{self.comp_outro.id}/').status_code, 404)
        self.assertEqual(c.post(f'/cobranca/minhas/{self.comp_outro.id}/pagar/').status_code, 404)
        self.assertEqual(c.get('/cobranca/minhas/', HTTP_X_VER_COMO=str(self.outro.id)).json(), [])
        loja = c.get('/franquia/minhas/').json()[0]
        # Vê o nome dos sócios da própria loja, mas não os ids internos deles.
        self.assertNotIn('usuarios', loja)

    def test_rotas_administrativas(self):
        u, perfil = self.outro.id, PerfilCobranca.objects.get().id
        so_admin = dict(anonimo=N, assoc=N, bloq=N, admin=P, admin_inativo=N)
        leituras = [
            '/usuario/', f'/usuario/{u}/', '/usuario/aprovacoes/', '/franquia/', f'/franquia/{self.loja.id}/',
            '/franquia/consulta-cnpj/00000000000000/', '/cobranca/dashboard/', '/cobranca/perfis/',
            f'/cobranca/perfis/{perfil}/', '/cobranca/competencias/', f'/cobranca/competencias/{self.comp_outro.id}/',
        ]
        for rota in leituras:
            self.conferir('get', rota, so_admin)
        escritas = [
            ('post', '/usuario/'), ('patch', f'/usuario/{FALSO}/'), ('delete', f'/usuario/{FALSO}/'),
            ('post', f'/usuario/{FALSO}/aprovar/'), ('post', f'/usuario/{FALSO}/reprovar/'),
            ('post', '/franquia/'), ('patch', f'/franquia/{FALSO}/'), ('delete', f'/franquia/{FALSO}/'),
            ('post', '/cobranca/perfis/'), ('patch', f'/cobranca/perfis/{FALSO}/'), ('delete', f'/cobranca/perfis/{FALSO}/'),
            ('post', f'/cobranca/competencias/{FALSO}/reemitir/'), ('post', f'/cobranca/competencias/{FALSO}/receber/'),
            ('post', f'/cobranca/competencias/{FALSO}/enviar-email/'),
        ]
        for metodo, rota in escritas:
            self.conferir(metodo, rota, so_admin)
        # Competência é gerada pelo sistema: nem admin cria/edita/apaga direto pela API.
        for metodo, rota in (('post', '/cobranca/competencias/'), ('delete', f'/cobranca/competencias/{self.comp_outro.id}/')):
            self.assertEqual(getattr(self.cliente('admin'), metodo)(rota).status_code, 405)

    def test_publicos_de_acesso(self):
        anon = APIClient()
        self.assertEqual(anon.post('/usuario/login/', {'username': 'joao@loja.com', 'password': 'x'}, format='json').status_code, 200)
        self.assertEqual(anon.post('/usuario/cadastro/', {}, format='json').status_code, 400)
        # Pré-cadastro não aceita escolher cargo/status.
        anon.post('/usuario/cadastro/', {
            'nome': 'Hacker', 'email': 'h@x.com', 'whatsapp': '11999998888', 'cpf': '286.255.878-87',
            'senha': 'Senha#Forte2026', 'cargo': 'admin', 'status': 'ativo',
        }, format='json')
        h = Usuario.objects.get(email='h@x.com')
        self.assertEqual((h.cargo, h.status, h.is_staff), ('franqueado', 'aguardando_validacao', False))

    def test_admin_desativado_perde_painel(self):
        self.assertFalse(self.admin_inativo.is_staff)
        self.assertTrue(self.admin.is_staff)

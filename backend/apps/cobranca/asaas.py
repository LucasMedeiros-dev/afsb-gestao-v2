"""
Cliente mínimo da API v3 do Asaas (só o que o painel usa).
Chave e URL vêm de settings.ASAAS_API_KEY / ASAAS_BASE_URL (sandbox por padrão).
"""
import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings


class AsaasErro(Exception):
    """Falha de configuração ou resposta de erro do Asaas, com mensagem legível."""


def configurado():
    return bool(settings.ASAAS_API_KEY)


def _req(metodo, caminho, corpo=None, params=None):
    if not configurado():
        raise AsaasErro('Asaas não configurado: defina ASAAS_API_KEY no backend.')
    url = settings.ASAAS_BASE_URL.rstrip('/') + caminho
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        method=metodo,
        data=json.dumps(corpo).encode() if corpo is not None else None,
        headers={
            'access_token': settings.ASAAS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'afsb/1.0',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        try:
            erros = json.load(e).get('errors') or []
            mensagem = '; '.join(x.get('description', '') for x in erros) or e.reason
        except ValueError:
            mensagem = e.reason
        raise AsaasErro(f'Asaas recusou ({e.code}): {mensagem}') from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise AsaasErro('Asaas indisponível no momento. Tente novamente.') from e


def buscar_ou_criar_cliente(nome, cpf_cnpj, email=None, celular=None):
    documento = ''.join(filter(str.isdigit, cpf_cnpj))
    existentes = _req('GET', '/customers', params={'cpfCnpj': documento}).get('data') or []
    if existentes:
        return existentes[0]['id']
    return _req('POST', '/customers', {
        'name': nome,
        'cpfCnpj': documento,
        'email': email,
        'mobilePhone': ''.join(filter(str.isdigit, celular or ''))[-11:] or None,
    })['id']


def criar_cobranca(customer, tipo, valor, vencimento, descricao, referencia, desconto=None):
    corpo = {
        'customer': customer,
        'billingType': tipo,
        'value': float(valor),
        'dueDate': vencimento.isoformat(),
        'description': descricao,
        'externalReference': referencia,
    }
    if desconto:
        # Desconto fixo válido até o vencimento (pagamento em dia).
        corpo['discount'] = {'value': float(desconto), 'dueDateLimitDays': 0, 'type': 'FIXED'}
    return _req('POST', '/payments', corpo)


def pix_copia_cola(payment_id):
    try:
        return _req('GET', f'/payments/{payment_id}/pixQrCode').get('payload')
    except AsaasErro:
        return None  # Conta sem chave PIX ou boleto sem PIX: segue sem o copia e cola.


def remover_cobranca(payment_id):
    return _req('DELETE', f'/payments/{payment_id}')


def receber_em_dinheiro(payment_id, data, valor):
    return _req('POST', f'/payments/{payment_id}/receiveInCash', {
        'paymentDate': data.isoformat(),
        'value': float(valor),
        'notifyCustomer': False,
    })

"""Consulta de CNPJ no OpenCNPJ, já no formato dos campos da Franquia."""
import json
import re
import urllib.error
import urllib.request

URL = 'https://api.opencnpj.org/{}'


class CnpjNaoEncontrado(Exception):
    pass


def consultar(cnpj):
    digitos = re.sub(r'\D', '', cnpj)
    # Sem User-Agent o OpenCNPJ responde 403.
    req = urllib.request.Request(
        URL.format(digitos), headers={'Accept': 'application/json', 'User-Agent': 'afsb/1.0'}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            dados = json.load(resp)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise CnpjNaoEncontrado(cnpj) from e
        raise

    cep = re.sub(r'\D', '', dados.get('cep') or '').zfill(8)
    rua = ' '.join(filter(None, [dados.get('tipo_logradouro'), dados.get('logradouro')]))
    return {
        'cnpj': f'{digitos[:2]}.{digitos[2:5]}.{digitos[5:8]}/{digitos[8:12]}-{digitos[12:]}',
        'razao_social': (dados.get('razao_social') or '')[:100],
        'nome_fantasia': (dados.get('nome_fantasia') or dados.get('razao_social') or '')[:100],
        'cep': f'{cep[:5]}-{cep[5:]}',
        'rua': rua[:100],
        'numero': (dados.get('numero') or 'S/N')[:10],
        'complemento': re.sub(r'\s+', ' ', dados.get('complemento') or '').strip()[:100] or None,
        'bairro': (dados.get('bairro') or '')[:100],
        'cidade': (dados.get('municipio') or '')[:100],
        'estado': dados.get('uf') or '',
        'situacao_cadastral': dados.get('situacao_cadastral'),
    }

# validacoes.py 
# Arquivo dedicado a funções de validação de campos de dados, como CPF, CNPJ, e-mail, etc.
from django.core.exceptions import ValidationError

# 1. Validação de CPF

def validar_cpf(cpf):
    """
    Validador de CPF para campos Django. Não retorna nada, mas levanta uma ValidationError se o CPF for inválido.
    """
    # Remove caracteres não numéricos
    cpf = ''.join(filter(str.isdigit, cpf))

    # Verifica se o CPF tem 11 dígitos
    if len(cpf) != 11:
        raise ValidationError("CPF inválido")

    # Verifica se todos os dígitos são iguais
    if cpf == cpf[0] * 11:
        raise ValidationError("CPF inválido") # Não especifca o motivo exato.

    # Calcula os dígitos verificadores
    for i in range(9, 11):
        soma = sum(int(cpf[j]) * (i + 1 - j) for j in range(i))
        digito = (soma * 10 % 11) % 10
        if digito != int(cpf[i]):
            raise ValidationError("CPF inválido") # Não especifca o motivo exato.
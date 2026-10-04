from django.db import models
from uuid import uuid4


class Franquia(models.Model):
    """
    Loja franqueada. Uma loja pode ter vários sócios (usuários) e um usuário pode ter várias lojas.
    """
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    nro_da_loja = models.PositiveIntegerField('número da loja', unique=True)
    nome_fantasia = models.CharField('nome fantasia', max_length=100)
    razao_social = models.CharField('razão social', max_length=100)
    cnpj = models.CharField('CNPJ', max_length=18, unique=True)
    estado = models.CharField('estado', max_length=2)  # UF
    cidade = models.CharField('cidade', max_length=100)
    bairro = models.CharField('bairro', max_length=100)
    rua = models.CharField('rua', max_length=100)
    numero = models.CharField('número', max_length=10)
    complemento = models.CharField('complemento', max_length=100, null=True, blank=True)
    cep = models.CharField('CEP', max_length=9)
    usuarios = models.ManyToManyField('usuario.Usuario', related_name='franquias', verbose_name='sócios')

    class Meta:
        verbose_name = 'franquia'
        verbose_name_plural = 'franquias'
        ordering = ['nro_da_loja']

    def __str__(self):
        return f"Loja {self.nro_da_loja} - {self.nome_fantasia}"

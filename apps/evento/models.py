from django.db import models
from uuid import uuid4


class Evento(models.Model):
    """
    Evento da associação, exibido no front end.
    """
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    titulo = models.CharField('título', max_length=100)
    data_hora = models.DateTimeField('data e hora')
    criado = models.DateTimeField('data de criação', auto_now_add=True)
    atualizado = models.DateTimeField('data de atualização', auto_now=True)

    class Meta:
        verbose_name = 'evento'
        verbose_name_plural = 'eventos'
        ordering = ['data_hora']

    def __str__(self):
        return f"{self.titulo} - {self.data_hora:%d/%m/%Y %H:%M}"

from django.db import models

from apps.utils.custom_models import DefaultModel


class Evento(DefaultModel):
    """
    Evento da associação, exibido no front end.
    """
    titulo = models.CharField('título', max_length=100)
    data_hora = models.DateTimeField('data e hora')

    class Meta:
        verbose_name = 'evento'
        verbose_name_plural = 'eventos'
        ordering = ('data_hora',)

    def __str__(self):
        return f"{self.titulo} - {self.data_hora:%d/%m/%Y %H:%M}"

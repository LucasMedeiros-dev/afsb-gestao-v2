from django.db import models

from apps.utils.custom_models import DefaultModel

# Modelo de membros que representam os membros da AFSB na landing page.

class Membro(DefaultModel):
    nome = models.CharField(max_length=100)
    titulo = models.CharField(max_length=100)
    foto = models.ImageField(upload_to='membros/')
    ordem = models.PositiveIntegerField('ordem de exibição', default=0)

    # Ordering por ordem + nome para que a ordenação seja consistente e previsível.
    class Meta:
        verbose_name = 'Membro AFSB'
        verbose_name_plural = 'Membros AFSB'
        ordering = ('ordem', 'nome')

    def __str__(self):
        return self.nome
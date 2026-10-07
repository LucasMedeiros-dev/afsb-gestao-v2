from django.db import models

from apps.utils.custom_models import DefaultModel


class Noticia(DefaultModel):
    """
    Notícia exibida na landing page (atualizações, promoções etc.).
    """
    titulo = models.CharField('título', max_length=100)
    subtitulo = models.CharField('subtítulo', max_length=200)
    texto = models.TextField('texto')
    imagem = models.ImageField('imagem', upload_to='noticias/')

    class Meta:
        verbose_name = 'notícia'
        verbose_name_plural = 'notícias'
        ordering = ('-criado_em',)

    def __str__(self):
        return self.titulo

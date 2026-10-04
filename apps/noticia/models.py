from django.db import models
from uuid import uuid4


class Noticia(models.Model):
    """
    Notícia exibida na landing page (atualizações, promoções etc.).
    """
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    titulo = models.CharField('título', max_length=100)
    subtitulo = models.CharField('subtítulo', max_length=200)
    texto = models.TextField('texto')
    imagem = models.ImageField('imagem', upload_to='noticias/')
    data_criacao = models.DateTimeField('data de criação', auto_now_add=True)
    data_atualizacao = models.DateTimeField('data de atualização', auto_now=True)

    class Meta:
        verbose_name = 'notícia'
        verbose_name_plural = 'notícias'
        ordering = ['-data_criacao']

    def __str__(self):
        return self.titulo

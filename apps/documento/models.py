from django.db import models
from uuid import uuid4


class Documento(models.Model):
    """
    Arquivos disponibilizados no sistema, como contratos, termos de uso, palestras e atas de reunião.
    """
    class Tipos(models.TextChoices):
        DOCUMENTO = 'documento', 'Documento'
        PALESTRA = 'palestra', 'Palestra'
        ATA_DE_REUNIAO = 'ata_de_reuniao', 'Ata de Reunião'

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    titulo = models.CharField('título', max_length=100)
    arquivo = models.FileField('arquivo', upload_to='documentos/')
    tipo = models.CharField('tipo', max_length=30, choices=Tipos.choices)
    data_criacao = models.DateTimeField('data de criação', auto_now_add=True)
    data_atualizacao = models.DateTimeField('data de atualização', auto_now=True)

    class Meta:
        verbose_name = 'documento'
        verbose_name_plural = 'documentos'
        ordering = ['-data_criacao']

    def __str__(self):
        return f"{self.titulo} ({self.get_tipo_display()})"

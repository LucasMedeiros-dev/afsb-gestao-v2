from django.db import models

from apps.utils.custom_models import DefaultModel


class Documento(DefaultModel):
    """
    Arquivos disponibilizados no sistema, como contratos, termos de uso, palestras e atas de reunião.
    """
    class Tipos(models.TextChoices):
        DOCUMENTO = 'documento', 'Documento'
        PALESTRA = 'palestra', 'Palestra'
        ATA_DE_REUNIAO = 'ata_de_reuniao', 'Ata de Reunião'

    titulo = models.CharField('título', max_length=100)
    arquivo = models.FileField('arquivo', upload_to='documentos/')
    tipo = models.CharField('tipo', max_length=30, choices=Tipos.choices)


    class Meta:
        verbose_name = 'documento'
        verbose_name_plural = 'documentos'
        ordering = ('-criado_em',)

    def __str__(self):
        return f"{self.titulo} ({self.get_tipo_display()})"

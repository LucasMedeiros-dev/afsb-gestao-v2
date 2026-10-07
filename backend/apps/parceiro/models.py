from django.db import models

from apps.utils.custom_models import DefaultModel


class Parceiro(DefaultModel):
    class TipoParceiro(models.TextChoices):
        BENEFICIO = "beneficio", "Benefício"
        PARCERIA = "parceria", "Parceria"

    tipo = models.CharField(max_length=20, choices=TipoParceiro.choices, default=TipoParceiro.BENEFICIO)
    nome = models.CharField(max_length=255)
    beneficios = models.TextField(blank=True, null=True)
    logo = models.ImageField(upload_to="parceiros/logos/", blank=True, null=True)
    site = models.URLField(max_length=255, blank=True, null=True)
    contato = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return self.nome
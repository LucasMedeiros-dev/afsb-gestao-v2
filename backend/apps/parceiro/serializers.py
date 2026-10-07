from rest_framework import serializers

from .models import Parceiro


class ParceiroSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parceiro
        fields = (
            "id",
            "tipo",
            "nome",
            "beneficios",
            "logo",
            "site",
            "contato",
            "criado_em",
            "atualizado_em",
        )

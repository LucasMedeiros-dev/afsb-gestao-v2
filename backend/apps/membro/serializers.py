from rest_framework import serializers

from .models import Membro


class MembroSerializer(serializers.ModelSerializer):
    class Meta:
        model = Membro
        fields = (
            "id",
            "nome",
            "titulo",
            "foto",
            "ordem",
            "criado_em",
            "atualizado_em",
        )

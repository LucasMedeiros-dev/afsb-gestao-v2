from rest_framework import serializers

from .models import Evento


class EventoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Evento
        fields = (
            "id",
            "titulo",
            "data_hora",
            "criado_em",
            "atualizado_em",
        )

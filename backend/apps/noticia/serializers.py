from rest_framework import serializers

from .models import Noticia


class NoticiaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Noticia
        fields = (
            "id",
            "titulo",
            "subtitulo",
            "texto",
            "imagem",
            "criado_em",
            "atualizado_em",
        )

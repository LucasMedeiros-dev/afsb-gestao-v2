from rest_framework import serializers

from .models import Documento


class DocumentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Documento
        fields = ('id', 'titulo', 'tipo', 'arquivo', 'criado_em', 'atualizado_em')
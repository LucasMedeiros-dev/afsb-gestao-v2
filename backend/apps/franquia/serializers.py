from rest_framework import serializers

from .models import Franquia


class FranquiaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Franquia
        fields = (
            "id",
            "nro_da_loja",
            "nome_fantasia",
            "razao_social",
            "cnpj",
            "estado",
            "cidade",
            "bairro",
            "rua",
            "numero",
            "complemento",
            "cep",
            "usuarios",
        )

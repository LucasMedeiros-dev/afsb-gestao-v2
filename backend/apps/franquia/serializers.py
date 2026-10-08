from rest_framework import serializers

from .models import Franquia


class FranquiaSerializer(serializers.ModelSerializer):
    socios = serializers.SerializerMethodField()

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
            "socios",
        )
        extra_kwargs = {"usuarios": {"required": False}}

    def get_socios(self, obj):
        return [u.get_full_name() or u.email for u in obj.usuarios.all()]


class MinhaFranquiaSerializer(FranquiaSerializer):
    """Visão do associado: nomes dos sócios da própria loja, sem os ids internos deles."""

    class Meta(FranquiaSerializer.Meta):
        fields = tuple(f for f in FranquiaSerializer.Meta.fields if f != "usuarios")

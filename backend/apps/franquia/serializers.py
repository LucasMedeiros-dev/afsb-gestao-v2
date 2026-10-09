import re

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
    """
    Visão do associado: nomes dos sócios da própria loja, sem os ids internos deles.
    Edita nome fantasia e endereço; nº da loja, CNPJ e razão social seguem com a AFSB.
    """

    class Meta(FranquiaSerializer.Meta):
        fields = tuple(f for f in FranquiaSerializer.Meta.fields if f != "usuarios")
        read_only_fields = ("nro_da_loja", "cnpj", "razao_social")

    def validate_cep(self, valor):
        d = re.sub(r"\D", "", valor)
        if len(d) != 8:
            raise serializers.ValidationError("CEP inválido.")
        return f"{d[:5]}-{d[5:]}"

    def validate_estado(self, valor):
        valor = valor.strip().upper()
        if not re.fullmatch(r"[A-Z]{2}", valor):
            raise serializers.ValidationError("UF inválida.")
        return valor

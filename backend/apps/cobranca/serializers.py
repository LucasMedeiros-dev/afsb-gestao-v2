from decimal import Decimal

from rest_framework import serializers

from . import servicos
from .models import Cobranca, Competencia, PerfilCobranca, RecebimentoExterno, TabelaValor


class TabelaValorSerializer(serializers.ModelSerializer):
    class Meta:
        model = TabelaValor
        fields = ('id', 'modalidade', 'qtd_lojas', 'valor_cheio', 'valor_desconto', 'data_atualizacao')


class LinhaTabelaSerializer(serializers.Serializer):
    qtd_lojas = serializers.IntegerField(min_value=1, max_value=999)
    valor_cheio = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    valor_desconto = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal('0.01'), required=False, allow_null=True
    )


class SalvarTabelaSerializer(serializers.Serializer):
    """Tabela inteira de uma modalidade: o que não vier na lista é removido."""

    modalidade = serializers.ChoiceField(choices=TabelaValor.Modalidade.choices)
    linhas = LinhaTabelaSerializer(many=True, allow_empty=False)

    def validate(self, dados):
        qtds = [l['qtd_lojas'] for l in dados['linhas']]
        if len(qtds) != len(set(qtds)):
            raise serializers.ValidationError({'linhas': 'Quantidade de lojas repetida.'})
        for l in dados['linhas']:
            if dados['modalidade'] == TabelaValor.Modalidade.ANUAL:
                l['valor_desconto'] = None  # Anual (cartão) não tem desconto.
            elif not l.get('valor_desconto'):
                raise serializers.ValidationError({'linhas': f"{l['qtd_lojas']} loja(s): informe o valor com desconto."})
            elif l['valor_desconto'] > l['valor_cheio']:
                raise serializers.ValidationError(
                    {'linhas': f"{l['qtd_lojas']} loja(s): valor com desconto maior que o valor normal."}
                )
        return dados


class PerfilCobrancaSerializer(serializers.ModelSerializer):
    associado = serializers.SerializerMethodField()

    class Meta:
        model = PerfilCobranca
        fields = (
            'id', 'usuario', 'associado', 'franquias', 'tipo_documento', 'documento', 'nome_pagador',
            'forma_pagamento', 'dia_vencimento', 'qtd_lojas',
            'valor_personalizado_cheio', 'valor_personalizado_desconto',
            'valor_personalizado_inicio', 'valor_personalizado_fim', 'motivo_valor_personalizado',
            'qtd_parcelas', 'ativo', 'observacao', 'asaas_customer_id', 'asaas_subscription_id',
        )
        read_only_fields = ('asaas_customer_id', 'asaas_subscription_id')
        extra_kwargs = {'franquias': {'required': False}}

    def get_associado(self, obj):
        u = obj.usuario
        return {'id': str(u.id), 'nome': u.get_full_name() or u.email, 'nro': u.nro_associado}

    def validate(self, dados):
        cheio = dados.get('valor_personalizado_cheio', getattr(self.instance, 'valor_personalizado_cheio', None))
        if cheio is not None:
            inicio = dados.get('valor_personalizado_inicio', getattr(self.instance, 'valor_personalizado_inicio', None))
            motivo = dados.get('motivo_valor_personalizado', getattr(self.instance, 'motivo_valor_personalizado', None))
            if not inicio or not motivo:
                raise serializers.ValidationError(
                    'Valor personalizado exige data de início e motivo.'
                )
        forma = dados.get('forma_pagamento', getattr(self.instance, 'forma_pagamento', None))
        if forma == PerfilCobranca.FormaPagamento.CARTAO_PARCELADO and not dados.get(
            'qtd_parcelas', getattr(self.instance, 'qtd_parcelas', None)
        ):
            raise serializers.ValidationError({'qtd_parcelas': 'Informe as parcelas do cartão parcelado.'})
        return dados


class CobrancaSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_cobranca_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Cobranca
        fields = (
            'id', 'asaas_payment_id', 'tipo_cobranca', 'tipo_display', 'status', 'status_display',
            'valor', 'data_vencimento', 'data_pagamento', 'invoice_url', 'boleto_url', 'pix_copia_cola',
            'data_criacao',
        )


class RecebimentoSerializer(serializers.ModelSerializer):
    forma_display = serializers.CharField(source='get_forma_pagamento_display', read_only=True)
    registrado_por_nome = serializers.SerializerMethodField()

    class Meta:
        model = RecebimentoExterno
        fields = (
            'id', 'forma_pagamento', 'forma_display', 'valor', 'data_pagamento', 'comprovante',
            'observacao', 'registrado_por_nome', 'data_criacao',
        )

    def get_registrado_por_nome(self, obj):
        return obj.registrado_por.get_full_name() or obj.registrado_por.email


class CompetenciaSerializer(serializers.ModelSerializer):
    associado = serializers.SerializerMethodField()
    nome_pagador = serializers.CharField(source='perfil.nome_pagador', read_only=True)
    documento = serializers.CharField(source='perfil.documento', read_only=True)
    forma_pagamento = serializers.CharField(source='perfil.get_forma_pagamento_display', read_only=True)
    periodo = serializers.SerializerMethodField()
    situacao = serializers.SerializerMethodField()
    saldo = serializers.SerializerMethodField()
    cobranca = serializers.SerializerMethodField()
    recebimentos = RecebimentoSerializer(source='recebimentos_externos', many=True, read_only=True)

    class Meta:
        model = Competencia
        fields = (
            'id', 'perfil', 'associado', 'nome_pagador', 'documento', 'forma_pagamento', 'periodo',
            'ano', 'mes', 'valor_cheio', 'valor_desconto', 'valor_pago', 'saldo', 'data_vencimento',
            'data_pagamento', 'status', 'situacao', 'cobranca', 'recebimentos',
        )

    def get_associado(self, obj):
        u = obj.perfil.usuario
        return {
            'id': str(u.id), 'nome': u.get_full_name() or u.email, 'nro': u.nro_associado,
            'email': u.email, 'whatsapp': u.whatsapp,
        }

    def get_periodo(self, obj):
        return f'{obj.mes:02d}/{obj.ano}' if obj.mes else str(obj.ano)

    def get_situacao(self, obj):
        return servicos.situacao(obj)

    def get_saldo(self, obj):
        return str(servicos.saldo(obj, servicos.hoje()))

    def get_cobranca(self, obj):
        atual = servicos.cobranca_atual(obj)
        return CobrancaSerializer(atual).data if atual else None


class ReemitirSerializer(serializers.Serializer):
    tipo_cobranca = serializers.ChoiceField(
        choices=[c for c in Cobranca.TipoCobranca.choices if c[0] != Cobranca.TipoCobranca.CREDIT_CARD],
        default=Cobranca.TipoCobranca.BOLETO,
    )
    data_vencimento = serializers.DateField(required=False, allow_null=True)


class ReceberSerializer(serializers.Serializer):
    valor = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    data_pagamento = serializers.DateField()
    forma_pagamento = serializers.ChoiceField(
        choices=RecebimentoExterno.FormaPagamento.choices,
        default=RecebimentoExterno.FormaPagamento.PIX_DIRETO,
    )
    comprovante = serializers.FileField()
    observacao = serializers.CharField(required=False, allow_blank=True)

    def validate_data_pagamento(self, valor):
        if valor > servicos.hoje():
            raise serializers.ValidationError('A data do pagamento não pode ser futura.')
        return valor

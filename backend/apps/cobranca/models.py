from uuid import uuid4

from django.db import models

# Módulo de cobrança dos associados, integrado ao Asaas.
# Fluxo: TabelaValor (preço padrão) -> PerfilCobranca (quem paga e como) -> Competencia (valor devido no período)
# -> Cobranca (payment no Asaas) ou RecebimentoExterno (pago fora do Asaas). WebhookAsaas guarda os eventos recebidos.


class TabelaValor(models.Model):
    """
    Tabela padrão de valores por quantidade de lojas.
    Mensal (boleto/PIX): valor_cheio após o vencimento, valor_desconto até o vencimento (20%).
    Anual (cartão): valor único, sem desconto.
    """

    class Modalidade(models.TextChoices):
        MENSAL = "mensal", "Boleto/PIX - Mensal"
        ANUAL = "anual", "Cartão de Crédito - Anual"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    modalidade = models.CharField(
        "modalidade", max_length=10, choices=Modalidade.choices
    )
    qtd_lojas = models.PositiveSmallIntegerField("quantidade de lojas")
    valor_cheio = models.DecimalField("valor cheio", max_digits=10, decimal_places=2)
    valor_desconto = models.DecimalField(
        "valor com desconto", max_digits=10, decimal_places=2, null=True, blank=True
    )  # Nulo = sem desconto
    data_criacao = models.DateTimeField("data de criação", auto_now_add=True)
    data_atualizacao = models.DateTimeField("data de atualização", auto_now=True)

    class Meta:
        verbose_name = "tabela de valor"
        verbose_name_plural = "tabela de valores"
        ordering = ("modalidade", "qtd_lojas")
        constraints = (
            models.UniqueConstraint(
                fields=["modalidade", "qtd_lojas"], name="tabela_valor_unica_por_lojas"
            ),
        )

    def __str__(self):
        return f"{self.get_modalidade_display()} - {self.qtd_lojas} loja(s)"


class PerfilCobranca(models.Model):
    """
    Configuração de cobrança de um pagador, cadastrada manualmente a partir da planilha da cliente.
    Um associado pode ter N perfis (ex.: aba "CNPJs BOLETO SEPARADO" = um perfil por CNPJ).
    """

    class TipoDocumento(models.TextChoices):
        CPF = "cpf", "CPF"
        CNPJ = "cnpj", "CNPJ"

    class FormaPagamento(models.TextChoices):
        CARTAO_RECORRENTE = (
            "cartao_recorrente",
            "Cartão Recorrente",
        )  # Subscription mensal no Asaas
        CARTAO_PARCELADO = (
            "cartao_parcelado",
            "Cartão Parcelado",
        )  # Valor anual cheio dividido em N parcelas
        PIX_BOLETO = "pix_boleto", "PIX e Boleto"

    class DiaVencimento(models.IntegerChoices):
        DIA_15 = 15, "Dia 15"
        DIA_25 = 25, "Dia 25"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    usuario = models.ForeignKey(
        "usuario.Usuario",
        on_delete=models.PROTECT,
        related_name="perfis_cobranca",
        verbose_name="associado",
    )
    franquias = models.ManyToManyField(
        "franquia.Franquia",
        related_name="perfis_cobranca",
        blank=True,
        verbose_name="lojas",
    )  # Lojas cobertas por este perfil
    tipo_documento = models.CharField(
        "tipo de documento", max_length=4, choices=TipoDocumento.choices
    )
    documento = models.CharField("CPF/CNPJ", max_length=18)  # CPF ou CNPJ do pagador
    nome_pagador = models.CharField("nome do pagador", max_length=100)
    forma_pagamento = models.CharField(
        "forma de pagamento", max_length=20, choices=FormaPagamento.choices
    )
    dia_vencimento = models.PositiveSmallIntegerField(
        "dia de vencimento", choices=DiaVencimento.choices
    )
    qtd_lojas = models.PositiveSmallIntegerField(
        "quantidade de lojas"
    )  # Conforme planilha; define a linha da TabelaValor
    # Valor personalizado: sobrepõe a TabelaValor dentro da vigência (fim nulo = indeterminado).
    # Usar para exceções da planilha (ex.: valor específico por CNPJ separado).
    valor_personalizado_cheio = models.DecimalField(
        "valor personalizado cheio",
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    valor_personalizado_desconto = models.DecimalField(
        "valor personalizado com desconto",
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    valor_personalizado_inicio = models.DateField(
        "início do valor personalizado", null=True, blank=True
    )
    valor_personalizado_fim = models.DateField(
        "fim do valor personalizado", null=True, blank=True
    )
    motivo_valor_personalizado = models.TextField(
        "motivo do valor personalizado", null=True, blank=True
    )
    qtd_parcelas = models.PositiveSmallIntegerField(
        "quantidade de parcelas", null=True, blank=True
    )  # Apenas cartão parcelado
    # Um customer por CPF/CNPJ no Asaas; perfis do mesmo documento compartilham o mesmo customer
    asaas_customer_id = models.CharField(
        "ID do cliente no Asaas", max_length=50, null=True, blank=True, db_index=True
    )
    asaas_subscription_id = models.CharField(
        "ID da assinatura no Asaas",
        max_length=50,
        null=True,
        blank=True,
        unique=True,
    )  # Apenas cartão recorrente
    ativo = models.BooleanField("ativo", default=True)
    observacao = models.TextField("observação", null=True, blank=True)
    data_criacao = models.DateTimeField("data de criação", auto_now_add=True)
    data_atualizacao = models.DateTimeField("data de atualização", auto_now=True)

    class Meta:
        verbose_name = "perfil de cobrança"
        verbose_name_plural = "perfis de cobrança"
        ordering = ("nome_pagador", "documento")
        constraints = (
            models.CheckConstraint(
                condition=(
                    models.Q(valor_personalizado_cheio__isnull=True)
                    | models.Q(
                        valor_personalizado_inicio__isnull=False,
                        motivo_valor_personalizado__isnull=False,
                    )
                ),
                name="perfil_valor_personalizado_com_inicio_e_motivo",
            ),
        )

    def __str__(self):
        return f"{self.nome_pagador} ({self.documento}) - {self.get_forma_pagamento_display()}"

    def valor_personalizado_vigente(self, data):
        return (
            self.valor_personalizado_cheio is not None
            and self.valor_personalizado_inicio <= data
            and (
                self.valor_personalizado_fim is None
                or data <= self.valor_personalizado_fim
            )
        )

    @property
    def modalidade_tabela(self):
        if self.forma_pagamento == self.FormaPagamento.CARTAO_PARCELADO:
            return TabelaValor.Modalidade.ANUAL
        return TabelaValor.Modalidade.MENSAL

    def valores_vigentes(self, data):
        """
        Retorna (valor_cheio, valor_desconto) a aplicar na competência com vencimento em `data`.
        Levanta TabelaValor.DoesNotExist se não houver linha para a qtd de lojas (usar valor personalizado).
        """
        if self.valor_personalizado_vigente(data):
            return self.valor_personalizado_cheio, self.valor_personalizado_desconto
        tabela = TabelaValor.objects.get(
            modalidade=self.modalidade_tabela, qtd_lojas=self.qtd_lojas
        )
        return tabela.valor_cheio, tabela.valor_desconto

    @property
    def mensagem_boleto(self):
        return (
            f"Mensalidade da AFSB – Pagamentos realizados até o dia {self.dia_vencimento} "
            f"de cada mês têm 20% de desconto."
        )


class Competencia(models.Model):
    """
    Valor em aberto de um perfil em um período. Mensal para recorrente e PIX/boleto; anual para parcelado.
    Valores e vencimento são copiados do perfil na geração, preservando o histórico em reajustes.
    """

    class Periodicidade(models.TextChoices):
        MENSAL = "mensal", "Mensal"
        ANUAL = "anual", "Anual"

    class Status(models.TextChoices):
        ABERTA = "aberta", "Aberta"
        PARCIAL = "parcial", "Parcialmente Paga"
        PAGA = "paga", "Paga"
        VENCIDA = "vencida", "Vencida"
        CANCELADA = "cancelada", "Cancelada"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    perfil = models.ForeignKey(
        PerfilCobranca,
        on_delete=models.PROTECT,
        related_name="competencias",
        verbose_name="perfil de cobrança",
    )
    periodicidade = models.CharField(
        "periodicidade", max_length=10, choices=Periodicidade.choices
    )
    ano = models.PositiveSmallIntegerField("ano")
    mes = models.PositiveSmallIntegerField(
        "mês", null=True, blank=True
    )  # Nulo quando anual
    valor_cheio = models.DecimalField("valor cheio", max_digits=10, decimal_places=2)
    valor_desconto = models.DecimalField(
        "valor com desconto", max_digits=10, decimal_places=2, null=True, blank=True
    )
    valor_personalizado = models.BooleanField(
        "valor personalizado", default=False
    )  # Gerada com valor personalizado do perfil
    data_vencimento = models.DateField("data de vencimento")
    status = models.CharField(
        "status", max_length=10, choices=Status.choices, default=Status.ABERTA
    )
    valor_pago = models.DecimalField(
        "valor pago", max_digits=10, decimal_places=2, default=0
    )
    data_pagamento = models.DateField(
        "data de pagamento", null=True, blank=True
    )  # Data da quitação total
    data_criacao = models.DateTimeField("data de criação", auto_now_add=True)
    data_atualizacao = models.DateTimeField("data de atualização", auto_now=True)

    class Meta:
        verbose_name = "competência"
        verbose_name_plural = "competências"
        ordering = ("ano", "mes")
        constraints = (
            models.UniqueConstraint(
                fields=["perfil", "ano", "mes"], name="competencia_unica_por_periodo"
            ),
            # NULL não conflita em unique, então a anual precisa de constraint própria
            models.UniqueConstraint(
                fields=["perfil", "ano"],
                condition=models.Q(mes__isnull=True),
                name="competencia_anual_unica",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(periodicidade="mensal", mes__gte=1, mes__lte=12)
                    | models.Q(periodicidade="anual", mes__isnull=True)
                ),
                name="competencia_mes_coerente_com_periodicidade",
            ),
        )

    def __str__(self):
        periodo = f"{self.mes:02d}/{self.ano}" if self.mes else str(self.ano)
        return f"{self.perfil.nome_pagador} - {periodo} ({self.get_status_display()})"


class Cobranca(models.Model):
    """
    Pagamento gerado no Asaas (payment). Uma competência pode ter N cobranças: parcelas, reemissões ou troca de forma.
    """

    class TipoCobranca(models.TextChoices):  # billingType do Asaas
        BOLETO = "BOLETO", "Boleto"
        PIX = "PIX", "PIX"
        CREDIT_CARD = "CREDIT_CARD", "Cartão de Crédito"
        UNDEFINED = "UNDEFINED", "Pergunte ao Cliente"

    class Status(models.TextChoices):  # status do payment no Asaas
        PENDING = "PENDING", "Aguardando Pagamento"
        AWAITING_RISK_ANALYSIS = "AWAITING_RISK_ANALYSIS", "Em Análise de Risco"
        CONFIRMED = "CONFIRMED", "Confirmada"
        RECEIVED = "RECEIVED", "Recebida"
        RECEIVED_IN_CASH = "RECEIVED_IN_CASH", "Recebida em Dinheiro"
        OVERDUE = "OVERDUE", "Vencida"
        REFUND_REQUESTED = "REFUND_REQUESTED", "Estorno Solicitado"
        REFUNDED = "REFUNDED", "Estornada"
        CHARGEBACK_REQUESTED = "CHARGEBACK_REQUESTED", "Chargeback Solicitado"
        CHARGEBACK_DISPUTE = "CHARGEBACK_DISPUTE", "Em Disputa de Chargeback"
        AWAITING_CHARGEBACK_REVERSAL = (
            "AWAITING_CHARGEBACK_REVERSAL",
            "Aguardando Reversão de Chargeback",
        )
        DUNNING_REQUESTED = "DUNNING_REQUESTED", "Negativação Solicitada"
        DUNNING_RECEIVED = "DUNNING_RECEIVED", "Negativação Recebida"
        DELETED = "DELETED", "Removida"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    competencia = models.ForeignKey(
        Competencia,
        on_delete=models.PROTECT,
        related_name="cobrancas",
        verbose_name="competência",
    )
    asaas_payment_id = models.CharField(
        "ID da cobrança no Asaas", max_length=50, unique=True
    )
    asaas_installment_id = models.CharField(
        "ID do parcelamento no Asaas",
        max_length=50,
        null=True,
        blank=True,
        db_index=True,
    )  # Cartão parcelado
    asaas_subscription_id = models.CharField(
        "ID da assinatura no Asaas",
        max_length=50,
        null=True,
        blank=True,
        db_index=True,
    )  # Cartão recorrente
    tipo_cobranca = models.CharField(
        "tipo de cobrança", max_length=20, choices=TipoCobranca.choices
    )
    status = models.CharField(
        "status", max_length=30, choices=Status.choices, default=Status.PENDING
    )
    valor = models.DecimalField("valor", max_digits=10, decimal_places=2)
    valor_liquido = models.DecimalField(
        "valor líquido",
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )  # netValue, após taxas
    valor_pago = models.DecimalField(
        "valor pago", max_digits=10, decimal_places=2, null=True, blank=True
    )
    data_vencimento = models.DateField("data de vencimento")
    data_pagamento = models.DateField("data de pagamento", null=True, blank=True)
    nro_parcela = models.PositiveSmallIntegerField(
        "número da parcela", null=True, blank=True
    )
    descricao = models.CharField(
        "descrição", max_length=500, null=True, blank=True
    )  # Mensagem enviada no boleto
    invoice_url = models.URLField("link da fatura", null=True, blank=True)
    boleto_url = models.URLField("link do boleto", null=True, blank=True)
    pix_copia_cola = models.TextField("PIX copia e cola", null=True, blank=True)
    payload = models.JSONField(
        "retorno do Asaas", default=dict, blank=True
    )  # Último retorno bruto do Asaas
    data_criacao = models.DateTimeField("data de criação", auto_now_add=True)
    data_atualizacao = models.DateTimeField("data de atualização", auto_now=True)

    class Meta:
        verbose_name = "cobrança"
        verbose_name_plural = "cobranças"
        ordering = ("data_vencimento", "nro_parcela")

    def __str__(self):
        parcela = f" - parcela {self.nro_parcela}" if self.nro_parcela else ""
        return f"{self.get_tipo_cobranca_display()} {self.asaas_payment_id}{parcela} ({self.get_status_display()})"


def caminho_comprovante(instance, filename):
    """Organiza os comprovantes por competência e evita colisão de nomes."""
    return f"cobranca/comprovantes/{instance.competencia_id}/{uuid4()}_{filename}"


class RecebimentoExterno(models.Model):
    """
    Pagamento feito fora do Asaas (ex.: PIX direto na conta). Exige comprovante anexado.
    Se havia cobrança aberta no Asaas, ela deve ser baixada (receiveInCash) e vinculada aqui.
    """

    class FormaPagamento(models.TextChoices):
        PIX_DIRETO = "pix_direto", "PIX Direto"
        TRANSFERENCIA = "transferencia", "Transferência Bancária"
        DINHEIRO = "dinheiro", "Dinheiro"
        OUTRO = "outro", "Outro"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    competencia = models.ForeignKey(
        Competencia,
        on_delete=models.PROTECT,
        related_name="recebimentos_externos",
        verbose_name="competência",
    )
    cobranca = models.ForeignKey(
        Cobranca,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recebimentos_externos",
        verbose_name="cobrança baixada",
    )  # Cobrança do Asaas baixada por este recebimento
    forma_pagamento = models.CharField(
        "forma de pagamento",
        max_length=20,
        choices=FormaPagamento.choices,
        default=FormaPagamento.PIX_DIRETO,
    )
    valor = models.DecimalField("valor", max_digits=10, decimal_places=2)
    data_pagamento = models.DateField("data de pagamento")
    comprovante = models.FileField(
        "comprovante", upload_to=caminho_comprovante
    )  # Obrigatório
    registrado_por = models.ForeignKey(
        "usuario.Usuario",
        on_delete=models.PROTECT,
        related_name="recebimentos_externos_registrados",
        verbose_name="registrado por",
    )
    observacao = models.TextField("observação", null=True, blank=True)
    data_criacao = models.DateTimeField("data de criação", auto_now_add=True)
    data_atualizacao = models.DateTimeField("data de atualização", auto_now=True)

    class Meta:
        verbose_name = "recebimento externo"
        verbose_name_plural = "recebimentos externos"
        constraints = (
            models.CheckConstraint(
                condition=~models.Q(comprovante=""),
                name="recebimento_externo_com_comprovante",
            ),
            models.CheckConstraint(
                condition=models.Q(valor__gt=0),
                name="recebimento_externo_valor_positivo",
            ),
        )

    def __str__(self):
        return f"{self.get_forma_pagamento_display()} - R$ {self.valor} em {self.data_pagamento:%d/%m/%Y}"


class WebhookAsaas(models.Model):
    """
    Log bruto dos webhooks recebidos do Asaas, para auditoria e reprocessamento.
    """

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    asaas_event_id = models.CharField(
        "ID do evento no Asaas", max_length=100, unique=True
    )  # Idempotência
    evento = models.CharField("evento", max_length=50)  # Ex.: PAYMENT_RECEIVED
    cobranca = models.ForeignKey(
        Cobranca,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="webhooks",
        verbose_name="cobrança",
    )
    payload = models.JSONField("conteúdo")
    processado = models.BooleanField("processado", default=False)
    erro = models.TextField("erro", null=True, blank=True)
    data_recebimento = models.DateTimeField("data de recebimento", auto_now_add=True)

    class Meta:
        verbose_name = "webhook do Asaas"
        verbose_name_plural = "webhooks do Asaas"
        ordering = ("-data_recebimento",)

    def __str__(self):
        return f"{self.evento} - {self.asaas_event_id}"

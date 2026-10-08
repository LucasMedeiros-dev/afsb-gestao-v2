from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from apps.utils.validacoes import validar_cpf
from uuid import uuid4


class Usuario(AbstractUser):
    """
    Usuário do sistema: administradores da AFSB e franqueados (associados).
    Franqueado novo entra como "aguardando validação" até ser aprovado (ver AprovacaoCadastro).
    """
    class Cargos(models.TextChoices):
        ADMIN = 'admin', 'Administrador'
        FRANQUEADO = 'franqueado', 'Franqueado'

    class Status(models.TextChoices):
        AGUARDANDO_VALIDACAO = 'aguardando_validacao', 'Aguardando Validação'
        VALIDACAO_RECUSADA = 'validacao_recusada', 'Validação Recusada'
        ATIVO = 'ativo', 'Ativo'
        INATIVO = 'inativo', 'Inativo'
        BLOQUEADO = 'bloqueado', 'Bloqueado'

    class TipoComunicacao(models.TextChoices):
        WHATSAPP = 'whatsapp', 'WhatsApp'
        EMAIL = 'email', 'Email'
        WHATSAPP_EMAIL = 'whatsapp_email', 'WhatsApp e Email'

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    nro_associado = models.PositiveIntegerField('número de associado', unique=True, null=True, blank=True) # Número de associado, portado do excel
    email = models.EmailField('e-mail', unique=True)
    cargo = models.CharField('cargo', max_length=20, choices=Cargos.choices, default=Cargos.FRANQUEADO)
    whatsapp = models.CharField('WhatsApp', max_length=20, validators=[RegexValidator(r'^\+\d{2}\d{2}9\d{8}$', message="Numero de telefone invalido")])
    cpf = models.CharField('CPF', max_length=14, validators=[validar_cpf], unique=True)
    tipo_comunicacao = models.CharField('tipo de comunicação', max_length=20, choices=TipoComunicacao.choices, default=TipoComunicacao.WHATSAPP_EMAIL)
    status = models.CharField('status', max_length=20, choices=Status.choices, default=Status.AGUARDANDO_VALIDACAO)
    data_admissao = models.DateField('data de admissão', null=True, blank=True)

    # Login por e-mail (inclusive no obtain token do DRF); username segue obrigatório.
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = 'usuário'
        verbose_name_plural = 'usuários'

    def save(self, *args, **kwargs):
        # Acesso ao painel/API de admin é por is_staff; cargo + status são a fonte da
        # verdade. Admin inativo/bloqueado perde o painel na hora (mesmo com token).
        self.is_staff = self.is_superuser or (self.cargo == self.Cargos.ADMIN and self.status == self.Status.ATIVO)
        super().save(*args, **kwargs)

    def __str__(self):
        nome = self.get_full_name() or self.email
        return f"{nome} (nº {self.nro_associado})" if self.nro_associado else nome


class AprovacaoCadastro(models.Model):
    """
    Histórico de aprovações/recusas de cadastro. Recusa é indicada pelo preenchimento de motivo_recusa.
    """
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='aprovacoes', verbose_name='usuário')
    aprovado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name='aprovacoes_realizadas', verbose_name='avaliado por')
    data_aprovacao = models.DateTimeField('data da avaliação', auto_now_add=True)
    motivo_recusa = models.TextField('motivo da recusa', null=True, blank=True)

    class Meta:
        verbose_name = 'aprovação de cadastro'
        verbose_name_plural = 'aprovações de cadastro'
        ordering = ['-data_aprovacao']

    def __str__(self):
        acao = 'Recusa' if self.motivo_recusa else 'Aprovação'
        return f"{acao} de {self.usuario.email} por {self.aprovado_por.email if self.aprovado_por else 'N/A'}"


class MotivoDesativacao(models.Model):
    """
    Catálogo de motivos usados ao desativar um usuário.
    """
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    motivo = models.CharField('motivo', max_length=100)
    criado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name='motivos_criados', verbose_name='criado por')
    atualizado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name='motivos_atualizados', verbose_name='atualizado por')
    data_atualizacao = models.DateTimeField('data de atualização', auto_now=True)
    data_criacao = models.DateTimeField('data de criação', auto_now_add=True)

    class Meta:
        verbose_name = 'motivo de desativação'
        verbose_name_plural = 'motivos de desativação'
        ordering = ['motivo']

    def __str__(self):
        return self.motivo

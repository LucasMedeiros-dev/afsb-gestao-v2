import re

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from apps.franquia.models import Franquia

from .models import AprovacaoCadastro, Usuario


def dados_sessao(usuario):
    """O que o front guarda do usuário logado (login e /me)."""
    return {
        'id': str(usuario.id),
        'nome': usuario.get_full_name() or usuario.email,
        'email': usuario.email,
        'cargo': usuario.cargo,
        'admin': usuario.is_staff,
    }


class UsuarioSerializer(serializers.ModelSerializer):
    """
    Cadastro de associados/admins pelo painel. Não mexe em senha: usuário novo
    nasce com senha inutilizável (primeiro acesso será tratado à parte).
    """
    nome = serializers.SerializerMethodField()
    franquias = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Franquia.objects.all(), required=False
    )
    lojas = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = (
            'id', 'nro_associado', 'nome', 'first_name', 'last_name', 'email', 'cpf',
            'whatsapp', 'cargo', 'status', 'tipo_comunicacao', 'data_admissao',
            'franquias', 'lojas', 'date_joined', 'last_login',
        )
        read_only_fields = ('date_joined', 'last_login')

    def get_nome(self, obj):
        return obj.get_full_name() or obj.email

    def get_lojas(self, obj):
        return [f.nro_da_loja for f in obj.franquias.all()]

    def validate_email(self, valor):
        return valor.strip().lower()

    def create(self, dados):
        franquias = dados.pop('franquias', [])
        usuario = Usuario(username=dados['email'], **dados)
        usuario.set_unusable_password()
        usuario.save()
        usuario.franquias.set(franquias)
        return usuario

    def update(self, usuario, dados):
        franquias = dados.pop('franquias', None)
        for campo, valor in dados.items():
            setattr(usuario, campo, valor)
        if 'email' in dados:
            usuario.username = dados['email']
        usuario.save()
        if franquias is not None:
            usuario.franquias.set(franquias)
        return usuario


class MeusDadosSerializer(serializers.ModelSerializer):
    """O que o associado vê de si mesmo (somente leitura)."""
    nome = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display')
    tipo_comunicacao_display = serializers.CharField(source='get_tipo_comunicacao_display')
    qtd_lojas = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = (
            'nome', 'email', 'cpf', 'whatsapp', 'nro_associado', 'status', 'status_display',
            'tipo_comunicacao_display', 'data_admissao', 'qtd_lojas',
        )
        read_only_fields = fields

    def get_nome(self, obj):
        return obj.get_full_name() or obj.email

    def get_qtd_lojas(self, obj):
        return obj.franquias.count()


class PreCadastroSerializer(serializers.Serializer):
    """Auto cadastro da landing: nasce aguardando validação da diretoria."""
    nome = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    whatsapp = serializers.CharField()
    cpf = serializers.CharField()
    senha = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, valor):
        valor = valor.strip().lower()
        if Usuario.objects.filter(email__iexact=valor).exists():
            raise serializers.ValidationError(
                'Este e-mail já tem cadastro. Se você já é associado, fale com a AFSB para liberar o acesso.'
            )
        return valor

    def validate_whatsapp(self, valor):
        d = re.sub(r'\D', '', valor)
        d = d[2:] if len(d) == 13 and d.startswith('55') else d
        if not re.fullmatch(r'\d{2}9\d{8}', d):
            raise serializers.ValidationError('Informe o celular com DDD, ex.: (11) 99999-8888.')
        return f'+55{d}'

    def validate_cpf(self, valor):
        d = re.sub(r'\D', '', valor)
        cpf = f'{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}' if len(d) == 11 else valor
        try:
            Usuario._meta.get_field('cpf').run_validators(cpf)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages) from e
        if Usuario.objects.filter(cpf=cpf).exists():
            raise serializers.ValidationError('CPF já cadastrado. Fale com a AFSB para liberar o acesso.')
        return cpf

    def validate(self, dados):
        primeiro, _, resto = dados['nome'].strip().partition(' ')
        dados['first_name'], dados['last_name'] = primeiro, resto
        try:
            validate_password(dados['senha'], Usuario(email=dados['email'], first_name=primeiro, last_name=resto))
        except DjangoValidationError as e:
            raise serializers.ValidationError({'senha': e.messages}) from e
        return dados

    def create(self, dados):
        usuario = Usuario(
            username=dados['email'], email=dados['email'], first_name=dados['first_name'][:150],
            last_name=dados['last_name'][:150], whatsapp=dados['whatsapp'], cpf=dados['cpf'],
            status=Usuario.Status.AGUARDANDO_VALIDACAO, cargo=Usuario.Cargos.FRANQUEADO,
        )
        usuario.set_password(dados['senha'])
        usuario.save()
        return usuario


class PendenteSerializer(serializers.ModelSerializer):
    nome = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ('id', 'nome', 'email', 'cpf', 'whatsapp', 'status', 'nro_associado', 'date_joined')

    def get_nome(self, obj):
        return obj.get_full_name() or obj.email


class DecisaoSerializer(serializers.ModelSerializer):
    usuario = PendenteSerializer(read_only=True)
    aprovado_por_nome = serializers.SerializerMethodField()
    aprovado = serializers.SerializerMethodField()

    class Meta:
        model = AprovacaoCadastro
        fields = ('id', 'usuario', 'aprovado', 'motivo_recusa', 'data_aprovacao', 'aprovado_por_nome')

    def get_aprovado(self, obj):
        return not obj.motivo_recusa

    def get_aprovado_por_nome(self, obj):
        if not obj.aprovado_por:
            return None
        return obj.aprovado_por.get_full_name() or obj.aprovado_por.email


class AprovarSerializer(serializers.Serializer):
    nro_associado = serializers.IntegerField(required=False, allow_null=True, min_value=1)

    def validate_nro_associado(self, valor):
        if valor and Usuario.objects.filter(nro_associado=valor).exists():
            raise serializers.ValidationError(f'Nº {valor} já pertence a outro associado.')
        return valor


class ReprovarSerializer(serializers.Serializer):
    motivo = serializers.CharField(min_length=3)


def hoje():
    return timezone.localdate()

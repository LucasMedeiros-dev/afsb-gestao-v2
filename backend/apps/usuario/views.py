from apps.utils.custom_permissions import DonoDoCadastro
from django.db import transaction
from django.db.models import Max
from rest_framework import filters, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import AprovacaoCadastro, Usuario
from .serializers import (
    AprovarSerializer,
    DecisaoSerializer,
    MeusDadosSerializer,
    PendenteSerializer,
    PreCadastroSerializer,
    ReprovarSerializer,
    UsuarioSerializer,
    dados_sessao,
    hoje,
)
from .ver_como import usuario_alvo


class LoginView(ObtainAuthToken):
    """
    Obtain token do DRF (body: username=<e-mail>, password). Só acrescenta a
    checagem de status do cadastro e devolve os dados básicos do usuário.
    """
    # Sem sessão: um admin logado no Django admin não pode tropeçar no CSRF aqui.
    authentication_classes = ()
    permission_classes = ()
    # Contra tentativa de senha em massa.
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.validated_data['user']

        if not usuario.is_superuser and usuario.status != Usuario.Status.ATIVO:
            return Response(
                {
                    'detail': f'Cadastro {usuario.get_status_display().lower()}.',
                    'code': 'acesso_pendente',
                    'status': usuario.status,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        token, _ = Token.objects.get_or_create(user=usuario)
        return Response({'token': token.key, 'usuario': dados_sessao(usuario)})


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(dados_sessao(request.user))


class PreCadastroView(APIView):
    """Pré-cadastro público (landing). O acesso só libera após aprovação do admin."""
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'cadastro'

    def post(self, request):
        dados = PreCadastroSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        dados.save()
        return Response({'detail': 'Pré-cadastro recebido.'}, status=status.HTTP_201_CREATED)


class MeusDadosView(APIView):
    permission_classes = (DonoDoCadastro,)

    def get(self, request):
        return Response(MeusDadosSerializer(usuario_alvo(request)).data)

    def patch(self, request):
        self.check_object_permissions(request, request.user)
        dados = MeusDadosSerializer(request.user, data=request.data, partial=True)
        dados.is_valid(raise_exception=True)
        dados.save()
        return Response(dados.data)


class UsuarioViewSet(viewsets.ModelViewSet):
    """Associados e administradores (somente staff)."""
    queryset = Usuario.objects.prefetch_related('franquias').order_by('first_name', 'last_name')
    serializer_class = UsuarioSerializer
    filter_backends = (filters.SearchFilter,)
    search_fields = ('first_name', 'last_name', 'email', 'cpf', '=nro_associado', 'franquias__cnpj')

    def get_queryset(self):
        qs = super().get_queryset()
        for campo in ('status', 'cargo'):
            if valor := self.request.query_params.get(campo):
                qs = qs.filter(**{campo: valor})
        return qs.distinct()

    # ---------- aprovação do pré-cadastro ----------

    @action(detail=False)
    def aprovacoes(self, request):
        pendentes = Usuario.objects.filter(status=Usuario.Status.AGUARDANDO_VALIDACAO).order_by('date_joined')
        decisoes = AprovacaoCadastro.objects.select_related('usuario', 'aprovado_por')[:30]
        return Response({
            'pendentes': PendenteSerializer(pendentes, many=True).data,
            'decisoes': DecisaoSerializer(decisoes, many=True).data,
            'proximo_nro': (Usuario.objects.aggregate(m=Max('nro_associado'))['m'] or 0) + 1,
        })

    def _decidir(self, request, serializer_cls, aplicar):
        usuario = self.get_object()
        if usuario.status != Usuario.Status.AGUARDANDO_VALIDACAO:
            return Response({'detail': 'Este cadastro já foi avaliado.'}, status=status.HTTP_400_BAD_REQUEST)
        dados = serializer_cls(data=request.data)
        dados.is_valid(raise_exception=True)
        with transaction.atomic():
            motivo = aplicar(usuario, dados.validated_data)
            usuario.save()
            AprovacaoCadastro.objects.create(usuario=usuario, aprovado_por=request.user, motivo_recusa=motivo)
        return Response(UsuarioSerializer(usuario).data)

    @action(detail=True, methods=['post'])
    def aprovar(self, request, pk=None):
        def aplicar(usuario, dados):
            usuario.status = Usuario.Status.ATIVO
            usuario.nro_associado = dados.get('nro_associado') or usuario.nro_associado
            usuario.data_admissao = usuario.data_admissao or hoje()
            return None
        return self._decidir(request, AprovarSerializer, aplicar)

    @action(detail=True, methods=['post'])
    def reprovar(self, request, pk=None):
        def aplicar(usuario, dados):
            usuario.status = Usuario.Status.VALIDACAO_RECUSADA
            return dados['motivo']
        return self._decidir(request, ReprovarSerializer, aplicar)

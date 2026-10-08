from collections import Counter
from urllib.error import URLError

from django.db.models import Count
from rest_framework import filters, generics, status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.usuario.ver_como import usuario_alvo
from apps.utils.custom_permissions import AssociadoAtivo

from . import opencnpj
from .models import Franquia
from .serializers import FranquiaSerializer, MinhaFranquiaSerializer


class FranquiaViewSet(viewsets.ModelViewSet):
    """
    Lojas (somente staff: CNPJ, endereço e sócios não são públicos).
    """
    queryset = Franquia.objects.prefetch_related('usuarios')
    serializer_class = FranquiaSerializer
    filter_backends = (filters.SearchFilter,)
    search_fields = (
        '=nro_da_loja', 'cnpj', 'razao_social', 'nome_fantasia', 'cidade', 'estado',
        'usuarios__first_name', 'usuarios__last_name',
    )

    def get_queryset(self):
        qs = super().get_queryset()
        if uf := self.request.query_params.get('estado'):
            qs = qs.filter(estado__iexact=uf)
        return qs.distinct()


class MinhasFranquiasView(generics.ListAPIView):
    """Lojas do associado logado."""
    serializer_class = MinhaFranquiaSerializer
    permission_classes = (AssociadoAtivo,)
    pagination_class = None

    def get_queryset(self):
        return usuario_alvo(self.request).franquias.prefetch_related('usuarios')


class ConsultaCnpjView(APIView):
    """Preenche o formulário de franquia a partir do OpenCNPJ."""

    def get(self, request, cnpj):
        try:
            return Response(opencnpj.consultar(cnpj))
        except opencnpj.CnpjNaoEncontrado:
            return Response({'detail': 'CNPJ não encontrado na Receita.'}, status=status.HTTP_404_NOT_FOUND)
        except (URLError, TimeoutError):
            return Response({'detail': 'OpenCNPJ indisponível. Preencha manualmente.'},
                            status=status.HTTP_502_BAD_GATEWAY)


class LojasPorEstadoView(APIView):
    """
    Total de lojas por UF para o mapa da landing. Público: expõe só a contagem,
    nenhum dado cadastral da franquia.
    """
    permission_classes = (AllowAny,)

    def get(self, request):
        totais = Counter()
        for linha in Franquia.objects.values('estado').annotate(lojas=Count('id')):
            # UF digitada à mão: normaliza para não dividir "sp" e "SP".
            uf = (linha['estado'] or '').strip().upper()
            if uf:
                totais[uf] += linha['lojas']
        return Response([{'uf': uf, 'lojas': n} for uf, n in sorted(totais.items())])

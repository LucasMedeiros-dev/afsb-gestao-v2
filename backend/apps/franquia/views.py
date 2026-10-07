from collections import Counter

from django.db.models import Count
from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Franquia
from .serializers import FranquiaSerializer


class FranquiaViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows franquias to be viewed or edited.
    """
    queryset = Franquia.objects.all()
    serializer_class = FranquiaSerializer


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

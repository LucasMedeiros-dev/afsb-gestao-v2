from rest_framework import filters, viewsets

from apps.utils.custom_permissions import AdminOrReadOnly

from .models import Parceiro
from .serializers import ParceiroSerializer


class ParceiroViewSet(viewsets.ModelViewSet):
    queryset = Parceiro.objects.all()
    serializer_class = ParceiroSerializer
    filter_backends = (filters.SearchFilter,)
    search_fields = ('nome', 'beneficios', 'contato')
    permission_classes = (AdminOrReadOnly,)
from rest_framework import filters, viewsets

from apps.utils.custom_permissions import AdminOrReadOnly

from .models import Membro
from .serializers import MembroSerializer


class MembroViewSet(viewsets.ModelViewSet):
    queryset = Membro.objects.all()
    serializer_class = MembroSerializer
    filter_backends = (filters.SearchFilter,)
    search_fields = ('nome', 'titulo')
    permission_classes = (AdminOrReadOnly,)
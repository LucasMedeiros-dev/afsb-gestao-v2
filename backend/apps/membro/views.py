from rest_framework import viewsets

from apps.utils.custom_permissions import AdminOrReadOnly

from .models import Membro
from .serializers import MembroSerializer


class MembroViewSet(viewsets.ModelViewSet):
    queryset = Membro.objects.all()
    serializer_class = MembroSerializer
    permission_classes = (AdminOrReadOnly,)
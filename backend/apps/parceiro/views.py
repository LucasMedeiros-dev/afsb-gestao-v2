from rest_framework import viewsets

from apps.utils.custom_permissions import AdminOrReadOnly

from .models import Parceiro
from .serializers import ParceiroSerializer


class ParceiroViewSet(viewsets.ModelViewSet):
    queryset = Parceiro.objects.all()
    serializer_class = ParceiroSerializer
    permission_classes = (AdminOrReadOnly,)
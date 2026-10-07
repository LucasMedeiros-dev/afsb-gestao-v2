from rest_framework import viewsets

from apps.utils.custom_permissions import AdminOrReadOnly

from .models import Noticia
from .serializers import NoticiaSerializer


class NoticiaViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows notícias to be viewed or edited.
    """
    queryset = Noticia.objects.all()
    serializer_class = NoticiaSerializer
    permission_classes = (AdminOrReadOnly,)

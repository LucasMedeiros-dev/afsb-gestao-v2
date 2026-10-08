from rest_framework import filters, viewsets

from apps.utils.custom_permissions import AdminOrReadOnly

from .models import Noticia
from .serializers import NoticiaSerializer


class NoticiaViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows notícias to be viewed or edited.
    """
    queryset = Noticia.objects.all()
    serializer_class = NoticiaSerializer
    filter_backends = (filters.SearchFilter,)
    search_fields = ('titulo', 'subtitulo')
    permission_classes = (AdminOrReadOnly,)

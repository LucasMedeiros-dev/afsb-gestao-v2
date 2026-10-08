from rest_framework import filters, viewsets

from apps.utils.custom_permissions import AdminOrReadOnly

from .models import Evento
from .serializers import EventoSerializer


class EventoViewSet(viewsets.ModelViewSet):
    queryset = Evento.objects.all()
    serializer_class = EventoSerializer
    filter_backends = (filters.SearchFilter,)
    search_fields = ('titulo',)
    permission_classes = (AdminOrReadOnly,)
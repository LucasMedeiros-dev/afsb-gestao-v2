from rest_framework import viewsets

from apps.utils.custom_permissions import AdminOrReadOnly

from .models import Evento
from .serializers import EventoSerializer


class EventoViewSet(viewsets.ModelViewSet):
    queryset = Evento.objects.all()
    serializer_class = EventoSerializer
    permission_classes = (AdminOrReadOnly,)
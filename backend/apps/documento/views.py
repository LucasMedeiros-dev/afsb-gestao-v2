from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Documento
from .serializers import DocumentoSerializer


class DocumentoViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated,)
    queryset = Documento.objects.all()
    serializer_class = DocumentoSerializer
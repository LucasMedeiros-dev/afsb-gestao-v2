from rest_framework import filters, viewsets
from apps.utils.custom_permissions import AdminOrMemberReadOnly

from .models import Documento
from .serializers import DocumentoSerializer


class DocumentoViewSet(viewsets.ModelViewSet):
    permission_classes = (AdminOrMemberReadOnly,)
    queryset = Documento.objects.all()
    serializer_class = DocumentoSerializer
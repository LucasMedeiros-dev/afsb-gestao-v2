from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import FranquiaViewSet, LojasPorEstadoView

router = DefaultRouter()

router.register(r"", FranquiaViewSet, basename="franquia")

# Antes do router: senão "por-estado" casa como pk do detalhe.
urlpatterns = [
    path("por-estado/", LojasPorEstadoView.as_view(), name="franquia-por-estado"),
] + router.urls

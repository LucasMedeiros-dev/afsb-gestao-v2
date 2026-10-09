from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ConsultaCnpjView, FranquiaViewSet, LojasPorEstadoView, MinhaFranquiaView, MinhasFranquiasView

router = DefaultRouter()

router.register(r"", FranquiaViewSet, basename="franquia")

# Antes do router: senão "por-estado" casa como pk do detalhe.
urlpatterns = [
    path("por-estado/", LojasPorEstadoView.as_view(), name="franquia-por-estado"),
    path("minhas/", MinhasFranquiasView.as_view(), name="franquia-minhas"),
    path("minhas/<uuid:pk>/", MinhaFranquiaView.as_view(), name="franquia-minha"),
    path("consulta-cnpj/<str:cnpj>/", ConsultaCnpjView.as_view(), name="franquia-consulta-cnpj"),
] + router.urls

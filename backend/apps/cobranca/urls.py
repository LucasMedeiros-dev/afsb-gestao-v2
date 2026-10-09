from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CompetenciaViewSet,
    DashboardView,
    MinhasCompetenciasViewSet,
    PerfilCobrancaViewSet,
    TabelaValorViewSet,
)

router = DefaultRouter()
router.register(r"perfis", PerfilCobrancaViewSet, basename="perfil-cobranca")
router.register(r"competencias", CompetenciaViewSet, basename="competencia")
router.register(r"tabela", TabelaValorViewSet, basename="tabela-valor")
router.register(r"minhas", MinhasCompetenciasViewSet, basename="minha-competencia")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="cobranca-dashboard"),
] + router.urls

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import LoginView, LogoutView, MeusDadosView, MeView, PreCadastroView, UsuarioViewSet

router = DefaultRouter()
router.register(r"", UsuarioViewSet, basename="usuario")

# Antes do router: senão "login"/"me" casam como pk do detalhe.
urlpatterns = [
    path("login/", LoginView.as_view(), name="usuario-login"),
    path("logout/", LogoutView.as_view(), name="usuario-logout"),
    path("cadastro/", PreCadastroView.as_view(), name="usuario-cadastro"),
    path("me/", MeView.as_view(), name="usuario-me"),
    path("me/dados/", MeusDadosView.as_view(), name="usuario-me-dados"),
] + router.urls

from rest_framework.routers import DefaultRouter

from .views import NoticiaViewSet

APP_NAME = "noticia"

router = DefaultRouter()

router.register(r"", NoticiaViewSet, basename="noticia")

urlpatterns = router.urls

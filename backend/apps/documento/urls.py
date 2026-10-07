from rest_framework.routers import DefaultRouter

from apps.documento.views import DocumentoViewSet

APP_NAME = 'documento'

router = DefaultRouter()

router.register(r'', DocumentoViewSet, basename='documento')

urlpatterns = router.urls

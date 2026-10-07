from rest_framework.routers import DefaultRouter

from .views import MembroViewSet

router = DefaultRouter()

router.register(r"", MembroViewSet, basename="membro")

urlpatterns = router.urls

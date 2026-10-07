# Sistema de permissões customizado para usuários
# 1. Admin or Read-Only

from rest_framework.permissions import SAFE_METHODS, BasePermission


class AdminOrReadOnly(BasePermission):
    """
    Permissão customizada que permite acesso total a administradores e apenas leitura para outros usuários.
    Utilizada em 
    - Noticia
    - Evento
    - Membro
    - Parceiro
    """
    def has_permission(self, request, view):
        # Permite apenas métodos de leitura (GET, HEAD, OPTIONS) para outros usuários (até mesmo não autenticados)
        if request.method in SAFE_METHODS:
            return True
        # Permite acesso total se o usuário for administrador
        return bool(request.user and request.user.is_staff)
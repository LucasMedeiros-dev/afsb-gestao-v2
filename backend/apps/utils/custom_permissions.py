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

class AdminOrMemberReadOnly(BasePermission):
    """
    Permissão customizada que permite acesso total a administradores e apenas leitura para membros.
    Utilizada em 
    - Documento
    """
    def has_permission(self, request, view):
        # Leitura (GET, HEAD, OPTIONS) só para membro com cadastro ativo: o token
        # emitido antes de um bloqueio não pode continuar abrindo os documentos.
        if request.method in SAFE_METHODS:
            usuario = request.user
            return bool(usuario and usuario.is_authenticated and (usuario.is_staff or usuario.status == 'ativo'))
        # Permite acesso total se o usuário for administrador
        return bool(request.user and request.user.is_staff)

class AssociadoAtivo(BasePermission):
    """
    Área do associado: usuário logado com cadastro ativo (staff sempre passa).
    O token sobrevive a um bloqueio posterior; esta checagem não.
    Utilizada em
    - Meus dados, minhas franquias, minhas cobranças
    """
    message = 'Seu acesso está com uma pendência. Contate o suporte da AFSB.'

    def has_permission(self, request, view):
        usuario = request.user
        if not (usuario and usuario.is_authenticated):
            return False
        return usuario.is_staff or usuario.status == 'ativo'

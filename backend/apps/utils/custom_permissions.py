# Sistema de permissões customizado para usuários
# 1. Admin or Read-Only

from apps.franquia.models import Franquia
from apps.usuario.ver_como import vendo_como
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


class DonoDoCadastro(AssociadoAtivo):
    """
    Associado ativo lê e edita o próprio cadastro e as lojas em que é sócio.
    No "ver como" o admin só lê: a edição vale sempre para quem está logado.
    Utilizada em
    - Meus dados, minhas franquias
    """
    message = 'Você só pode alterar o seu próprio cadastro e as suas lojas.'

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.method in SAFE_METHODS or not vendo_como(request)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if isinstance(obj, Franquia):
            return obj.usuarios.filter(pk=request.user.pk).exists()
        return obj.pk == request.user.pk

"""
"Ver como associado": o admin consulta a área de um associado (extrato, lojas,
dados) mandando o header X-Ver-Como: <id>. Só leitura; ignorado para não-staff.
"""
import logging

from django.core.exceptions import ValidationError
from django.http import Http404

from .models import Usuario

log = logging.getLogger(__name__)
HEADER = 'HTTP_X_VER_COMO'


def vendo_como(request):
    return bool(request.META.get(HEADER)) and request.user.is_staff


def usuario_alvo(request):
    if not vendo_como(request):
        return request.user
    try:
        alvo = Usuario.objects.get(pk=request.META[HEADER])
    except (Usuario.DoesNotExist, ValidationError, ValueError) as e:
        raise Http404('Associado não encontrado.') from e
    log.info('%s consultou a área de %s (%s)', request.user.email, alvo.email, request.path)
    return alvo

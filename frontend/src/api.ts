/**
 * Leitura pública da API Django (AdminOrReadOnly). Tudo passa por /api,
 * que o nginx (prod) e o Vite (dev) repassam ao backend sem o prefixo.
 */
const BASE = '/api';

async function get<T>(caminho: string): Promise<T> {
  const resp = await fetch(`${BASE}${caminho}`, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`GET ${caminho}: ${resp.status}`);
  return resp.json() as Promise<T>;
}

export interface Parceiro {
  id: string;
  tipo: 'beneficio' | 'parceria';
  nome: string;
  beneficios: string | null;
  logo: string | null;
  site: string | null;
  contato: string | null;
}

export interface Membro {
  id: string;
  nome: string;
  titulo: string;
  foto: string | null;
  ordem: number;
}

export interface Noticia {
  id: string;
  titulo: string;
  subtitulo: string;
  texto: string;
  imagem: string | null;
  criado_em: string;
}

export interface Evento {
  id: string;
  titulo: string;
  data_hora: string;
}

export const parceiros = () => get<Parceiro[]>('/parceiro/');
export const membros = () => get<Membro[]>('/membro/');
export const noticias = () => get<Noticia[]>('/noticia/');
export const eventos = () => get<Evento[]>('/evento/');

export interface LojasPorEstado {
  uf: string;
  lojas: number;
}

export const lojasPorEstado = () => get<LojasPorEstado[]>('/franquia/por-estado/');

export interface Sessao {
  token: string;
  usuario: { id: string; nome: string; email: string; cargo: 'admin' | 'franqueado'; admin: boolean };
}

/** Credenciais certas, mas o cadastro não está ativo (aguardando, recusado, inativo, bloqueado). */
export class AcessoPendenteError extends Error {}

export async function login(email: string, senha: string): Promise<Sessao> {
  const resp = await fetch(`${BASE}/usuario/login/`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password: senha }),
  });
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (corpo.code === 'acesso_pendente') throw new AcessoPendenteError(corpo.detail);
    // 400 do DRF vem em non_field_errors.
    throw new Error(
      corpo.detail ?? corpo.non_field_errors?.[0] ?? 'Não foi possível entrar. Tente novamente.',
    );
  }
  return corpo as Sessao;
}

/** Erro de validação do pré-cadastro, por campo (geral quando não é de um campo). */
export class ErroCadastro extends Error {
  campos: Record<string, string>;

  constructor(campos: Record<string, string>) {
    super(Object.values(campos)[0] ?? 'Erro no cadastro');
    this.campos = campos;
  }
}

export async function preCadastro(dados: { nome: string; whatsapp: string; cpf: string; email: string; senha: string }) {
  const resp = await fetch(`${BASE}/usuario/cadastro/`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (resp.ok) return;
  const corpo = await resp.json().catch(() => ({}));
  if (resp.status === 429) throw new ErroCadastro({ geral: 'Muitas tentativas. Tente novamente mais tarde.' });
  const campos: Record<string, string> = {};
  for (const [k, v] of Object.entries(corpo as Record<string, unknown>)) {
    campos[k === 'detail' || k === 'non_field_errors' ? 'geral' : k] = Array.isArray(v) ? v.join(' ') : String(v);
  }
  throw new ErroCadastro(Object.keys(campos).length ? campos : { geral: 'Não foi possível enviar.' });
}

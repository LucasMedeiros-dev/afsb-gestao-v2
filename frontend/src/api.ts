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

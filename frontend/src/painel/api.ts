/**
 * Cliente da API para a área logada: manda o token, converte erros do DRF em
 * mensagem legível e derruba a sessão em 401.
 */
const BASE = '/api';
const CHAVE_TOKEN = 'afsb_token';
const CHAVE_USUARIO = 'afsb_usuario';

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
  cargo: 'admin' | 'franqueado';
  admin: boolean;
}

export const sessao = {
  token: () => localStorage.getItem(CHAVE_TOKEN),
  usuario: (): UsuarioSessao | null => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_USUARIO) ?? 'null');
    } catch {
      return null;
    }
  },
  salvar(token: string, usuario: UsuarioSessao) {
    localStorage.setItem(CHAVE_TOKEN, token);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
  },
  limpar() {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
  },
};

/**
 * "Ver como associado": o admin abre a área de um associado (só leitura). Fica no
 * sessionStorage (some ao fechar a aba) e só vale dentro de /area.
 */
const CHAVE_VER_COMO = 'afsb_ver_como';

export const verComo = {
  obter(): { id: string; nome: string } | null {
    if (!window.location.pathname.startsWith('/area')) return null;
    try {
      return JSON.parse(sessionStorage.getItem(CHAVE_VER_COMO) ?? 'null');
    } catch {
      return null;
    }
  },
  iniciar(id: string, nome: string) {
    sessionStorage.setItem(CHAVE_VER_COMO, JSON.stringify({ id, nome }));
    window.location.href = '/area';
  },
  encerrar(voltarPara = '/painel/associados') {
    sessionStorage.removeItem(CHAVE_VER_COMO);
    window.location.href = voltarPara;
  },
};

export class ErroApi extends Error {
  status: number;
  campos: Record<string, string>;

  constructor(status: number, mensagem: string, campos: Record<string, string> = {}) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

/** {"cpf": ["CPF inválido"], "non_field_errors": [...]} -> mensagem + erros por campo. */
function lerErros(status: number, corpo: unknown): ErroApi {
  if (corpo && typeof corpo === 'object' && !Array.isArray(corpo)) {
    const obj = corpo as Record<string, unknown>;
    if (typeof obj.detail === 'string') return new ErroApi(status, obj.detail);
    const campos: Record<string, string> = {};
    for (const [campo, valor] of Object.entries(obj)) {
      campos[campo] = Array.isArray(valor) ? valor.join(' ') : String(valor);
    }
    const geral = campos.non_field_errors ?? Object.values(campos)[0];
    return new ErroApi(status, geral ?? 'Verifique os campos destacados.', campos);
  }
  if (Array.isArray(corpo)) return new ErroApi(status, corpo.join(' '));
  return new ErroApi(status, `Erro ${status} ao falar com o servidor.`);
}

export async function req<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = sessao.token();
  if (token) headers.Authorization = `Token ${token}`;
  const alvo = verComo.obter();
  if (alvo) headers['X-Ver-Como'] = alvo.id;

  let body: BodyInit | undefined;
  if (corpo instanceof FormData) body = corpo;
  else if (corpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }

  const resp = await fetch(`${BASE}${caminho}`, { method: metodo, headers, body });
  if (resp.status === 401) {
    sessao.limpar();
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new ErroApi(401, 'Sessão expirada.');
  }
  if (resp.status === 204) return undefined as T;
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) throw lerErros(resp.status, dados);
  return dados as T;
}

export const get = <T>(caminho: string) => req<T>('GET', caminho);

/** Querystring sem os vazios. */
export function qs(params: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ---------- Tipos de cobrança ----------

export interface Cobranca {
  id: string;
  asaas_payment_id: string;
  tipo_cobranca: string;
  tipo_display: string;
  status: string;
  status_display: string;
  valor: string;
  data_vencimento: string;
  data_pagamento: string | null;
  invoice_url: string | null;
  boleto_url: string | null;
  pix_copia_cola: string | null;
  data_criacao: string;
}

export interface Recebimento {
  id: string;
  forma_pagamento: string;
  forma_display: string;
  valor: string;
  data_pagamento: string;
  comprovante: string;
  observacao: string | null;
  registrado_por_nome: string;
  data_criacao: string;
}

export type Situacao = 'aberta' | 'parcial' | 'paga' | 'vencida' | 'cancelada';

export interface Competencia {
  id: string;
  perfil: string;
  associado: { id: string; nome: string; nro: number | null; email: string; whatsapp: string };
  nome_pagador: string;
  documento: string;
  forma_pagamento: string;
  periodo: string;
  ano: number;
  mes: number | null;
  valor_cheio: string;
  valor_desconto: string | null;
  valor_pago: string;
  saldo: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  situacao: Situacao;
  cobranca: Cobranca | null;
  recebimentos: Recebimento[];
}

export interface Dashboard {
  referencia: { ano: number; mes: number };
  asaas_configurado: boolean;
  kpis: {
    previsto: string;
    recebido: string;
    a_vencer: string;
    vencido_mes: string;
    vencido_total: string;
    inadimplentes: number;
    associados_cobrados: number;
    competencias_mes: number;
    pagas_mes: number;
  };
  serie: { ano: number; mes: number; previsto: string; recebido: string }[];
  atrasados: {
    id: string;
    nome: string;
    nro: number | null;
    whatsapp: string;
    email: string;
    qtd: number;
    total: string;
    dias: number;
  }[];
  ultimos_pagamentos: {
    id: string;
    nome: string;
    periodo: string;
    valor: string;
    data: string;
    origem: 'Manual' | 'Asaas';
  }[];
}

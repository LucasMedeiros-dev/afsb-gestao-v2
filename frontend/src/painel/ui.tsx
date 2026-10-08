/**
 * Peças visuais do painel, nos tokens da landing (Material 3 do index.html).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

// ---------- navegação (sem router: pushState + popstate) ----------

export function navegar(caminho: string) {
  if (caminho === window.location.pathname + window.location.search) return;
  window.history.pushState(null, '', caminho);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useLocalizacao() {
  const ler = () => ({ caminho: window.location.pathname, busca: new URLSearchParams(window.location.search) });
  const [loc, setLoc] = useState(ler);
  useEffect(() => {
    const atualizar = () => setLoc(ler());
    window.addEventListener('popstate', atualizar);
    return () => window.removeEventListener('popstate', atualizar);
  }, []);
  return loc;
}

// ---------- formatação ----------

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BRL_CURTO = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export const moeda = (v: string | number | null | undefined) => BRL.format(Number(v ?? 0));
export const moedaCurta = (v: number) => (Math.abs(v) >= 10_000 ? `R$ ${BRL_CURTO.format(v)}` : moeda(v));

/** "2026-10-15" -> "15/10/2026" sem passar por Date (evita virar o dia por fuso). */
export function dataBR(iso: string | null | undefined) {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function dataHoraBR(iso: string | null | undefined) {
  if (!iso) return '—';
  return `${dataBR(iso)} ${iso.slice(11, 16)}`;
}

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function linkWhatsApp(numero: string, texto?: string) {
  const digitos = numero.replace(/\D/g, '');
  return `https://wa.me/${digitos}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

// ---------- dados ----------

/** Carrega na montagem e quando `deps` mudam; `recarregar` refaz sem piscar a tela. */
export function useCarregar<T>(carregar: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const versao = useRef(0);

  const executar = useCallback(() => {
    const atual = ++versao.current;
    setCarregando(true);
    carregar()
      .then((d) => {
        if (atual !== versao.current) return;
        setDados(d);
        setErro(null);
      })
      .catch((e: Error) => atual === versao.current && setErro(e.message))
      .finally(() => atual === versao.current && setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(executar, [executar]);
  return { dados, erro, carregando, recarregar: executar };
}

export function useAtraso<T>(valor: T, ms = 300) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

// ---------- componentes ----------

export function Icone({ nome, className = '' }: { nome: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined leading-none ${className}`}>
      {nome}
    </span>
  );
}

const VARIANTES = {
  primario:
    'text-on-primary bg-primary hover:bg-on-primary-fixed-variant shadow-[0_2px_4px_rgba(0,101,44,0.15)]',
  secundario: 'text-on-surface bg-surface-container-high hover:bg-surface-container-highest',
  fantasma: 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
  perigo: 'text-on-error bg-error hover:brightness-110',
} as const;

export function Botao({
  variante = 'secundario',
  icone,
  carregando,
  pequeno,
  children,
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof VARIANTES;
  icone?: string;
  carregando?: boolean;
  pequeno?: boolean;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-label-lg text-label-lg transition-all disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap ${
        pequeno ? 'px-3 py-1.5 text-label-md' : 'px-4 py-2.5'
      } ${VARIANTES[variante]} ${className}`}
      disabled={disabled || carregando}
      {...props}
    >
      {carregando ? (
        <Icone nome="progress_activity" className="text-[18px] animate-spin" />
      ) : icone ? (
        <Icone nome={icone} className="text-[18px]" />
      ) : null}
      {children}
    </button>
  );
}

const TONS = {
  sucesso: 'bg-primary-fixed text-on-primary-fixed-variant',
  alerta: 'bg-secondary-fixed text-on-secondary-fixed-variant',
  erro: 'bg-error-container text-on-error-container',
  info: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  neutro: 'bg-surface-container-high text-on-surface-variant',
} as const;

export type Tom = keyof typeof TONS;

export function Selo({ tom = 'neutro', icone, children }: { tom?: Tom; icone?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-label-sm text-label-sm whitespace-nowrap ${TONS[tom]}`}>
      {icone && <Icone nome={icone} className="text-[14px]" />}
      {children}
    </span>
  );
}

export const SITUACOES: Record<string, { rotulo: string; tom: Tom; icone: string }> = {
  aberta: { rotulo: 'Em aberto', tom: 'info', icone: 'schedule' },
  parcial: { rotulo: 'Parcial', tom: 'alerta', icone: 'contrast' },
  paga: { rotulo: 'Paga', tom: 'sucesso', icone: 'check_circle' },
  vencida: { rotulo: 'Vencida', tom: 'erro', icone: 'error' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutro', icone: 'block' },
};

export function SeloSituacao({ situacao }: { situacao: string }) {
  const s = SITUACOES[situacao] ?? { rotulo: situacao, tom: 'neutro' as Tom, icone: 'help' };
  return (
    <Selo tom={s.tom} icone={s.icone}>
      {s.rotulo}
    </Selo>
  );
}

export function Modal({
  titulo,
  subtitulo,
  onFechar,
  children,
  rodape,
  largura = 'max-w-lg',
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [onFechar]);

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div className={`w-full ${largura} max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-surface-container-lowest shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-outline-variant/40">
          <div className="min-w-0">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{subtitulo}</p>}
          </div>
          <button
            aria-label="Fechar"
            className="p-1.5 -mr-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container"
            onClick={onFechar}
            type="button"
          >
            <Icone nome="close" className="text-[22px]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {rodape && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-outline-variant/40">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}

export const CLASSE_INPUT =
  'w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-sm text-body-sm outline-none border border-transparent focus:bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-outline disabled:opacity-60';

export function Campo({
  rotulo,
  erro,
  ajuda,
  children,
  className = '',
  obrigatorio,
}: {
  rotulo: string;
  erro?: string;
  ajuda?: ReactNode;
  children: ReactNode;
  className?: string;
  obrigatorio?: boolean;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block mb-1 font-label-md text-label-md text-on-surface-variant">
        {rotulo}
        {obrigatorio && <span className="text-error"> *</span>}
      </span>
      {children}
      {erro ? (
        <span className="block mt-1 font-body-sm text-[0.8rem] text-error">{erro}</span>
      ) : ajuda ? (
        <span className="block mt-1 font-body-sm text-[0.8rem] text-outline">{ajuda}</span>
      ) : null}
    </label>
  );
}

export function Aviso({ tom = 'info', icone = 'info', children }: { tom?: Tom; icone?: string; children: ReactNode }) {
  return (
    <div className={`flex gap-3 rounded-xl px-4 py-3 font-body-sm text-body-sm ${TONS[tom]}`}>
      <Icone nome={icone} className="text-[20px] mt-px" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Vazio({ icone = 'inbox', titulo, children }: { icone?: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-14 px-6">
      <span className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-outline">
        <Icone nome={icone} className="text-[26px]" />
      </span>
      <p className="font-label-lg text-label-lg text-on-surface">{titulo}</p>
      {children && <div className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">{children}</div>}
    </div>
  );
}

export function Carregando({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="p-4 space-y-3" aria-busy="true">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="h-10 rounded-lg bg-surface-container animate-pulse" />
      ))}
    </div>
  );
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${className}`}>{children}</section>;
}

// ---------- toasts ----------

type Toast = { id: number; texto: string; tom: 'sucesso' | 'erro' };
const ToastCtx = createContext<(texto: string, tom?: Toast['tom']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const avisar = useCallback((texto: string, tom: Toast['tom'] = 'sucesso') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, texto, tom }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={avisar}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 items-end" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 max-w-sm rounded-xl px-4 py-3 shadow-lg font-body-sm text-body-sm ${
              t.tom === 'erro' ? 'bg-error text-on-error' : 'bg-inverse-surface text-inverse-on-surface'
            }`}
          >
            <Icone nome={t.tom === 'erro' ? 'error' : 'check_circle'} className="text-[18px]" />
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export async function copiar(texto: string, avisar: (t: string) => void, rotulo = 'Copiado') {
  try {
    await navigator.clipboard.writeText(texto);
    avisar(rotulo);
  } catch {
    window.prompt('Copie manualmente:', texto);
  }
}

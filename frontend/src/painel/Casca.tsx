/**
 * Casca da área logada (painel admin e área do associado): valida a sessão no
 * servidor, barra quem não pode entrar e desenha sidebar + conteúdo.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { get, req, sessao, type UsuarioSessao } from './api';
import { Botao, Icone, ToastProvider, Vazio, navegar, useLocalizacao } from './ui';

export interface ItemMenu {
  rota: string;
  rotulo: string;
  icone: string;
  /** Selo com contagem (ex.: cadastros aguardando aprovação). */
  contador?: number;
}

export interface GrupoMenu {
  grupo?: string;
  itens: ItemMenu[];
}

interface Props {
  base: string;
  titulo: string;
  menu: GrupoMenu[];
  permitido: (u: UsuarioSessao) => boolean;
  negado: ReactNode;
  /** Link extra no rodapé da sidebar (ex.: admin ir para a área do associado). */
  rodape?: (u: UsuarioSessao) => ReactNode;
  children: (rota: string, busca: URLSearchParams, usuario: UsuarioSessao) => ReactNode;
}

export default function Casca(props: Props) {
  const [usuario, setUsuario] = useState<UsuarioSessao | null | 'carregando'>(sessao.token() ? 'carregando' : null);

  useEffect(() => {
    document.title = `${props.titulo} | AFSB`;
    if (!sessao.token()) {
      window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    // Revalida no servidor: o localStorage pode estar velho (cargo mudou, token revogado).
    get<UsuarioSessao>('/usuario/me/')
      .then((u) => {
        sessao.salvar(sessao.token()!, u);
        setUsuario(u);
      })
      .catch(() => {
        sessao.limpar();
        window.location.replace('/login');
      });
  }, [props.titulo]);

  if (usuario === 'carregando' || usuario === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <Icone nome="progress_activity" className="text-[32px] text-primary animate-spin" />
      </div>
    );
  }
  if (!props.permitido(usuario)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low p-4">
        <div className="rounded-2xl bg-surface-container-lowest shadow-sm max-w-md w-full">
          <Vazio icone="lock" titulo="Acesso restrito">
            {props.negado}
            <div className="mt-4">
              <Botao onClick={() => (window.location.href = '/')}>Voltar ao site</Botao>
            </div>
          </Vazio>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <Layout {...props} usuario={usuario} />
    </ToastProvider>
  );
}

function Layout({ base, menu, rodape, children, usuario }: Props & { usuario: UsuarioSessao }) {
  const { caminho, busca } = useLocalizacao();
  const [menuAberto, setMenuAberto] = useState(false);
  const rota = caminho.slice(base.length).replace(/^\/|\/$/g, '');
  const atual = menu.flatMap((g) => g.itens).find((i) => i.rota === rota);

  const sair = async () => {
    await req('POST', '/usuario/logout/').catch(() => {});
    sessao.limpar();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-surface-container-low font-body-md text-body-md text-on-surface antialiased">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-surface-container-lowest border-r border-outline-variant/40 transition-transform lg:translate-x-0 ${
          menuAberto ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <a className="h-16 flex items-center px-5 shrink-0" href="/">
          <img alt="AFSB" className="h-7 w-auto" src="/afsb-logo.png" />
        </a>
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {menu.map((g, n) => (
            <div key={g.grupo ?? n}>
              {g.grupo && <p className="px-3 pb-1.5 font-label-sm text-label-sm uppercase tracking-wider text-outline">{g.grupo}</p>}
              <ul className="space-y-0.5">
                {g.itens.map((i) => {
                  const ativo = i.rota === rota;
                  return (
                    <li key={i.rota}>
                      <a
                        aria-current={ativo ? 'page' : undefined}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 font-label-lg text-label-lg transition-colors ${
                          ativo ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                        }`}
                        href={`${base}${i.rota ? `/${i.rota}` : ''}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey) return;
                          e.preventDefault();
                          setMenuAberto(false);
                          navegar(e.currentTarget.getAttribute('href')!);
                        }}
                      >
                        <Icone nome={i.icone} className={`text-[20px] ${ativo ? '' : 'text-outline'}`} />
                        <span className="flex-1">{i.rotulo}</span>
                        {!!i.contador && (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-error text-on-error text-[0.7rem] font-bold flex items-center justify-center">
                            {i.contador}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-outline-variant/40 p-3">
          {rodape?.(usuario)}
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="w-9 h-9 shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-lg text-label-lg">
              {usuario.nome.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-label-md text-label-md text-on-surface truncate">{usuario.nome}</p>
              <p className="font-body-sm text-[0.75rem] text-on-surface-variant truncate">{usuario.email}</p>
            </div>
            <button aria-label="Sair" className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-error" onClick={sair} title="Sair" type="button">
              <Icone nome="logout" className="text-[20px]" />
            </button>
          </div>
        </div>
      </aside>
      {menuAberto && <div className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setMenuAberto(false)} />}

      <div className="lg:pl-64">
        <header className="lg:hidden sticky top-0 z-20 h-14 flex items-center gap-3 px-4 bg-surface-container-lowest/90 backdrop-blur border-b border-outline-variant/40">
          <button aria-label="Abrir menu" className="p-2 -ml-2 rounded-lg hover:bg-surface-container" onClick={() => setMenuAberto(true)} type="button">
            <Icone nome="menu" className="text-[24px]" />
          </button>
          <span className="font-label-lg text-label-lg text-on-surface">{atual?.rotulo ?? ''}</span>
        </header>
        <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {atual ? children(rota, busca, usuario) : <Vazio icone="explore_off" titulo="Página não encontrada" />}
        </main>
      </div>
    </div>
  );
}

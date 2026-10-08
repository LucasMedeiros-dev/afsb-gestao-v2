import { useEffect, useState, type FormEvent } from 'react';
import { AcessoPendenteError, login } from './api';
import { WHATSAPP_URL } from './dadosInstitucionais';

const CAMPO =
  'w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-sm text-body-sm outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-sm border border-transparent focus:border-primary transition-all';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);

  useEffect(() => {
    document.title = 'Entrar | AFSB';
  }, []);

  useEffect(() => {
    if (!pendente) return;
    const fecharNoEsc = (e: KeyboardEvent) => e.key === 'Escape' && setPendente(false);
    window.addEventListener('keydown', fecharNoEsc);
    return () => window.removeEventListener('keydown', fecharNoEsc);
  }, [pendente]);

  const entrar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const sessao = await login(email.trim(), senha);
      localStorage.setItem('afsb_token', sessao.token);
      localStorage.setItem('afsb_usuario', JSON.stringify(sessao.usuario));
      // Volta à página que pediu o login, se o usuário puder vê-la; senão, à área dele.
      const next = new URLSearchParams(window.location.search).get('next') ?? '';
      const podeNext = next.startsWith('/area') || (sessao.usuario.admin && next.startsWith('/painel'));
      window.location.href = podeNext ? next : sessao.usuario.admin ? '/painel' : '/area';
    } catch (falha) {
      if (falha instanceof AcessoPendenteError) setPendente(true);
      else setErro(falha instanceof Error ? falha.message : 'Não foi possível entrar.');
      setEnviando(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased min-h-screen flex flex-col">
      <header className="h-20 max-w-[1280px] w-full mx-auto px-6 lg:px-12 flex items-center justify-between">
        <a href="/" className="flex items-center">
          <img
            alt="AFSB - Associação dos Franqueados Subway do Brasil"
            className="h-8 w-auto object-contain"
            src="/afsb-logo.png"
          />
        </a>
        <a
          className="inline-flex items-center gap-1 font-label-lg text-label-lg text-on-surface-variant hover:text-primary transition-colors"
          href="/"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_back</span>
          Voltar ao site
        </a>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-8 sm:p-10">
          <h1 className="font-headline-md text-headline-md text-on-surface font-extrabold">
            Área do associado
          </h1>
          <p className="mt-2 text-on-surface-variant font-body-sm text-body-sm">
            Entre com o e-mail e a senha cadastrados na AFSB.
          </p>

          <form className="mt-8 flex flex-col space-y-4" onSubmit={entrar}>
            <div>
              <label
                className="block font-label-md text-label-md text-on-surface-variant mb-1 font-semibold"
                htmlFor="login-email"
              >
                E-mail
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-3 text-[20px] text-tertiary">
                  mail
                </span>
                <input
                  required
                  autoComplete="email"
                  autoFocus
                  className={CAMPO}
                  id="login-email"
                  placeholder="seu@email.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label
                className="block font-label-md text-label-md text-on-surface-variant mb-1 font-semibold"
                htmlFor="login-senha"
              >
                Senha
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-3 text-[20px] text-tertiary">
                  lock
                </span>
                <input
                  required
                  autoComplete="current-password"
                  className={`${CAMPO} pr-11`}
                  id="login-senha"
                  placeholder="Sua senha"
                  type={verSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-2.5 p-0.5 rounded-md text-on-surface-variant hover:text-on-surface"
                  onClick={() => setVerSenha((v) => !v)}
                  type="button"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                    {verSenha ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {erro && (
              <p className="rounded-xl bg-error-container text-on-error-container px-4 py-2.5 font-body-sm text-body-sm" role="alert">
                {erro}
              </p>
            )}

            <button
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl font-label-lg text-label-lg text-on-primary bg-primary hover:bg-secondary-container hover:text-on-secondary-container transition-all shadow-[0_2px_4px_rgba(0,101,44,0.15)] disabled:opacity-60 disabled:pointer-events-none"
              disabled={enviando}
              type="submit"
            >
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-on-surface-variant font-body-sm text-body-sm">
            Ainda não é associado?{' '}
            <a className="text-primary font-semibold hover:underline" href="/#contato">
              Quero me associar
            </a>
          </p>
        </div>
      </main>

      {pendente && (
        <div
          aria-labelledby="pendente-titulo"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendente(false);
          }}
        >
          <div className="rounded-2xl bg-surface-container-lowest text-on-surface shadow-2xl max-w-md w-full p-6 md:p-8 flex flex-col items-center text-center border border-outline-variant/30">
            <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-tertiary">
              lock_clock
            </span>
            <h2 className="mt-3 font-headline-sm text-headline-sm font-bold" id="pendente-titulo">
              Acesso com pendência
            </h2>
            <p className="mt-2 text-on-surface-variant font-body-md text-body-md">
              Seu acesso está com uma pendência, por favor contate o suporte no WhatsApp para
              resolução.
            </p>
            <div className="mt-6 w-full flex flex-col gap-3">
              <a
                autoFocus
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl font-label-lg text-label-lg text-white bg-[#25D366] hover:brightness-95 transition-all"
                href={WHATSAPP_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                Falar com o suporte
              </a>
              <button
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-label-lg text-label-lg text-on-surface-variant bg-surface-container-low hover:bg-surface-container hover:text-on-surface transition-all"
                onClick={() => setPendente(false)}
                type="button"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

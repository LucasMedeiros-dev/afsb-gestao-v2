import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import * as api from './api';
import { CNPJ, WHATSAPP_URL } from './dadosInstitucionais';
import NoticiasEventos from './NoticiasEventos';
import { SCHEMA_ORG, SITE, useSeo } from './seo';

// Leaflet só carrega quando a Home monta, fora do bundle principal.
const MapaAtuacao = lazy(() => import('./MapaAtuacao'));

/** Iniciais para avatar de diretor quando foto não estiver disponível. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

const HERO_SLIDES = [
  {
    titulo: 'Poder de Negociação Unificado',
    subtitulo: 'Representação perante a franqueadora e fornecedores-chave',
    icone: 'handshake',
    imagem: '/hero-loja-shopping.jpg',
    alt: 'Fachada moderna de franquia Subway em shopping center com atendimento digital',
  },
  {
    titulo: 'Qualidade e Frescor dos Insumos',
    subtitulo: 'Negociação coletiva por ingredientes frescos a custos justos',
    icone: 'nutrition',
    imagem: '/hero-intercalada-1.jpeg',
    // Retrato: aparece inteira (sem o zoom do cover), também borrada.
    inteira: true,
    alt: 'Balcão de preparo Subway com vegetais frescos: tomate, cebola roxa, pimentão e rúcula',
  },
  {
    titulo: 'Atuação Coletiva e Escala Nacional',
    subtitulo: 'Franqueados unidos gerando economia e força institucional',
    icone: 'storefront',
    imagem: '/hero-loja-aeroporto.jpg',
    alt: 'Operação Subway Pier Sul com múltiplos terminais de autoatendimento e grande fluxo',
  },
  {
    titulo: 'Inteligência de Custos e CMV',
    subtitulo: 'Estudos de custos de insumos para proteger a margem do franqueado',
    icone: 'query_stats',
    imagem: '/hero-intercalada-2.jpeg',
    // Retrato: aparece inteira (sem o zoom do cover), também borrada.
    inteira: true,
    alt: 'Linha de ingredientes Subway com tomates fatiados, cebola roxa e folhas verdes',
  },
  {
    titulo: 'Inovação e Modernização dos Restaurantes',
    subtitulo: 'Ambientes modernos, experiência do cliente e valorização da marca',
    icone: 'trending_up',
    imagem: '/hero-loja-corner.jpg',
    alt: 'Restaurante Subway com novo conceito visual, lounge moderno e totens',
  },
  {
    titulo: 'Excelência Operacional & Tecnologia',
    subtitulo: 'Capacitação contínua e digitalização para maximizar a rentabilidade',
    icone: 'devices',
    imagem: '/hero-loja-evento.jpg',
    alt: 'Operação de alta eficiência com equipe treinada e terminais de autoatendimento',
  },
];

const PILARES_VALOR = [
  {
    icone: 'account_balance',
    titulo: 'Representação Institucional',
    descricao:
      'Interlocução transparente, firme e estruturada com a franqueadora e stakeholders do setor de fast food no Brasil.',
  },
  {
    icone: 'gavel',
    titulo: 'Apoio Jurídico Especializado',
    descricao:
      'Consultoria preventiva, pareceres técnicos e assessoria coletiva sob as melhores práticas do franchising nacional.',
  },
  {
    icone: 'query_stats',
    titulo: 'Pesquisas & Inteligência',
    descricao:
      'Levantamentos periódicos sobre CMV, custos de insumos e benchmarking de desempenho para embasar decisões.',
  },
  {
    icone: 'forum',
    titulo: 'Comunicação Transparente',
    descricao:
      'Relatórios frequentes, atas de assembleias e canais diretos para que cada associado tenha voz ativa nas pautas.',
  },
  {
    icone: 'school',
    titulo: 'Capacitação Executiva',
    descricao:
      'Treinamentos em gestão financeira, liderança operacional de lojas e conformidade trabalhista para gerentes e proprietários.',
  },
  {
    icone: 'hub',
    titulo: 'Atuação Coletiva & Escala',
    descricao:
      'Poder de compra unificado para gerar economia de escala substancial na contratação de serviços essenciais.',
  },
];

/** Lista vazia em caso de falha: a seção mostra o estado vazio, não quebra a página. */
function carregar<T>(busca: () => Promise<T[]>, definir: (dados: T[]) => void) {
  busca()
    .then((dados) => definir(Array.isArray(dados) ? dados : []))
    .catch(() => definir([]));
}

export default function Landing() {
  useSeo({
    titulo: SITE,
    descricao:
      'A AFSB é a associação independente dos franqueados Subway® no Brasil: atuação jurídica e ' +
      'institucional, estudos de custos, capacitação técnica e representatividade coletiva da rede.',
    caminho: '/',
    schema: SCHEMA_ORG,
  });

  // Estado do Modal de Pré-cadastro
  const [modalAberto, setModalAberto] = useState(false);
  const [cadastroEnviado, setCadastroEnviado] = useState(false);
  const [formValues, setFormValues] = useState({
    nome: '',
    whatsapp: '',
    cpf: '',
    email: '',
    senha: '',
  });
  const [errosCadastro, setErrosCadastro] = useState<Record<string, string>>({});
  const [enviandoCadastro, setEnviandoCadastro] = useState(false);

  // Estado do Carrossel Hero
  const [slideAtual, setSlideAtual] = useState(0);
  const [pausado, setPausado] = useState(false);
  // Pausa explícita do usuário (WCAG 2.2.2); começa ligada para quem pediu
  // menos movimento no sistema.
  const [autoplayParado, setAutoplayParado] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );

  // Referência do Carrossel de Benefícios
  const carrosselBeneficiosRef = useRef<HTMLDivElement>(null);

  // Dados vindos da API
  const [parceiros, setParceiros] = useState<api.Parceiro[]>([]);
  const [membros, setMembros] = useState<api.Membro[]>([]);
  const [noticias, setNoticias] = useState<api.Noticia[]>([]);
  const [eventos, setEventos] = useState<api.Evento[]>([]);

  useEffect(() => {
    carregar(api.parceiros, setParceiros);
    carregar(api.membros, setMembros);
    // Backend já ordena por -criado_em; a landing mostra só as mais recentes.
    carregar(api.noticias, (dados) => setNoticias(dados.slice(0, 4)));
    // Backend ordena por data_hora; passados ficam de fora.
    carregar(api.eventos, (dados) => {
      const agora = Date.now();
      setEventos(dados.filter((e) => new Date(e.data_hora).getTime() >= agora).slice(0, 4));
    });
  }, []);

  // Autoplay do Carrossel Hero
  useEffect(() => {
    if (pausado || autoplayParado) return;
    const timer = setInterval(() => {
      setSlideAtual((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [pausado, autoplayParado]);

  // Autoplay do Carrossel de Benefícios: só com parceiros que não cabem na
  // tela; no fim do trilho volta ao início.
  const [beneficiosPausado, setBeneficiosPausado] = useState(false);
  useEffect(() => {
    if (parceiros.length === 0 || beneficiosPausado || autoplayParado) return;
    const timer = setInterval(() => {
      const trilho = carrosselBeneficiosRef.current;
      if (!trilho || trilho.scrollWidth <= trilho.clientWidth) return;
      const noFim = trilho.scrollLeft + trilho.clientWidth >= trilho.scrollWidth - 8;
      trilho.scrollTo({ left: noFim ? 0 : trilho.scrollLeft + 340, behavior: 'smooth' });
    }, 5000);
    return () => clearInterval(timer);
  }, [parceiros.length, beneficiosPausado, autoplayParado]);

  // Scroll horizontal suave do Carrossel de Benefícios
  const scrollBeneficios = (direcao: 'esquerda' | 'direita') => {
    if (carrosselBeneficiosRef.current) {
      const scrollAmount = 340 * (direcao === 'esquerda' ? -1 : 1);
      carrosselBeneficiosRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const abrirModal = () => {
    setCadastroEnviado(false);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
  };

  const handleWhatsappChange = (e: ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, '');
    if (valor.length > 11) valor = valor.slice(0, 11);

    let formatado = valor;
    if (valor.length > 6) {
      formatado = `(${valor.slice(0, 2)}) ${valor.slice(2, 7)}-${valor.slice(7)}`;
    } else if (valor.length > 2) {
      formatado = `(${valor.slice(0, 2)}) ${valor.slice(2)}`;
    } else if (valor.length > 0) {
      formatado = `(${valor}`;
    }

    setFormValues((prev) => ({ ...prev, whatsapp: formatado }));
  };

  const handleCpfChange = (e: ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
    const cpf = d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setFormValues((prev) => ({ ...prev, cpf }));
  };

  // Pré-cadastro: cria o usuário "aguardando validação"; a diretoria aprova no painel.
  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEnviandoCadastro(true);
    setErrosCadastro({});
    try {
      await api.preCadastro(formValues);
      setCadastroEnviado(true);
      setFormValues({ nome: '', whatsapp: '', cpf: '', email: '', senha: '' });
    } catch (falha) {
      setErrosCadastro(
        falha instanceof api.ErroCadastro ? falha.campos : { geral: 'Não foi possível enviar. Tente novamente.' },
      );
    } finally {
      setEnviandoCadastro(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased min-h-screen flex flex-col selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* CABEÇALHO FIXO COM LOGO ORIGINAL */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-20 max-w-[1280px] mx-auto px-6 lg:px-12 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 shrink-0">
            <a href="#" className="flex items-center">
              <img
                alt="AFSB - Associação dos Franqueados Subway do Brasil"
                className="h-8 w-auto object-contain"
                src="/afsb-logo.png"
              />
            </a>
          </div>

          <nav className="hidden lg:flex items-center gap-8">
            <a
              className="font-label-lg text-label-lg text-on-surface-variant hover:text-primary transition-colors"
              href="#sobre"
            >
              Sobre
            </a>
            <a
              className="font-label-lg text-label-lg text-on-surface-variant hover:text-primary transition-colors"
              href="#beneficios"
            >
              Benefícios &amp; Parcerias
            </a>
            <a
              className="font-label-lg text-label-lg text-on-surface-variant hover:text-primary transition-colors"
              href="#membros"
            >
              Membros
            </a>
            <a
              className="font-label-lg text-label-lg text-on-surface-variant hover:text-primary transition-colors"
              href="#contato"
            >
              Contato
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <a
              className="hidden sm:inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-label-lg text-label-lg text-on-surface-variant bg-surface-container-low hover:bg-surface-container hover:text-on-surface transition-all"
              href="/login"
            >
              Entrar
            </a>
            <button
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-label-lg text-label-lg text-on-primary bg-primary hover:bg-secondary-container hover:text-on-secondary-container transition-all shadow-[0_2px_4px_rgba(0,101,44,0.15)]"
              onClick={abrirModal}
              type="button"
            >
              Quero me associar
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="w-full pt-20 bg-surface flex-grow">
        <div className="flex flex-col w-full">
          {/* HERO: as fotos das lojas ocupam a tela; o texto fica num painel
              de vidro fosco que borra só o que está atrás dele. */}
          <section
            aria-roledescription="carrossel"
            aria-label="Lojas de associados"
            className="relative w-full overflow-hidden bg-slate-900 min-h-[calc(100svh-5rem)] flex items-center"
            onMouseEnter={() => setPausado(true)}
            onMouseLeave={() => setPausado(false)}
            onFocus={() => setPausado(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setPausado(false);
            }}
          >
            {HERO_SLIDES.map((slide, index) => {
              const ativo = index === slideAtual;
              return (
                <img
                  key={slide.imagem}
                  alt={ativo ? slide.alt : ''}
                  aria-hidden={!ativo}
                  // Borrado de propósito: as fotos não têm definição para
                  // tela cheia, então viram textura. A escala esconde a
                  // borda clara que o blur cria nas laterais.
                  className={`absolute inset-0 w-full h-full object-cover blur-[8px] transition-[opacity,transform] duration-[1200ms] ease-out motion-reduce:transition-none ${ativo ? 'opacity-100 scale-110' : 'opacity-0 scale-[1.15]'
                    }`}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  src={slide.imagem}
                />
              );
            })}
            {HERO_SLIDES.map((slide, index) => {
              if (!('inteira' in slide)) return null;
              const ativo = index === slideAtual;
              return (
                <img
                  key={`${slide.imagem}-inteira`}
                  alt=""
                  aria-hidden="true"
                  className={`absolute inset-y-0 right-0 h-full w-full object-contain object-right blur-[8px] transition-opacity duration-[1200ms] ease-out motion-reduce:transition-none ${ativo ? 'opacity-100' : 'opacity-0'
                    }`}
                  loading="lazy"
                  src={slide.imagem}
                />
              );
            })}
            {/* Escurece só a base e a esquerda: a foto segue nítida à direita. */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-slate-950/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950/60 to-transparent" />

            <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 lg:px-12 py-12 lg:py-20">
              <div className="max-w-2xl rounded-3xl bg-white/70 backdrop-blur-xl backdrop-saturate-150 border border-white/60 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.35)] p-6 sm:p-10 flex flex-col space-y-6">
                <h1 className="font-headline-xl-mobile text-headline-xl-mobile sm:font-headline-xl sm:text-headline-xl text-on-surface tracking-tight font-extrabold">
                  União, Representatividade e{' '}
                  <span className="text-primary underline decoration-secondary-container decoration-4 underline-offset-8">
                    Força
                  </span>{' '}
                  para o Franqueado Subway
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
                  Conectamos os franqueados de todo o Brasil para construir uma rede mais sólida,
                  competitiva e rentável por meio da cooperação estratégica, diálogo altivo e defesa
                  de interesses mútuos.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-label-lg text-label-lg text-on-primary bg-primary hover:bg-primary-container shadow-md transition-all active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    onClick={abrirModal}
                    type="button"
                  >
                    <span>Quero me associar</span>
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                  <a
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-label-lg text-label-lg text-primary bg-white/80 hover:bg-white transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    href="#beneficios"
                  >
                    <span>Conheça nossos benefícios</span>
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">expand_more</span>
                  </a>
                </div>

                {/* Faixa de Indicadores e Confiança */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="flex flex-col p-4 rounded-xl bg-white/75 shadow-sm">
                    <span aria-hidden="true" className="material-symbols-outlined text-secondary text-[32px] leading-none">
                      public
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant leading-snug">
                      Atuação Nacional
                    </span>
                  </div>
                  <div className="flex flex-col p-4 rounded-xl bg-white/75 shadow-sm">
                    <span className="font-headline-md text-headline-md text-primary font-extrabold">
                      100%
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant leading-snug">
                      Foco no Franqueado
                    </span>
                  </div>
                  <div className="flex flex-col p-4 rounded-xl bg-white/75 shadow-sm">
                    <span aria-hidden="true" className="material-symbols-outlined text-tertiary text-[32px] leading-none">
                      gavel
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant leading-snug">
                      Apoio Jurídico
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Legenda + controles, em vidro escuro sobre a própria foto. */}
            <div className="absolute z-10 bottom-4 sm:bottom-6 inset-x-0">
              <div className="max-w-[1280px] mx-auto px-6 lg:px-12 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div aria-live={pausado ? 'polite' : 'off'} className="hidden sm:flex items-start gap-3 max-w-md rounded-2xl bg-slate-950/40 backdrop-blur-md border border-white/15 px-4 py-3 text-white">
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-secondary-fixed text-[22px] mt-0.5"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {HERO_SLIDES[slideAtual].icone}
                  </span>
                  <div>
                    <p className="font-label-lg text-label-lg font-bold">{HERO_SLIDES[slideAtual].titulo}</p>
                    <p className="font-body-sm text-body-sm text-slate-200 leading-snug">
                      {HERO_SLIDES[slideAtual].subtitulo}
                    </p>
                  </div>
                </div>

                <div className="self-center sm:self-auto flex items-center gap-1 rounded-full bg-slate-950/40 backdrop-blur-md border border-white/15 p-1 text-white">
                  <button
                    aria-label="Slide anterior"
                    className="w-11 h-11 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    onClick={() =>
                      setSlideAtual((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)
                    }
                    type="button"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[22px]">chevron_left</span>
                  </button>
                  {HERO_SLIDES.map((slide, index) => {
                    const ativo = index === slideAtual;
                    return (
                      <button
                        key={slide.imagem}
                        aria-current={ativo}
                        aria-label={`Ir para slide ${index + 1}`}
                        className="h-11 px-1 flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded-full"
                        onClick={() => setSlideAtual(index)}
                        type="button"
                      >
                        <span
                          className={`carousel-dot block h-2.5 rounded-full transition-all ${ativo ? 'bg-white w-6' : 'w-2.5 bg-white/45 hover:bg-white/75'
                            }`}
                        />
                      </button>
                    );
                  })}
                  <button
                    aria-label="Próximo slide"
                    className="w-11 h-11 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    onClick={() => setSlideAtual((prev) => (prev + 1) % HERO_SLIDES.length)}
                    type="button"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[22px]">chevron_right</span>
                  </button>
                  <button
                    aria-label={autoplayParado ? 'Retomar apresentação' : 'Pausar apresentação'}
                    className="w-11 h-11 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    onClick={() => setAutoplayParado((v) => !v)}
                    type="button"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                      {autoplayParado ? 'play_arrow' : 'pause'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SEÇÃO SOBRE A AFSB */}
          <section className="w-full py-20 bg-surface-container-lowest" id="sobre">
            <div className="max-w-[1280px] mx-auto px-6 lg:px-12 flex flex-col space-y-16">
              {/* Manifesto & Fotografia Real Integrada */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-7 flex flex-col space-y-6">
                  <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold leading-tight">
                    Legitimidade para representar, estratégia para avançar e força para transformar
                    custos em rentabilidade.
                  </h2>
                  <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
                    A força da Associação vem da participação ativa, contribuição e atuação coletiva dos
                    associados. Nosso propósito é representar com legitimidade, apoiar estrategicamente e
                    defender os interesses de cada franqueado em todas as frentes essenciais: voz perante
                    a franqueadora, diálogo transparente, respaldo jurídico de excelência, inteligência
                    de mercado, capacitação contínua e ganhos de escala para redução de custos operacionais.
                  </p>
                  <div className="border-l-4 border-primary pl-4 py-1">
                    <p className="font-label-lg text-label-lg font-semibold text-on-surface italic">
                      &ldquo;Mais do que uma diretoria, a AFSB é formada pela sua base: os associados.&rdquo;
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-5 relative">
                  <div className="relative rounded-3xl overflow-hidden shadow-xl aspect-[4/3] group">
                    <img
                      alt="Restaurante Subway operado por associado com novo conceito visual"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      src="/hero-loja-corner.jpg"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex items-end p-6 pointer-events-none">
                      <p className="font-label-md text-label-md text-white font-semibold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-secondary-fixed" /> Padrão internacional de franquias Subway no Brasil
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid dos 6 Pilares de Valor */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {PILARES_VALOR.map((pilar) => (
                  <div
                    key={pilar.titulo}
                    className="p-6 rounded-2xl bg-surface hover:bg-surface-container transition-colors shadow-sm flex flex-col space-y-3"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[26px]">{pilar.icone}</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      {pilar.titulo}
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      {pilar.descricao}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ATUAÇÃO NACIONAL: mapa de lojas associadas. */}
          <section className="w-full py-20 bg-surface-container-low" id="atuacao-nacional">
            <div className="max-w-[1280px] mx-auto px-6 lg:px-12 flex flex-col space-y-10">
              <div className="max-w-2xl space-y-3">
                <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Atuação Nacional</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Associados em todas as regiões do país. Aproxime o mapa para ver as lojas por estado.
                </p>
              </div>
              <Suspense
                fallback={<div className="w-full h-[420px] md:h-[520px] rounded-3xl bg-surface-container animate-pulse" />}
              >
                <MapaAtuacao />
              </Suspense>
            </div>
          </section>

          {/* NOTÍCIAS & EVENTOS */}
          <section className="w-full py-20 bg-surface-container-lowest" id="noticias-eventos">
            <div className="max-w-[1280px] mx-auto px-6 lg:px-12 flex flex-col space-y-10">
              <div className="max-w-2xl space-y-3">
                <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Notícias e Eventos</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  O que a associação está fazendo e onde encontrar os associados nos próximos meses.
                </p>
              </div>
              <NoticiasEventos noticias={noticias} eventos={eventos} />
            </div>
          </section>

          {/* CARROSSEL DE BENEFÍCIOS & PARCERIAS */}
          <section className="w-full py-20 bg-surface" id="beneficios">
            <div className="max-w-[1280px] mx-auto px-6 lg:px-12 flex flex-col space-y-12">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="max-w-2xl space-y-3">
                  <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
                    Benefícios e Parcerias para o Associado
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Soluções para reduzir custos, proteger o negócio, melhorar a gestão e dar acesso a
                    serviços em condições diferenciadas.
                  </p>
                </div>
                {/* Controles do Slider */}
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Benefício anterior"
                    className="w-11 h-11 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface transition-colors shadow-sm"
                    onClick={() => scrollBeneficios('esquerda')}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  <button
                    aria-label="Próximo benefício"
                    className="w-11 h-11 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface transition-colors shadow-sm"
                    onClick={() => scrollBeneficios('direita')}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                </div>
              </div>

              {/* Trilho Horizontal de Cards */}
              <div
                ref={carrosselBeneficiosRef}
                onMouseEnter={() => setBeneficiosPausado(true)}
                onMouseLeave={() => setBeneficiosPausado(false)}
                onFocus={() => setBeneficiosPausado(true)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setBeneficiosPausado(false);
                }}
                onTouchStart={() => setBeneficiosPausado(true)}
                className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 pt-2 no-scrollbar"
              >
                {parceiros.length > 0 ? (
                  parceiros.map((p) => (
                    <div
                      key={p.id}
                      className="min-w-[280px] md:min-w-[340px] max-w-[340px] snap-start p-6 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center">
                          {p.logo ? (
                            <img
                              src={p.logo}
                              alt={p.nome}
                              className="h-7 w-auto max-w-[120px] object-contain"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-primary text-[24px]">
                              verified_user
                            </span>
                          )}
                        </div>
                        <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                          {p.nome}
                        </h4>
                        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed line-clamp-3 whitespace-pre-line">
                          {p.beneficios}
                        </p>
                      </div>
                      {p.site ? (
                        <a
                          href={p.site}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pt-4 flex items-center gap-2 text-primary font-label-md text-label-md font-semibold hover:underline"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Conhecer Condições
                          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        </a>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-on-surface-variant py-4 text-body-md">
                    Nenhum parceiro no momento.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* SEÇÃO MEMBROS & DIRETORIA */}
          <section className="w-full py-20 bg-surface-container-lowest" id="membros">
            <div className="max-w-[1280px] mx-auto px-6 lg:px-12 flex flex-col space-y-12">
              <div className="max-w-2xl space-y-3">
                <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
                  Nossa Liderança e Representantes
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Franqueados experientes e atuantes à frente da gestão participativa da associação,
                  trabalhando pelo coletivo.
                </p>
              </div>

              {/* Carrossel contínuo: a lista vai duplicada e a esteira anda -50%,
                  então o fim emenda no começo sem salto. 4 por vez no desktop. */}
              {membros.length > 0 ? (
                <div className="overflow-hidden -mx-3 py-2">
                  <div
                    className="flex w-max hover:[animation-play-state:paused] motion-reduce:!animate-none"
                    style={{
                      animation: `esteira-membros ${membros.length * 5}s linear infinite`,
                      animationPlayState: autoplayParado ? 'paused' : undefined,
                    }}
                  >
                {[...membros, ...membros].map((membro, indice) => (
                  <div
                    key={`${membro.id}-${indice}`}
                    aria-hidden={indice >= membros.length}
                    className="shrink-0 px-3 w-[85vw] sm:w-[calc((min(100vw,1280px)-1.5rem)/2)] lg:w-[calc((min(100vw,1280px)-4.5rem)/4)]"
                  >
                    <div
                      className="w-full rounded-2xl bg-surface overflow-hidden shadow-sm flex flex-col"
                    >
                      {/* Retrato grande em vez de avatar de 96px: a foto é
                          alta resolução e, encolhida demais, serrilha. O
                          enquadramento pelo topo pega rosto e ombros. */}
                      <div className="relative aspect-[4/5] overflow-hidden bg-surface-container-high">
                        {membro.foto ? (
                          <img
                            alt={membro.nome}
                            className="absolute inset-0 w-full h-full object-cover object-top"
                            decoding="async"
                            loading="lazy"
                            src={membro.foto}
                          />
                        ) : (
                          <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center font-bold text-5xl">
                            {iniciais(membro.nome)}
                          </div>
                        )}
                      </div>
                      <div className="p-5 text-center">
                        <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                          {membro.nome}
                        </h4>
                        {membro.titulo && (
                          <p className="font-label-md text-label-md text-primary font-semibold">
                            {membro.titulo}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                  </div>
                </div>
              ) : (
                <p className="text-on-surface-variant py-4 text-body-md text-center">
                  Nenhum membro cadastrado no momento.
                </p>
              )}
            </div>
          </section>

          {/* BANNER CTA DE CONVERSÃO FINAL */}
          <section className="w-full py-16 lg:py-24 bg-surface">
            <div className="max-w-[1280px] mx-auto px-6 lg:px-12">
              <div className="relative overflow-hidden rounded-3xl text-on-primary p-4 sm:p-8 lg:p-12 shadow-2xl min-h-[420px] flex items-center">
                {/* A foto fica visível; só o painel de vidro borra o que está atrás. */}
                <img
                  alt="Grande operação Subway integrada com atendimento moderno"
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  src="/hero-loja-aeroporto.jpg"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/55 via-emerald-950/20 to-transparent" />

                <div className="relative z-10 w-full lg:max-w-3xl rounded-2xl bg-emerald-950/55 backdrop-blur-xl backdrop-saturate-150 border border-white/15 p-6 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-8">
                  <div className="space-y-4 text-center lg:text-left">
                    <h2 className="font-headline-lg-mobile text-headline-lg-mobile sm:font-headline-lg sm:text-headline-lg font-extrabold leading-tight text-white">
                      Sua operação é mais forte quando decidimos juntos.
                    </h2>
                    <p className="font-body-md text-body-md text-emerald-50">
                      Faça parte da maior entidade representativa de franqueados Subway no Brasil. Tenha
                      acesso a inteligência de compras, suporte jurídico de excelência e poder de negociação
                      coletivo.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <button
                      className="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-label-lg text-label-lg font-bold bg-secondary-container hover:bg-secondary-fixed text-on-secondary-fixed shadow-lg transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      onClick={abrirModal}
                      type="button"
                    >
                      <span>Quero me associar agora</span>
                      <span aria-hidden="true" className="material-symbols-outlined text-[22px]">check_circle</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* BOTÃO FLUTUANTE DO WHATSAPP */}
      <a
        aria-label="Fale conosco pelo WhatsApp"
        className="fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-[0_10px_15px_-3px_rgba(37,211,102,0.35)] hover:scale-105 active:scale-95 transition-transform"
        href={WHATSAPP_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        {/* Logo oficial (Simple Icons): Material Symbols não tem marca do WhatsApp. */}
        <svg aria-hidden="true" className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      </a>

      {/* MODAL DE PRÉ-CADASTRO */}
      {modalAberto && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          role="dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) fecharModal();
          }}
        >
          <div className="rounded-2xl bg-surface-container-lowest text-on-surface shadow-2xl max-w-lg w-full overflow-hidden border border-outline-variant/30">
            <div className="p-6 md:p-8 flex flex-col space-y-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary/10 text-primary font-label-sm text-label-sm font-bold">
                    <span className="material-symbols-outlined text-[16px]">assignment</span> AFSB Brasil
                  </div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Pré-cadastro de Associado
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Junte-se à maior rede colaborativa de franqueados Subway do Brasil
                  </p>
                </div>
                <button
                  aria-label="Fechar modal"
                  className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
                  onClick={fecharModal}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {!cadastroEnviado ? (
                <form className="flex flex-col space-y-4" onSubmit={handleFormSubmit}>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-1 font-semibold">
                      Nome Completo
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-3 text-[20px] text-tertiary">
                        person
                      </span>
                      <input
                        required
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-sm text-body-sm outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-sm border border-transparent focus:border-primary transition-all"
                        name="nome"
                        placeholder="Digite seu nome completo"
                        type="text"
                        value={formValues.nome}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, nome: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-1 font-semibold">
                      WhatsApp de Contato
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-3 text-[20px] text-tertiary">
                        call
                      </span>
                      <input
                        required
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-sm text-body-sm outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-sm border border-transparent focus:border-primary transition-all"
                        name="whatsapp"
                        placeholder="(00) 00000-0000"
                        type="tel"
                        value={formValues.whatsapp}
                        onChange={handleWhatsappChange}
                      />
                    </div>
                    {errosCadastro.whatsapp && <p className="mt-1 text-[0.8rem] text-error">{errosCadastro.whatsapp}</p>}
                  </div>

                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-1 font-semibold">
                      CPF
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-3 text-[20px] text-tertiary">
                        badge
                      </span>
                      <input
                        required
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-sm text-body-sm outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-sm border border-transparent focus:border-primary transition-all"
                        inputMode="numeric"
                        name="cpf"
                        placeholder="000.000.000-00"
                        value={formValues.cpf}
                        onChange={handleCpfChange}
                      />
                    </div>
                    {errosCadastro.cpf && <p className="mt-1 text-[0.8rem] text-error">{errosCadastro.cpf}</p>}
                  </div>

                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-1 font-semibold">
                      E-mail Profissional
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-3 text-[20px] text-tertiary">
                        mail
                      </span>
                      <input
                        required
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-sm text-body-sm outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-sm border border-transparent focus:border-primary transition-all"
                        name="email"
                        placeholder="seuemail@exemplo.com.br"
                        type="email"
                        value={formValues.email}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, email: e.target.value }))
                        }
                      />
                    </div>
                    {errosCadastro.email && <p className="mt-1 text-[0.8rem] text-error">{errosCadastro.email}</p>}
                  </div>

                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-1 font-semibold">
                      Criar Senha de Acesso
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-3 text-[20px] text-tertiary">
                        lock
                      </span>
                      <input
                        required
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-sm text-body-sm outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-sm border border-transparent focus:border-primary transition-all"
                        minLength={8}
                        name="senha"
                        placeholder="Mínimo de 8 caracteres"
                        type="password"
                        value={formValues.senha}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, senha: e.target.value }))
                        }
                      />
                    </div>
                    {errosCadastro.senha && <p className="mt-1 text-[0.8rem] text-error">{errosCadastro.senha}</p>}
                  </div>

                  <div className="pt-2 flex flex-col space-y-3">
                    {(errosCadastro.geral || errosCadastro.nome) && (
                      <p className="rounded-xl bg-error-container text-on-error-container px-4 py-2.5 text-[0.85rem]" role="alert">
                        {errosCadastro.geral || errosCadastro.nome}
                      </p>
                    )}
                    <button
                      className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-bold shadow-md transition-all active:scale-[0.99] disabled:opacity-60"
                      disabled={enviandoCadastro}
                      type="submit"
                    >
                      {enviandoCadastro ? 'Enviando…' : 'Enviar Pré-Cadastro'}
                    </button>
                    <div className="flex items-start gap-2 pt-1 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">
                        lock
                      </span>
                      <p className="font-body-sm text-body-sm leading-tight text-slate-500">
                        Dados protegidos com criptografia. A Diretoria da AFSB entrará em contato
                        exclusivamente para validação das credenciais de franqueado ativo.
                      </p>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="p-6 rounded-xl bg-emerald-50 text-emerald-900 flex flex-col items-center text-center space-y-3 border border-emerald-200">
                  <span className="material-symbols-outlined text-emerald-600 text-[48px]">
                    check_circle
                  </span>
                  <h4 className="font-headline-sm text-headline-sm font-bold">
                    Solicitação Recebida com Sucesso!
                  </h4>
                  <p className="font-body-sm text-body-sm leading-relaxed text-emerald-800">
                    Obrigado por iniciar sua associação. Nossa diretoria executiva validará suas
                    informações junto ao cadastro e retornará via WhatsApp em breve.
                  </p>
                  <button
                    className="px-6 py-2 rounded-xl bg-emerald-700 text-white font-label-md text-label-md font-bold mt-2 hover:bg-emerald-800 transition-colors"
                    onClick={fecharModal}
                    type="button"
                  >
                    Concluir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RODAPÉ COM LOGO ORIGINAL CLARA */}
      <footer className="w-full bg-[#0F172A] text-slate-300 py-16" id="contato">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-16">
            <div className="space-y-4">
              <div className="flex items-center">
                <img
                  alt="AFSB Logo"
                  className="h-8 w-auto object-contain"
                  src="/afsb-logo-light.png"
                />
              </div>
              <p className="font-body-sm text-body-sm text-slate-400 leading-relaxed">
                Representando e fortalecendo os franqueados Subway em todo o território nacional. Defesa
                jurídica, alinhamento institucional e inteligência de negócios para a nossa rede.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-headline-sm text-headline-sm text-white font-bold">Navegação</h4>
              <ul className="space-y-2.5">
                <li className="leading-none">
                  <a
                    className="font-body-sm text-body-sm text-slate-400 hover:text-white transition-colors"
                    href="#sobre"
                  >
                    Sobre a Associação
                  </a>
                </li>
                <li className="leading-none">
                  <a
                    className="font-body-sm text-body-sm text-slate-400 hover:text-white transition-colors"
                    href="#beneficios"
                  >
                    Benefícios e Convênios
                  </a>
                </li>
                <li className="leading-none">
                  <a
                    className="font-body-sm text-body-sm text-slate-400 hover:text-white transition-colors"
                    href="#membros"
                  >
                    Corpo Diretivo
                  </a>
                </li>
                <li className="leading-none">
                  <a
                    className="font-body-sm text-body-sm text-slate-400 hover:text-white transition-colors"
                    href="#contato"
                  >
                    Canais de Contato
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-headline-sm text-headline-sm text-white font-bold">Contato Direto</h4>
              <ul className="space-y-3.5">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-slate-400 text-[20px] mt-0.5">
                    call
                  </span>
                  <a
                    className="font-body-sm text-body-sm text-slate-400 hover:text-white transition-colors"
                    href={WHATSAPP_URL}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    (11) 99341-4925 (WhatsApp)
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-slate-400 text-[20px] mt-0.5">
                    mail
                  </span>
                  <a
                    className="font-body-sm text-body-sm text-slate-400 hover:text-white transition-colors"
                    href="mailto:associacaofsb@gmail.com"
                  >
                    associacaofsb@gmail.com
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-slate-400 text-[20px] mt-0.5">
                    schedule
                  </span>
                  <span className="font-body-sm text-body-sm text-slate-400">
                    Segunda à Sexta, das 09h às 18h
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-body-sm text-body-sm text-slate-500 text-center md:text-left">
              &copy; 2026 AFSB - Associação dos Franqueados Subway do Brasil. Todos os direitos
              reservados.
            </p>
            <span className="font-body-sm text-body-sm text-slate-500">CNPJ {CNPJ}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

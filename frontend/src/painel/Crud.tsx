/**
 * Listagem + formulário genéricos dirigidos por configuração (ver recursos.tsx).
 * Arquivo/imagem vai em multipart; sem arquivo, JSON (M2M precisa de lista vazia).
 */
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ErroApi, get, qs, req } from './api';
import {
  Botao,
  CLASSE_INPUT,
  Campo,
  Carregando,
  Cartao,
  Icone,
  Modal,
  Vazio,
  useAtraso,
  useCarregar,
  useToast,
} from './ui';

export type Item = Record<string, unknown> & { id: string };
export type Valores = Record<string, unknown>;

export interface Opcao {
  valor: string;
  rotulo: string;
}

export interface CampoForm {
  nome: string;
  rotulo: string;
  tipo:
    | 'texto' | 'email' | 'textarea' | 'numero' | 'dinheiro' | 'data' | 'datahora'
    | 'select' | 'checkbox' | 'imagem' | 'arquivo' | 'relacao' | 'url';
  obrigatorio?: boolean;
  /** Só obrigatório na criação (ex.: imagem já enviada pode ficar). */
  obrigatorioAoCriar?: boolean;
  opcoes?: Opcao[];
  ajuda?: ReactNode;
  largura?: 'inteira' | 'meia' | 'terco';
  mascara?: (v: string) => string;
  placeholder?: string;
  relacao?: { endpoint: string; rotulo: (item: Item) => string; multiplo?: boolean };
  visivel?: (v: Valores) => boolean;
  /** Botão ao lado do campo (ex.: buscar CNPJ). Recebe os valores e um setter parcial. */
  acao?: (v: Valores, aplicar: (parcial: Valores) => void) => ReactNode;
}

export interface Coluna {
  titulo: string;
  valor: (item: Item) => ReactNode;
  className?: string;
}

export interface Recurso {
  titulo: string;
  singular: string;
  descricao?: string;
  endpoint: string;
  colunas: Coluna[];
  campos: CampoForm[];
  filtros?: { param: string; rotulo: string; opcoes: Opcao[] }[];
  buscaPlaceholder?: string;
  padrao?: Valores;
  podeCriar?: boolean;
  podeExcluir?: boolean;
  /** Rodapé extra no formulário de edição (links, atalhos). */
  extrasEdicao?: (item: Item) => ReactNode;
  /** Ajusta o item da API para o formulário (ex.: datetime -> datetime-local). */
  paraForm?: (item: Item) => Valores;
}

const POR_PAGINA = 25;
const LARGURAS = { inteira: 'sm:col-span-6', meia: 'sm:col-span-3', terco: 'sm:col-span-2' };

export default function Crud({ recurso, filtrosIniciais }: { recurso: Recurso; filtrosIniciais?: Record<string, string> }) {
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<Record<string, string>>(filtrosIniciais ?? {});
  const [pagina, setPagina] = useState(0);
  const [editando, setEditando] = useState<Item | 'novo' | null>(null);
  const buscaAtrasada = useAtraso(busca);

  const { dados, erro, carregando, recarregar } = useCarregar(
    () => get<Item[]>(`${recurso.endpoint}${qs({ search: buscaAtrasada, ...filtros })}`),
    [recurso.endpoint, buscaAtrasada, JSON.stringify(filtros)],
  );

  const itens = dados ?? [];
  const totalPaginas = Math.max(1, Math.ceil(itens.length / POR_PAGINA));
  const visiveis = itens.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">{recurso.titulo}</h1>
          {recurso.descricao && (
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{recurso.descricao}</p>
          )}
        </div>
        {recurso.podeCriar !== false && (
          <Botao variante="primario" icone="add" onClick={() => setEditando('novo')}>
            Novo {recurso.singular.toLowerCase()}
          </Botao>
        )}
      </header>

      <Cartao>
        <div className="flex flex-col md:flex-row gap-3 p-4 border-b border-outline-variant/40">
          <div className="relative flex-1">
            <Icone nome="search" className="absolute left-3 top-2.5 text-[20px] text-outline" />
            <input
              className={`${CLASSE_INPUT} pl-10`}
              placeholder={recurso.buscaPlaceholder ?? 'Buscar…'}
              type="search"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(0);
              }}
            />
          </div>
          {recurso.filtros?.map((f) => (
            <select
              key={f.param}
              aria-label={f.rotulo}
              className={`${CLASSE_INPUT} md:w-48`}
              value={filtros[f.param] ?? ''}
              onChange={(e) => {
                setFiltros((atual) => ({ ...atual, [f.param]: e.target.value }));
                setPagina(0);
              }}
            >
              <option value="">{f.rotulo}: todos</option>
              {f.opcoes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          ))}
        </div>

        {erro ? (
          <Vazio icone="cloud_off" titulo="Não foi possível carregar">
            {erro}
          </Vazio>
        ) : carregando && !dados ? (
          <Carregando />
        ) : itens.length === 0 ? (
          <Vazio titulo={busca ? 'Nada encontrado' : `Nenhum registro em ${recurso.titulo.toLowerCase()}`}>
            {busca ? 'Tente outro termo de busca.' : null}
          </Vazio>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${carregando ? 'opacity-60' : ''}`}>
              <table className="w-full text-left">
                <thead>
                  <tr className="font-label-md text-label-md text-on-surface-variant">
                    {recurso.colunas.map((c) => (
                      <th key={c.titulo} className={`px-4 py-3 font-semibold whitespace-nowrap ${c.className ?? ''}`}>
                        {c.titulo}
                      </th>
                    ))}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="font-body-sm text-body-sm text-on-surface">
                  {visiveis.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-outline-variant/30 hover:bg-surface-container-low cursor-pointer"
                      onClick={() => setEditando(item)}
                    >
                      {recurso.colunas.map((c) => (
                        <td key={c.titulo} className={`px-4 py-3 align-middle ${c.className ?? ''}`}>
                          {c.valor(item)}
                        </td>
                      ))}
                      <td className="px-2 text-outline">
                        <Icone nome="chevron_right" className="text-[20px]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-outline-variant/40 font-body-sm text-body-sm text-on-surface-variant">
              <span>
                {itens.length} registro{itens.length === 1 ? '' : 's'}
              </span>
              {totalPaginas > 1 && (
                <div className="flex items-center gap-1">
                  <Botao pequeno variante="fantasma" icone="chevron_left" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} aria-label="Página anterior" />
                  <span className="px-2 tabular-nums">
                    {pagina + 1} / {totalPaginas}
                  </span>
                  <Botao pequeno variante="fantasma" icone="chevron_right" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(pagina + 1)} aria-label="Próxima página" />
                </div>
              )}
            </div>
          </>
        )}
      </Cartao>

      {editando && (
        <Formulario
          recurso={recurso}
          item={editando === 'novo' ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

function valoresIniciais(recurso: Recurso, item: Item | null): Valores {
  if (!item) {
    const base: Valores = {};
    for (const c of recurso.campos) base[c.nome] = c.tipo === 'checkbox' ? false : c.relacao?.multiplo ? [] : '';
    return { ...base, ...recurso.padrao };
  }
  const v: Valores = { ...item, ...recurso.paraForm?.(item) };
  for (const c of recurso.campos) {
    if (v[c.nome] === null || v[c.nome] === undefined) v[c.nome] = c.relacao?.multiplo ? [] : '';
    if (c.tipo === 'datahora' && typeof v[c.nome] === 'string') v[c.nome] = (v[c.nome] as string).slice(0, 16);
  }
  return v;
}

function Formulario({
  recurso,
  item,
  onFechar,
  onSalvo,
}: {
  recurso: Recurso;
  item: Item | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const avisar = useToast();
  const [valores, setValores] = useState<Valores>(() => valoresIniciais(recurso, item));
  const [arquivos, setArquivos] = useState<Record<string, File>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const aplicar = (parcial: Valores) => setValores((v) => ({ ...v, ...parcial }));
  const campos = recurso.campos.filter((c) => !c.visivel || c.visivel(valores));

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErros({});
    setErroGeral(null);

    const comArquivo = Object.keys(arquivos).length > 0;
    const corpo: Valores = {};
    for (const c of campos) {
      if (c.tipo === 'imagem' || c.tipo === 'arquivo') continue;
      const v = valores[c.nome];
      corpo[c.nome] = v === '' && c.tipo !== 'texto' && c.tipo !== 'textarea' ? null : v;
    }
    let payload: Valores | FormData = corpo;
    if (comArquivo) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(corpo)) {
        if (Array.isArray(v)) v.forEach((x) => fd.append(k, String(x)));
        else fd.append(k, v === null ? '' : String(v));
      }
      for (const [k, f] of Object.entries(arquivos)) fd.append(k, f);
      payload = fd;
    }

    try {
      if (item) await req('PATCH', `${recurso.endpoint}${item.id}/`, payload);
      else await req('POST', recurso.endpoint, payload);
      avisar(`${recurso.singular} ${item ? 'atualizado' : 'criado'}.`);
      onSalvo();
    } catch (falha) {
      if (falha instanceof ErroApi) {
        setErros(falha.campos);
        const semCampo = Object.keys(falha.campos).filter((k) => !campos.some((c) => c.nome === k));
        setErroGeral(semCampo.length || !Object.keys(falha.campos).length ? falha.message : 'Corrija os campos destacados.');
      } else setErroGeral('Falha de conexão.');
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!item) return;
    setSalvando(true);
    try {
      await req('DELETE', `${recurso.endpoint}${item.id}/`);
      avisar(`${recurso.singular} excluído.`);
      onSalvo();
    } catch (falha) {
      setErroGeral(falha instanceof Error ? falha.message : 'Não foi possível excluir.');
      setSalvando(false);
      setConfirmarExclusao(false);
    }
  };

  return (
    <Modal
      largura="max-w-3xl"
      titulo={item ? `Editar ${recurso.singular.toLowerCase()}` : `Novo ${recurso.singular.toLowerCase()}`}
      onFechar={onFechar}
      rodape={
        <>
          {item && recurso.podeExcluir !== false && (
            <div className="mr-auto">
              {confirmarExclusao ? (
                <span className="flex items-center gap-2 font-body-sm text-body-sm text-error">
                  Excluir de vez?
                  <Botao pequeno variante="perigo" carregando={salvando} onClick={excluir}>
                    Sim, excluir
                  </Botao>
                  <Botao pequeno variante="fantasma" onClick={() => setConfirmarExclusao(false)}>
                    Não
                  </Botao>
                </span>
              ) : (
                <Botao variante="fantasma" icone="delete" className="!text-error" onClick={() => setConfirmarExclusao(true)}>
                  Excluir
                </Botao>
              )}
            </div>
          )}
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" icone="check" carregando={salvando} type="submit" form="form-crud">
            Salvar
          </Botao>
        </>
      }
    >
      <form id="form-crud" className="grid grid-cols-1 sm:grid-cols-6 gap-4" onSubmit={salvar} noValidate>
        {erroGeral && (
          <div className="sm:col-span-6 rounded-xl bg-error-container text-on-error-container px-4 py-2.5 font-body-sm text-body-sm" role="alert">
            {erroGeral}
          </div>
        )}
        {campos.map((c) => (
          <div key={c.nome} className={LARGURAS[c.largura ?? 'meia']}>
            <CampoEntrada
              campo={c}
              valor={valores[c.nome]}
              erro={erros[c.nome]}
              arquivo={arquivos[c.nome]}
              criando={!item}
              onArquivo={(f) => setArquivos((a) => ({ ...a, [c.nome]: f }))}
              onChange={(v) => aplicar({ [c.nome]: v })}
              acao={c.acao?.(valores, aplicar)}
            />
          </div>
        ))}
        {item && recurso.extrasEdicao && <div className="sm:col-span-6">{recurso.extrasEdicao(item)}</div>}
      </form>
    </Modal>
  );
}

function CampoEntrada({
  campo: c,
  valor,
  erro,
  arquivo,
  criando,
  onChange,
  onArquivo,
  acao,
}: {
  campo: CampoForm;
  valor: unknown;
  erro?: string;
  arquivo?: File;
  criando: boolean;
  onChange: (v: unknown) => void;
  onArquivo: (f: File) => void;
  acao?: ReactNode;
}) {
  const obrigatorio = c.obrigatorio || (criando && c.obrigatorioAoCriar);
  const classe = `${CLASSE_INPUT} ${erro ? '!border-error' : ''}`;
  const texto = valor === null || valor === undefined ? '' : String(valor);

  if (c.tipo === 'checkbox') {
    return (
      <label className="flex items-center gap-3 h-full pt-5 cursor-pointer select-none">
        <input
          checked={Boolean(valor)}
          className="w-5 h-5 accent-primary"
          type="checkbox"
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="font-label-lg text-label-lg text-on-surface">{c.rotulo}</span>
      </label>
    );
  }

  let entrada: ReactNode;
  switch (c.tipo) {
    case 'textarea':
      entrada = <textarea className={`${classe} min-h-32`} placeholder={c.placeholder} value={texto} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'select':
      entrada = (
        <select className={classe} value={texto} onChange={(e) => onChange(e.target.value)}>
          {!obrigatorio && <option value="">—</option>}
          {obrigatorio && !texto && <option value="">Selecione…</option>}
          {c.opcoes?.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      );
      break;
    case 'imagem':
    case 'arquivo': {
      const atual = typeof valor === 'string' && valor ? valor : null;
      entrada = (
        <div className="flex items-center gap-3">
          {c.tipo === 'imagem' && (arquivo || atual) && (
            <img
              alt=""
              className="w-14 h-14 rounded-lg object-cover bg-surface-container"
              src={arquivo ? URL.createObjectURL(arquivo) : atual!}
            />
          )}
          <div className="flex-1 min-w-0">
            <input
              accept={c.tipo === 'imagem' ? 'image/*' : undefined}
              className="block w-full font-body-sm text-body-sm text-on-surface-variant file:mr-3 file:rounded-lg file:border-0 file:bg-surface-container-high file:px-3 file:py-2 file:font-label-md file:text-on-surface hover:file:bg-surface-container-highest"
              type="file"
              onChange={(e) => e.target.files?.[0] && onArquivo(e.target.files[0])}
            />
            {atual && !arquivo && (
              <a className="mt-1 inline-flex items-center gap-1 font-body-sm text-[0.8rem] text-primary hover:underline" href={atual} rel="noreferrer" target="_blank">
                <Icone nome="open_in_new" className="text-[14px]" /> Ver arquivo atual
              </a>
            )}
          </div>
        </div>
      );
      break;
    }
    case 'relacao':
      entrada = <SeletorRelacao campo={c} valor={valor} onChange={onChange} />;
      break;
    default: {
      const tipos = { email: 'email', numero: 'number', dinheiro: 'number', data: 'date', datahora: 'datetime-local', url: 'url' } as const;
      entrada = (
        <input
          className={classe}
          inputMode={c.tipo === 'dinheiro' ? 'decimal' : undefined}
          placeholder={c.placeholder}
          step={c.tipo === 'dinheiro' ? '0.01' : undefined}
          type={tipos[c.tipo as keyof typeof tipos] ?? 'text'}
          value={texto}
          onChange={(e) => onChange(c.mascara ? c.mascara(e.target.value) : e.target.value)}
        />
      );
    }
  }

  return (
    <Campo rotulo={c.rotulo} erro={erro} ajuda={c.ajuda} obrigatorio={obrigatorio}>
      {acao ? (
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">{entrada}</div>
          {acao}
        </div>
      ) : (
        entrada
      )}
    </Campo>
  );
}

/** Escolha de FK/M2M com busca local (listas de algumas centenas). */
function SeletorRelacao({ campo, valor, onChange }: { campo: CampoForm; valor: unknown; onChange: (v: unknown) => void }) {
  const rel = campo.relacao!;
  const { dados, carregando } = useCarregar(() => get<Item[]>(rel.endpoint), [rel.endpoint]);
  const [filtro, setFiltro] = useState('');
  const [aberto, setAberto] = useState(false);

  const selecionados = useMemo(
    () => (rel.multiplo ? ((valor as string[]) ?? []) : valor ? [String(valor)] : []).map(String),
    [valor, rel.multiplo],
  );
  const porId = useMemo(() => new Map((dados ?? []).map((i) => [String(i.id), i])), [dados]);
  const termo = filtro.trim().toLowerCase();
  const opcoes = (dados ?? [])
    .filter((i) => !termo || rel.rotulo(i).toLowerCase().includes(termo))
    .slice(0, 40);

  const alternar = (id: string) => {
    if (!rel.multiplo) {
      onChange(id);
      setAberto(false);
      setFiltro('');
      return;
    }
    onChange(selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id]);
  };

  return (
    <div className="relative">
      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selecionados.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-primary-fixed text-on-primary-fixed-variant pl-2.5 pr-1 py-1 font-label-sm text-label-sm">
              {porId.get(id) ? rel.rotulo(porId.get(id)!) : carregando ? '…' : id.slice(0, 8)}
              <button
                aria-label="Remover"
                className="rounded p-0.5 hover:bg-primary-fixed-dim"
                onClick={() => (rel.multiplo ? alternar(id) : onChange(''))}
                type="button"
              >
                <Icone nome="close" className="text-[14px]" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className={CLASSE_INPUT}
        placeholder={carregando ? 'Carregando…' : 'Digite para buscar…'}
        value={filtro}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onChange={(e) => {
          setFiltro(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
      />
      {aberto && !carregando && (
        <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-xl bg-surface-container-lowest shadow-xl border border-outline-variant/40 py-1">
          {opcoes.length === 0 && <li className="px-3 py-2 font-body-sm text-body-sm text-outline">Nada encontrado</li>}
          {opcoes.map((i) => {
            const id = String(i.id);
            const marcado = selecionados.includes(id);
            return (
              <li key={id}>
                <button
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left font-body-sm text-body-sm hover:bg-surface-container ${marcado ? 'text-primary font-semibold' : 'text-on-surface'}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => alternar(id)}
                  type="button"
                >
                  <Icone nome={marcado ? 'check_box' : rel.multiplo ? 'check_box_outline_blank' : 'radio_button_unchecked'} className="text-[18px]" />
                  {rel.rotulo(i)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

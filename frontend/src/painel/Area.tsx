/**
 * Área do associado (/area): extrato e pagamento online, lojas, dados,
 * parceiros e documentos. O associado paga e edita o próprio cadastro e as
 * próprias lojas; o resto é leitura.
 */
import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { WHATSAPP_URL } from '../dadosInstitucionais';
import { ErroApi, get, req, verComo, type Competencia } from './api';
import Casca, { type GrupoMenu } from './Casca';
import { OPCOES_COMUNICACAO, OPCOES_UF, STATUS_USUARIO, mascaraCep } from './recursos';
import {
  Aviso,
  Botao,
  CLASSE_INPUT,
  Campo,
  Carregando,
  Cartao,
  Icone,
  Modal,
  Selo,
  SeloSituacao,
  Vazio,
  copiar,
  dataBR,
  moeda,
  navegar,
  useCarregar,
  useToast,
} from './ui';

const MENU: GrupoMenu[] = [
  {
    itens: [
      { rota: '', rotulo: 'Pagamentos', icone: 'payments' },
      { rota: 'lojas', rotulo: 'Minhas lojas', icone: 'storefront' },
      { rota: 'dados', rotulo: 'Meus dados', icone: 'badge' },
    ],
  },
  {
    grupo: 'Benefícios',
    itens: [
      { rota: 'parceiros', rotulo: 'Parceiros', icone: 'handshake' },
      { rota: 'documentos', rotulo: 'Documentos', icone: 'folder_open' },
    ],
  },
];

export default function Area() {
  const [alvo] = useState(() => verComo.obter());
  return (
    <Casca
      base="/area"
      titulo="Área do associado"
      menu={MENU}
      permitido={() => true}
      negado=""
      rodape={(u) =>
        u.admin ? (
          <a className="flex items-center gap-3 rounded-xl px-3 py-2 mb-1 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container" href="/painel">
            <Icone nome="admin_panel_settings" className="text-[20px] text-outline" />
            Painel administrativo
          </a>
        ) : null
      }
    >
      {(rota, _busca, usuario) => {
        let pagina;
        switch (rota) {
          case 'lojas': pagina = <Lojas editavel={!alvo} />; break;
          case 'dados': pagina = <Dados editavel={!alvo} />; break;
          case 'parceiros': pagina = <Parceiros />; break;
          case 'documentos': pagina = <Documentos />; break;
          default: pagina = <Pagamentos primeiroNome={(alvo?.nome ?? usuario.nome).split(' ')[0]} podePagar={!alvo} />;
        }
        return alvo ? (
          <>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-tertiary-fixed text-on-tertiary-fixed-variant px-5 py-3.5">
              <Icone nome="visibility" className="text-[22px]" />
              <p className="flex-1 font-body-sm text-body-sm">
                Você está vendo a área de <strong>{alvo.nome}</strong> como o associado vê. Somente leitura.
              </p>
              <Botao pequeno onClick={() => verComo.encerrar()} icone="close">Sair da visualização</Botao>
            </div>
            {pagina}
          </>
        ) : (
          pagina
        );
      }}
    </Casca>
  );
}

function Titulo({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <header className="mb-6">
      <h1 className="font-headline-md text-headline-md text-on-surface">{titulo}</h1>
      {descricao && <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{descricao}</p>}
    </header>
  );
}

function Erro({ mensagem }: { mensagem: string }) {
  return (
    <Cartao>
      <Vazio icone="cloud_off" titulo="Não foi possível carregar">{mensagem}</Vazio>
    </Cartao>
  );
}

// ---------- pagamentos ----------

function Pagamentos({ primeiroNome, podePagar }: { primeiroNome: string; podePagar: boolean }) {
  const { dados, erro, recarregar } = useCarregar(() => get<Competencia[]>('/cobranca/minhas/'), []);
  const [pagando, setPagando] = useState<Competencia | null>(null);
  const [ano] = useState(() => new Date().getFullYear());

  if (erro) return <Erro mensagem={erro} />;
  if (!dados) return <Cartao><Carregando /></Cartao>;

  const pendentes = dados.filter((c) => c.situacao !== 'paga').sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  const vencidas = pendentes.filter((c) => c.situacao === 'vencida');
  const proxima = pendentes.find((c) => c.situacao !== 'vencida');
  const pagoNoAno = dados
    .filter((c) => c.data_pagamento?.startsWith(String(ano)))
    .reduce((s, c) => s + Number(c.valor_pago), 0);
  const emAberto = pendentes.reduce((s, c) => s + Number(c.saldo), 0);

  return (
    <div className="space-y-6">
      <Titulo titulo={`Olá, ${primeiroNome}`} descricao="Acompanhe suas mensalidades da AFSB e pague online." />

      {vencidas.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl bg-error-container text-on-error-container px-5 py-4">
          <Icone nome="error" className="text-[28px]" />
          <div className="flex-1">
            <p className="font-label-lg text-label-lg">
              {vencidas.length === 1 ? 'Você tem 1 mensalidade em atraso' : `Você tem ${vencidas.length} mensalidades em atraso`}
            </p>
            <p className="font-body-sm text-body-sm">
              Total de {moeda(vencidas.reduce((s, c) => s + Number(c.saldo), 0))}. Regularize para manter seus benefícios.
            </p>
          </div>
          {podePagar && (
            <Botao variante="perigo" icone="bolt" onClick={() => setPagando(vencidas[0])}>
              Pagar {vencidas[0].periodo}
            </Botao>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Cartao className="p-6 lg:col-span-2">
          {proxima ? (
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant">Próxima mensalidade · {proxima.periodo}</p>
                <p className="mt-2 text-[2.5rem] leading-none font-extrabold tracking-tight text-on-surface tabular-nums">{moeda(proxima.saldo)}</p>
                <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
                  Vence em <strong className="text-on-surface">{dataBR(proxima.data_vencimento)}</strong>
                  {proxima.valor_desconto && <> · depois do vencimento {moeda(Number(proxima.valor_cheio) - Number(proxima.valor_pago))}</>}
                </p>
              </div>
              {podePagar && (
                <Botao variante="primario" icone="bolt" className="sm:px-6 sm:py-3" onClick={() => setPagando(proxima)}>
                  Pagar agora
                </Botao>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="w-12 h-12 rounded-full bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center">
                <Icone nome="verified" className="text-[26px]" />
              </span>
              <div>
                <p className="font-label-lg text-label-lg text-on-surface">Tudo em dia</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Nenhuma mensalidade pendente no momento.</p>
              </div>
            </div>
          )}
        </Cartao>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
          <Cartao className="p-5">
            <p className="font-label-md text-label-md text-on-surface-variant">Pago em {ano}</p>
            <p className="mt-1 font-headline-sm text-headline-sm text-on-surface tabular-nums">{moeda(pagoNoAno)}</p>
          </Cartao>
          <Cartao className="p-5">
            <p className="font-label-md text-label-md text-on-surface-variant">Em aberto</p>
            <p className={`mt-1 font-headline-sm text-headline-sm tabular-nums ${vencidas.length ? 'text-error' : 'text-on-surface'}`}>{moeda(emAberto)}</p>
          </Cartao>
        </div>
      </div>

      <Cartao>
        <h2 className="px-5 pt-5 pb-3 font-label-lg text-label-lg text-on-surface">Extrato</h2>
        {dados.length === 0 ? (
          <Vazio icone="receipt_long" titulo="Nenhuma mensalidade ainda">Suas cobranças aparecerão aqui.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="font-label-md text-label-md text-on-surface-variant">
                  <th className="px-5 py-2.5 font-semibold">Mensalidade</th>
                  <th className="px-3 py-2.5 font-semibold hidden sm:table-cell">Vencimento</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Valor</th>
                  <th className="px-3 py-2.5 font-semibold hidden md:table-cell">Pago em</th>
                  <th className="px-3 py-2.5 font-semibold">Situação</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="font-body-sm text-body-sm text-on-surface">
                {dados.map((c) => {
                  const paga = c.situacao === 'paga';
                  const recibo = c.recebimentos[0]?.comprovante;
                  return (
                    <tr key={c.id} className="border-t border-outline-variant/30">
                      <td className="px-5 py-3">
                        <span className="font-semibold tabular-nums">{c.periodo}</span>
                        <span className="block text-[0.8rem] text-on-surface-variant">{c.nome_pagador}</span>
                      </td>
                      <td className="px-3 py-3 tabular-nums hidden sm:table-cell">{dataBR(c.data_vencimento)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold">{moeda(paga ? c.valor_pago : c.saldo)}</td>
                      <td className="px-3 py-3 tabular-nums hidden md:table-cell">
                        {paga ? (
                          <>
                            {dataBR(c.data_pagamento)}
                            <span className="block text-[0.75rem] text-on-surface-variant">{c.recebimentos.length ? 'PIX direto' : 'Online'}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-3"><SeloSituacao situacao={c.situacao} /></td>
                      <td className="px-5 py-3 text-right">
                        {!paga ? (
                          podePagar && <Botao pequeno variante={c.situacao === 'vencida' ? 'primario' : 'secundario'} onClick={() => setPagando(c)}>
                            Pagar
                          </Botao>
                        ) : recibo ? (
                          <a className="font-label-md text-label-md text-primary hover:underline" href={recibo} rel="noreferrer" target="_blank">Comprovante</a>
                        ) : c.cobranca?.invoice_url ? (
                          <a className="font-label-md text-label-md text-primary hover:underline" href={c.cobranca.invoice_url} rel="noreferrer" target="_blank">Recibo</a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {pagando && (
        <Pagar
          competencia={pagando}
          onFechar={() => {
            setPagando(null);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

/** Garante uma cobrança válida no Asaas e entrega o link da fatura + PIX. */
function Pagar({ competencia, onFechar }: { competencia: Competencia; onFechar: () => void }) {
  const avisar = useToast();
  const [dados, setDados] = useState<Competencia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pedido = useRef(false);

  // Um POST só (o StrictMode roda o efeito duas vezes em dev): evita gerar duas cobranças.
  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;
    req<Competencia>('POST', `/cobranca/minhas/${competencia.id}/pagar/`)
      .then(setDados)
      .catch((e: Error) => setErro(e.message));
  }, [competencia.id]);
  const cob = dados?.cobranca;

  return (
    <Modal titulo={`Pagar mensalidade ${competencia.periodo}`} subtitulo={competencia.nome_pagador} onFechar={onFechar}>
      {erro ? (
        <div className="space-y-4">
          <Aviso tom="erro" icone="error">{erro}</Aviso>
          <a className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-label-lg text-label-lg text-white bg-[#25D366] hover:brightness-95" href={WHATSAPP_URL} rel="noreferrer" target="_blank">
            <Icone nome="chat" className="text-[18px]" /> Falar com a AFSB
          </a>
        </div>
      ) : !cob ? (
        <div className="flex flex-col items-center gap-3 py-8 text-on-surface-variant font-body-sm text-body-sm">
          <Icone nome="progress_activity" className="text-[32px] text-primary animate-spin" />
          Preparando seu pagamento…
        </div>
      ) : (
        <div className="space-y-5">
          <div className="text-center">
            <p className="font-body-sm text-body-sm text-on-surface-variant">Valor</p>
            <p className="text-[2.25rem] leading-tight font-extrabold text-on-surface tabular-nums">{moeda(dados.saldo)}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Vencimento {dataBR(cob.data_vencimento)}</p>
          </div>
          {cob.invoice_url && (
            <a
              className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl font-label-lg text-label-lg text-on-primary bg-primary hover:bg-on-primary-fixed-variant shadow-[0_2px_4px_rgba(0,101,44,0.15)]"
              href={cob.invoice_url}
              rel="noreferrer"
              target="_blank"
            >
              <Icone nome="open_in_new" className="text-[18px]" /> Abrir página de pagamento
            </a>
          )}
          <p className="text-center font-body-sm text-[0.8rem] text-on-surface-variant">
            Na página segura do Asaas você escolhe PIX, boleto ou cartão de crédito.
          </p>
          {cob.pix_copia_cola && (
            <div className="rounded-xl bg-surface-container-low p-4 space-y-2">
              <p className="font-label-md text-label-md text-on-surface">PIX copia e cola</p>
              <p className="font-mono text-[0.7rem] text-on-surface-variant break-all line-clamp-2">{cob.pix_copia_cola}</p>
              <Botao pequeno icone="content_copy" onClick={() => copiar(cob.pix_copia_cola!, avisar, 'Código PIX copiado')}>
                Copiar código
              </Botao>
            </div>
          )}
          <p className="text-center font-body-sm text-[0.75rem] text-outline">
            A confirmação pode levar alguns minutos para aparecer no extrato.
          </p>
        </div>
      )}
    </Modal>
  );
}

// ---------- edição (dados e lojas) ----------

type Form = Record<string, string>;

/** Estado de um formulário de edição: valores, erros por campo e o PATCH. */
function useEdicao(rota: string, aoSalvar: () => void) {
  const avisar = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [erros, setErros] = useState<Form>({});
  const [salvando, setSalvando] = useState(false);

  const mudar = (campo: string, valor: string) => {
    setForm((f) => f && { ...f, [campo]: valor });
    setErros((e) => ({ ...e, [campo]: '' }));
  };
  const abrir = (inicial: Form | null) => {
    setForm(inicial);
    setErros({});
  };
  const salvar = async () => {
    if (!form) return;
    setSalvando(true);
    try {
      await req('PATCH', rota, form);
      avisar('Alterações salvas.');
      setForm(null);
      aoSalvar();
    } catch (e) {
      if (e instanceof ErroApi) setErros(e.campos);
      avisar((e as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  };
  return { form, erros, salvando, mudar, abrir, salvar };
}

function Entrada({
  rotulo,
  campo,
  edicao,
  className = '',
  mascara,
  ...props
}: {
  rotulo: string;
  campo: string;
  edicao: ReturnType<typeof useEdicao>;
  className?: string;
  mascara?: (v: string) => string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>) {
  return (
    <Campo rotulo={rotulo} erro={edicao.erros[campo]} className={className}>
      <input
        className={CLASSE_INPUT}
        value={edicao.form?.[campo] ?? ''}
        onChange={(e) => edicao.mudar(campo, mascara ? mascara(e.target.value) : e.target.value)}
        {...props}
      />
    </Campo>
  );
}

function Selecao({
  rotulo,
  campo,
  edicao,
  opcoes,
  className = '',
}: {
  rotulo: string;
  campo: string;
  edicao: ReturnType<typeof useEdicao>;
  opcoes: { valor: string; rotulo: string }[];
  className?: string;
}) {
  return (
    <Campo rotulo={rotulo} erro={edicao.erros[campo]} className={className}>
      <select className={CLASSE_INPUT} value={edicao.form?.[campo] ?? ''} onChange={(e) => edicao.mudar(campo, e.target.value)}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>{o.rotulo}</option>
        ))}
      </select>
    </Campo>
  );
}

const mascaraFone = (v: string) => {
  const d = v.replace(/\D/g, '').replace(/^55(?=\d{11})/, '').slice(0, 11);
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
};

// ---------- lojas ----------

interface Franquia {
  id: string;
  nro_da_loja: number;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  socios: string[];
}

function Lojas({ editavel }: { editavel: boolean }) {
  const { dados, erro, recarregar } = useCarregar(() => get<Franquia[]>('/franquia/minhas/'), []);
  const [editando, setEditando] = useState<Franquia | null>(null);
  const edicao = useEdicao(`/franquia/minhas/${editando?.id}/`, () => {
    setEditando(null);
    recarregar();
  });
  const editar = (f: Franquia) => {
    setEditando(f);
    const { nome_fantasia, cep, rua, numero, complemento, bairro, cidade, estado } = f;
    edicao.abrir({ nome_fantasia, cep, rua, numero, complemento: complemento ?? '', bairro, cidade, estado });
  };
  const fechar = () => {
    setEditando(null);
    edicao.abrir(null);
  };

  if (erro) return <Erro mensagem={erro} />;
  return (
    <>
      <Titulo titulo="Minhas lojas" descricao="Lojas vinculadas ao seu cadastro na AFSB." />
      {!dados ? (
        <Cartao><Carregando linhas={3} /></Cartao>
      ) : dados.length === 0 ? (
        <Cartao>
          <Vazio icone="storefront" titulo="Nenhuma loja vinculada">Se faltar alguma loja, fale com a AFSB.</Vazio>
        </Cartao>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dados.map((f) => (
            <Cartao key={f.id} className="p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-label-lg text-label-lg text-on-surface truncate">{f.nome_fantasia}</p>
                  <p className="font-body-sm text-[0.8rem] text-on-surface-variant truncate">{f.razao_social}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-primary-fixed text-on-primary-fixed-variant px-2.5 py-1 font-label-md text-label-md tabular-nums">
                  Loja {f.nro_da_loja}
                </span>
              </div>
              <dl className="flex-1 space-y-2 font-body-sm text-body-sm">
                <div className="flex gap-2">
                  <Icone nome="id_card" className="text-[18px] text-outline" />
                  <dd className="tabular-nums">{f.cnpj}</dd>
                </div>
                <div className="flex gap-2">
                  <Icone nome="location_on" className="text-[18px] text-outline" />
                  <dd>
                    {f.rua}, {f.numero}{f.complemento ? ` – ${f.complemento}` : ''}
                    <span className="block text-on-surface-variant">{f.bairro} · {f.cidade}/{f.estado} · {f.cep}</span>
                  </dd>
                </div>
                {f.socios.length > 1 && (
                  <div className="flex gap-2">
                    <Icone nome="group" className="text-[18px] text-outline" />
                    <dd className="text-on-surface-variant">{f.socios.join(', ')}</dd>
                  </div>
                )}
              </dl>
              {editavel && (
                <Botao pequeno icone="edit" className="self-start" onClick={() => editar(f)}>Editar loja</Botao>
              )}
            </Cartao>
          ))}
        </div>
      )}

      {editando && edicao.form && (
        <Modal
          titulo={`Editar loja ${editando.nro_da_loja}`}
          subtitulo={`${editando.razao_social} · ${editando.cnpj}`}
          largura="max-w-2xl"
          onFechar={fechar}
          rodape={
            <>
              <Botao variante="fantasma" onClick={fechar}>Cancelar</Botao>
              <Botao variante="primario" icone="check" carregando={edicao.salvando} onClick={edicao.salvar}>Salvar</Botao>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
            <Entrada rotulo="Nome fantasia" campo="nome_fantasia" edicao={edicao} className="sm:col-span-6" />
            <Entrada rotulo="CEP" campo="cep" edicao={edicao} mascara={mascaraCep} inputMode="numeric" className="sm:col-span-2" />
            <Entrada rotulo="Rua" campo="rua" edicao={edicao} className="sm:col-span-4" />
            <Entrada rotulo="Número" campo="numero" edicao={edicao} className="sm:col-span-2" />
            <Entrada rotulo="Complemento" campo="complemento" edicao={edicao} className="sm:col-span-4" />
            <Entrada rotulo="Bairro" campo="bairro" edicao={edicao} className="sm:col-span-2" />
            <Entrada rotulo="Cidade" campo="cidade" edicao={edicao} className="sm:col-span-3" />
            <Selecao rotulo="UF" campo="estado" edicao={edicao} opcoes={OPCOES_UF} className="sm:col-span-1" />
          </div>
          <p className="mt-4 font-body-sm text-[0.8rem] text-outline">
            Nº da loja, CNPJ, razão social e sócios são alterados pela AFSB.
          </p>
        </Modal>
      )}
    </>
  );
}

// ---------- dados ----------

interface MeusDados {
  nome: string;
  email: string;
  cpf: string;
  whatsapp: string;
  nro_associado: number | null;
  status: string;
  status_display: string;
  tipo_comunicacao: string;
  tipo_comunicacao_display: string;
  data_admissao: string | null;
  qtd_lojas: number;
}

function Info({ rotulo, icone, children }: { rotulo: string; icone: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="w-10 h-10 shrink-0 rounded-xl bg-surface-container flex items-center justify-center text-outline">
        <Icone nome={icone} className="text-[20px]" />
      </span>
      <div className="min-w-0">
        <dt className="font-body-sm text-[0.8rem] text-on-surface-variant">{rotulo}</dt>
        <dd className="font-label-lg text-label-lg text-on-surface break-words">{children}</dd>
      </div>
    </div>
  );
}

function Dados({ editavel }: { editavel: boolean }) {
  const { dados, erro, recarregar } = useCarregar(() => get<MeusDados>('/usuario/me/dados/'), []);
  const edicao = useEdicao('/usuario/me/dados/', recarregar);
  if (erro) return <Erro mensagem={erro} />;

  const titulo = <Titulo titulo="Meus dados" descricao="Informações do seu cadastro na AFSB." />;
  if (!dados) {
    return (
      <>
        {titulo}
        <Cartao><Carregando linhas={6} /></Cartao>
      </>
    );
  }

  const iniciais = dados.nome.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const situacao = STATUS_USUARIO[dados.status];
  const editar = () =>
    edicao.abrir({
      nome: dados.nome,
      email: dados.email,
      whatsapp: mascaraFone(dados.whatsapp),
      tipo_comunicacao: dados.tipo_comunicacao,
    });

  return (
    <>
      {titulo}

      <Cartao className="mb-6 p-6 flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="w-16 h-16 shrink-0 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-headline-sm text-headline-sm font-bold">
            {iniciais}
          </span>
          <div className="min-w-0">
            <p className="font-headline-sm text-headline-sm font-bold text-on-surface truncate">{dados.nome}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{dados.email}</p>
            {situacao && <div className="mt-2"><Selo tom={situacao.tom}>{situacao.rotulo}</Selo></div>}
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 lg:gap-10 lg:pl-10 lg:border-l border-outline-variant/40">
          {(
            [
              ['Nº de associado', dados.nro_associado ? `#${dados.nro_associado}` : '—'],
              ['Associado desde', dataBR(dados.data_admissao)],
              ['Lojas', String(dados.qtd_lojas)],
            ] as const
          ).map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="font-body-sm text-[0.8rem] text-on-surface-variant">{rotulo}</dt>
              <dd className="mt-0.5 font-headline-sm text-headline-sm font-bold text-on-surface tabular-nums">{valor}</dd>
            </div>
          ))}
        </dl>
      </Cartao>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Cartao className="xl:col-span-2">
          <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-outline-variant/30">
            <h2 className="font-label-lg text-label-lg text-on-surface">Dados pessoais</h2>
            {editavel && !edicao.form && <Botao pequeno icone="edit" onClick={editar}>Editar</Botao>}
          </div>
          {edicao.form ? (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Entrada rotulo="Nome completo" campo="nome" edicao={edicao} autoComplete="name" className="md:col-span-2" />
                <Entrada rotulo="E-mail de acesso" campo="email" edicao={edicao} type="email" autoComplete="email" />
                <Entrada rotulo="WhatsApp" campo="whatsapp" edicao={edicao} mascara={mascaraFone} inputMode="tel" placeholder="(11) 99999-8888" />
                <Selecao rotulo="Receber comunicados por" campo="tipo_comunicacao" edicao={edicao} opcoes={OPCOES_COMUNICACAO} />
                <Campo rotulo="CPF" ajuda="Alterado somente pela AFSB.">
                  <input className={CLASSE_INPUT} value={dados.cpf} disabled />
                </Campo>
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Botao variante="fantasma" onClick={() => edicao.abrir(null)}>Cancelar</Botao>
                <Botao variante="primario" icone="check" carregando={edicao.salvando} onClick={edicao.salvar}>Salvar alterações</Botao>
              </div>
            </div>
          ) : (
            <dl className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <Info rotulo="Nome" icone="person">{dados.nome}</Info>
              <Info rotulo="E-mail de acesso" icone="mail">{dados.email}</Info>
              <Info rotulo="CPF" icone="id_card">{dados.cpf}</Info>
              <Info rotulo="WhatsApp" icone="call">{mascaraFone(dados.whatsapp)}</Info>
              <Info rotulo="Comunicação por" icone="notifications">{dados.tipo_comunicacao_display}</Info>
            </dl>
          )}
        </Cartao>

        <Cartao className="p-6 flex flex-col gap-4">
          <span className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-outline">
            <Icone nome="support_agent" className="text-[20px]" />
          </span>
          <div>
            <h2 className="font-label-lg text-label-lg text-on-surface">Outros ajustes</h2>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              CPF, número de associado e lojas vinculadas são alterados pela AFSB. Endereço e nome das lojas você edita em{' '}
              <button type="button" className="text-primary font-semibold hover:underline" onClick={() => navegar('/area/lojas')}>
                Minhas lojas
              </button>
              .
            </p>
          </div>
          <a
            className="mt-auto self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl font-label-md text-label-md text-white bg-[#25D366] hover:brightness-95"
            href={WHATSAPP_URL}
            rel="noreferrer"
            target="_blank"
          >
            <Icone nome="chat" className="text-[16px]" /> Falar com a AFSB
          </a>
        </Cartao>
      </div>
    </>
  );
}

// ---------- parceiros ----------

interface Parceiro {
  id: string;
  tipo: string;
  nome: string;
  beneficios: string | null;
  logo: string | null;
  site: string | null;
  contato: string | null;
}

function Parceiros() {
  const { dados, erro } = useCarregar(() => get<Parceiro[]>('/parceiro/'), []);
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();
  const lista = (dados ?? []).filter((p) => !termo || `${p.nome} ${p.beneficios ?? ''}`.toLowerCase().includes(termo));

  if (erro) return <Erro mensagem={erro} />;
  return (
    <>
      <Titulo titulo="Parceiros" descricao="Condições exclusivas para associados AFSB em dia." />
      <div className="relative max-w-md mb-5">
        <Icone nome="search" className="absolute left-3 top-2.5 text-[20px] text-outline" />
        <input className={`${CLASSE_INPUT} pl-10 bg-surface-container-lowest`} placeholder="Buscar parceiro ou benefício" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {!dados ? (
        <Cartao><Carregando /></Cartao>
      ) : lista.length === 0 ? (
        <Cartao><Vazio icone="handshake" titulo="Nenhum parceiro encontrado" /></Cartao>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {lista.map((p) => <CartaoParceiro key={p.id} parceiro={p} />)}
        </div>
      )}
    </>
  );
}

function CartaoParceiro({ parceiro: p }: { parceiro: Parceiro }) {
  const [aberto, setAberto] = useState(false);
  const [resumo, ...resto] = (p.beneficios ?? '').split(/\n\s*\n/);
  const detalhes = resto.join('\n\n');
  return (
    <Cartao className="p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3 min-h-10">
        {p.logo ? (
          <img alt="" className="h-9 w-auto max-w-[110px] object-contain" src={p.logo} />
        ) : (
          <span className="w-10 h-10 rounded-xl bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center">
            <Icone nome="workspace_premium" className="text-[22px]" />
          </span>
        )}
      </div>
      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{p.nome}</h3>
      {resumo && <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed whitespace-pre-line">{resumo}</p>}
      {detalhes && (
        <>
          {aberto && <p className="font-body-sm text-body-sm text-on-surface leading-relaxed whitespace-pre-line">{detalhes}</p>}
          <button className="self-start inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline" onClick={() => setAberto(!aberto)} type="button">
            {aberto ? 'Menos detalhes' : 'Ver condições'}
            <Icone nome={aberto ? 'expand_less' : 'expand_more'} className="text-[18px]" />
          </button>
        </>
      )}
      {(p.contato || p.site) && (
        <div className="mt-1 pt-3 border-t border-outline-variant/40 space-y-2 font-body-sm text-body-sm">
          {p.contato && (
            <p className="flex gap-2 text-on-surface">
              <Icone nome="contact_phone" className="text-[18px] text-outline" />
              {p.contato}
            </p>
          )}
          {p.site && (
            <a className="inline-flex items-center gap-1 text-primary font-semibold hover:underline" href={p.site} rel="noreferrer" target="_blank">
              Visitar site <Icone nome="open_in_new" className="text-[16px]" />
            </a>
          )}
        </div>
      )}
    </Cartao>
  );
}

// ---------- documentos ----------

interface Documento {
  id: string;
  titulo: string;
  tipo: string;
  arquivo: string;
  criado_em: string;
}

const TIPOS: Record<string, { rotulo: string; singular: string; icone: string }> = {
  video: { rotulo: 'Vídeos', singular: 'Vídeo', icone: 'play_circle' },
  palestra: { rotulo: 'Palestras', singular: 'Palestra', icone: 'co_present' },
  ata_de_reuniao: { rotulo: 'Atas de reunião', singular: 'Ata de reunião', icone: 'gavel' },
  documento: { rotulo: 'Documentos', singular: 'Documento', icone: 'description' },
};

function Documentos() {
  const { dados, erro } = useCarregar(() => get<Documento[]>('/documento/'), []);
  const [filtro, setFiltro] = useState('');
  const presentes = useMemo(() => Object.keys(TIPOS).filter((t) => dados?.some((d) => d.tipo === t)), [dados]);
  const lista = (dados ?? []).filter((d) => !filtro || d.tipo === filtro);
  const videos = lista.filter((d) => d.tipo === 'video');
  const arquivos = lista.filter((d) => d.tipo !== 'video');

  if (erro) return <Erro mensagem={erro} />;
  return (
    <>
      <Titulo titulo="Documentos" descricao="Materiais, palestras, atas e vídeos da AFSB." />
      {presentes.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {['', ...presentes].map((t) => (
            <button
              key={t || 'todos'}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md transition-colors ${
                filtro === t ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
              }`}
              onClick={() => setFiltro(t)}
              type="button"
            >
              {t && <Icone nome={TIPOS[t].icone} className="text-[16px]" />}
              {t ? TIPOS[t].rotulo : 'Todos'}
            </button>
          ))}
        </div>
      )}
      {!dados ? (
        <Cartao><Carregando /></Cartao>
      ) : lista.length === 0 ? (
        <Cartao><Vazio icone="folder_open" titulo="Nenhum documento disponível" /></Cartao>
      ) : (
        <div className="space-y-6">
          {videos.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {videos.map((v) => (
                <Cartao key={v.id} className="overflow-hidden">
                  <video className="w-full aspect-video bg-slate-950" controls playsInline preload="metadata" src={v.arquivo}>
                    Seu navegador não reproduz este vídeo. <a href={v.arquivo}>Baixar</a>
                  </video>
                  <div className="px-5 py-3.5">
                    <p className="font-label-lg text-label-lg text-on-surface">{v.titulo}</p>
                    <p className="font-body-sm text-[0.8rem] text-on-surface-variant">Publicado em {dataBR(v.criado_em)}</p>
                  </div>
                </Cartao>
              ))}
            </div>
          )}
          {arquivos.length > 0 && (
            <Cartao>
              <ul>
                {arquivos.map((d) => {
                  const tipo = TIPOS[d.tipo] ?? TIPOS.documento;
                  return (
                    <li key={d.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-outline-variant/30 last:border-0">
                      <span className="w-10 h-10 shrink-0 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-center">
                        <Icone nome={tipo.icone} className="text-[22px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-label-lg text-label-lg text-on-surface truncate">{d.titulo}</p>
                        <p className="font-body-sm text-[0.8rem] text-on-surface-variant">
                          {tipo.singular} · {dataBR(d.criado_em)}
                        </p>
                      </div>
                      <a className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-label-md text-label-md bg-surface-container-high hover:bg-surface-container-highest text-on-surface" href={d.arquivo} rel="noreferrer" target="_blank">
                        <Icone nome="download" className="text-[16px]" /> Abrir
                      </a>
                    </li>
                  );
                })}
              </ul>
            </Cartao>
          )}
        </div>
      )}
    </>
  );
}

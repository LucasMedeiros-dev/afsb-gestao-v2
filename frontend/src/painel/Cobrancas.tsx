import { useState, type FormEvent, type ReactNode } from 'react';
import { ErroApi, get, qs, req, verComo, type Competencia } from './api';
import {
  Aviso,
  Botao,
  CLASSE_INPUT,
  Campo,
  Carregando,
  Cartao,
  Icone,
  MESES,
  Modal,
  SITUACOES,
  SeloSituacao,
  Vazio,
  copiar,
  dataBR,
  dataHoraBR,
  hojeISO,
  linkWhatsApp,
  moeda,
  navegar,
  useAtraso,
  useCarregar,
  useToast,
} from './ui';

const ABAS = ['', 'aberta', 'vencida', 'parcial', 'paga'] as const;

export default function Cobrancas({ busca: params }: { busca: URLSearchParams }) {
  const filtros = {
    situacao: params.get('situacao') ?? '',
    ano: params.get('ano') ?? '',
    mes: params.get('mes') ?? '',
    usuario: params.get('usuario') ?? '',
  };
  const [texto, setTexto] = useState('');
  const termo = useAtraso(texto);
  const [aberta, setAberta] = useState<Competencia | null>(null);
  const [acao, setAcao] = useState<{ tipo: 'reemitir' | 'receber'; competencia: Competencia } | null>(null);

  const { dados, erro, carregando, recarregar } = useCarregar(
    () => get<Competencia[]>(`/cobranca/competencias/${qs({ ...filtros, search: termo })}`),
    [params.toString(), termo],
  );

  const mudar = (novos: Partial<typeof filtros>) => navegar(`/painel/cobrancas${qs({ ...filtros, ...novos })}`);
  const atualizar = (c: Competencia) => {
    setAberta((a) => (a?.id === c.id ? c : a));
    recarregar();
  };

  const [anoAtual] = useState(() => new Date().getFullYear());
  const nomeFiltrado = filtros.usuario && dados?.[0]?.associado.nome;

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Cobranças</h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Competências geradas todo mês. Reemita a cobrança ou registre um PIX recebido fora do Asaas.
          </p>
        </div>
      </header>

      <Cartao>
        <div className="flex gap-1 px-3 pt-3 overflow-x-auto no-scrollbar border-b border-outline-variant/40">
          {ABAS.map((s) => {
            const ativa = filtros.situacao === s;
            return (
              <button
                key={s || 'todas'}
                className={`px-4 py-2.5 -mb-px border-b-2 font-label-lg text-label-lg whitespace-nowrap transition-colors ${
                  ativa ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
                onClick={() => mudar({ situacao: s })}
                type="button"
              >
                {s ? SITUACOES[s].rotulo : 'Todas'}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row gap-3 p-4 border-b border-outline-variant/40">
          <div className="relative flex-1">
            <Icone nome="search" className="absolute left-3 top-2.5 text-[20px] text-outline" />
            <input
              className={`${CLASSE_INPUT} pl-10`}
              placeholder="Associado, pagador, documento ou nº"
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <select aria-label="Mês" className={`${CLASSE_INPUT} md:w-40`} value={filtros.mes} onChange={(e) => mudar({ mes: e.target.value })}>
            <option value="">Mês: todos</option>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select aria-label="Ano" className={`${CLASSE_INPUT} md:w-32`} value={filtros.ano} onChange={(e) => mudar({ ano: e.target.value })}>
            <option value="">Ano: todos</option>
            {[anoAtual + 1, anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {filtros.usuario && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-low font-body-sm text-body-sm text-on-surface-variant">
            <Icone nome="filter_alt" className="text-[18px]" />
            Somente {nomeFiltrado || 'o associado selecionado'}
            <button className="ml-1 text-primary font-semibold hover:underline" onClick={() => mudar({ usuario: '' })} type="button">
              Limpar
            </button>
          </div>
        )}

        {erro ? (
          <Vazio icone="cloud_off" titulo="Não foi possível carregar">{erro}</Vazio>
        ) : carregando && !dados ? (
          <Carregando />
        ) : !dados?.length ? (
          <Vazio icone="receipt_long" titulo="Nenhuma cobrança encontrada">
            As competências são criadas automaticamente todo mês a partir dos perfis de cobrança ativos.
          </Vazio>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${carregando ? 'opacity-60' : ''}`}>
            <table className="w-full text-left">
              <thead>
                <tr className="font-label-md text-label-md text-on-surface-variant">
                  <th className="px-4 py-3 font-semibold">Associado</th>
                  <th className="px-3 py-3 font-semibold">Período</th>
                  <th className="px-3 py-3 font-semibold hidden md:table-cell">Vencimento</th>
                  <th className="px-3 py-3 font-semibold text-right">Valor</th>
                  <th className="px-3 py-3 font-semibold">Situação</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="font-body-sm text-body-sm text-on-surface">
                {dados.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-outline-variant/30 hover:bg-surface-container-low cursor-pointer"
                    onClick={() => setAberta(c)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold">{c.associado.nome}</span>
                      <span className="block text-[0.8rem] text-on-surface-variant">
                        {c.associado.nro ? `#${c.associado.nro} · ` : ''}{c.nome_pagador}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{c.periodo}</td>
                    <td className="px-3 py-3 tabular-nums hidden md:table-cell">{dataBR(c.data_vencimento)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className="font-semibold">{moeda(c.situacao === 'paga' ? c.valor_pago : c.saldo)}</span>
                      {c.situacao !== 'paga' && Number(c.valor_pago) > 0 && (
                        <span className="block text-[0.75rem] text-on-surface-variant">pago {moeda(c.valor_pago)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3"><SeloSituacao situacao={c.situacao} /></td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {c.situacao !== 'paga' && c.situacao !== 'cancelada' && (
                        <div className="flex justify-end gap-1">
                          <Botao pequeno variante="fantasma" icone="restart_alt" onClick={() => setAcao({ tipo: 'reemitir', competencia: c })}>
                            <span className="hidden lg:inline">Reemitir</span>
                          </Botao>
                          <Botao pequeno icone="qr_code_2" onClick={() => setAcao({ tipo: 'receber', competencia: c })}>
                            <span className="hidden lg:inline">Receber PIX</span>
                          </Botao>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-3 border-t border-outline-variant/40 font-body-sm text-body-sm text-on-surface-variant">
              {dados.length} competência{dados.length === 1 ? '' : 's'}
            </p>
          </div>
        )}
      </Cartao>

      {aberta && !acao && (
        <Detalhe
          competencia={aberta}
          onFechar={() => setAberta(null)}
          onAcao={(tipo) => setAcao({ tipo, competencia: aberta })}
          onAtualizada={atualizar}
        />
      )}
      {acao?.tipo === 'reemitir' && (
        <Reemitir competencia={acao.competencia} onFechar={() => setAcao(null)} onAtualizada={(c) => { atualizar(c); setAcao({ tipo: 'reemitir', competencia: c }); }} />
      )}
      {acao?.tipo === 'receber' && (
        <Receber competencia={acao.competencia} onFechar={() => setAcao(null)} onAtualizada={(c) => { atualizar(c); setAcao(null); }} />
      )}
    </div>
  );
}

// ---------- detalhe ----------

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-outline-variant/30 last:border-0">
      <dt className="text-on-surface-variant">{rotulo}</dt>
      <dd className="text-right text-on-surface font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function Detalhe({
  competencia: c,
  onFechar,
  onAcao,
  onAtualizada,
}: {
  competencia: Competencia;
  onFechar: () => void;
  onAcao: (tipo: 'reemitir' | 'receber') => void;
  onAtualizada: (c: Competencia) => void;
}) {
  const emAberto = c.situacao !== 'paga' && c.situacao !== 'cancelada';
  return (
    <Modal
      largura="max-w-2xl"
      titulo={`${c.associado.nome} · ${c.periodo}`}
      subtitulo={`${c.nome_pagador} · ${c.documento} · ${c.forma_pagamento}`}
      onFechar={onFechar}
      rodape={
        emAberto ? (
          <>
            <Botao variante="fantasma" onClick={onFechar}>Fechar</Botao>
            <Botao icone="restart_alt" onClick={() => onAcao('reemitir')}>Reemitir cobrança</Botao>
            <Botao variante="primario" icone="qr_code_2" onClick={() => onAcao('receber')}>Receber PIX manual</Botao>
          </>
        ) : (
          <Botao variante="fantasma" onClick={onFechar}>Fechar</Botao>
        )
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <SeloSituacao situacao={c.situacao} />
          <span className="flex gap-4">
            <button
              className="font-body-sm text-body-sm text-primary font-semibold hover:underline"
              onClick={() => navegar(`/painel/cobrancas?usuario=${c.associado.id}`)}
              type="button"
            >
              Histórico
            </button>
            <button
              className="font-body-sm text-body-sm text-primary font-semibold hover:underline"
              onClick={() => verComo.iniciar(c.associado.id, c.associado.nome)}
              type="button"
            >
              Ver como associado
            </button>
          </span>
        </div>
        <dl className="font-body-sm text-body-sm">
          <Linha rotulo="Vencimento">{dataBR(c.data_vencimento)}</Linha>
          {c.valor_desconto && <Linha rotulo="Valor até o vencimento">{moeda(c.valor_desconto)}</Linha>}
          <Linha rotulo="Valor após o vencimento">{moeda(c.valor_cheio)}</Linha>
          <Linha rotulo="Pago">{moeda(c.valor_pago)}{c.data_pagamento ? ` em ${dataBR(c.data_pagamento)}` : ''}</Linha>
          {emAberto && <Linha rotulo="Saldo hoje">{moeda(c.saldo)}</Linha>}
        </dl>

        <section>
          <h3 className="mb-2 font-label-lg text-label-lg text-on-surface">Cobrança no Asaas</h3>
          {c.cobranca ? (
            <CartaoCobranca competencia={c} onAtualizada={onAtualizada} />
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Nenhuma cobrança emitida para esta competência.</p>
          )}
        </section>

        {c.recebimentos.length > 0 && (
          <section>
            <h3 className="mb-2 font-label-lg text-label-lg text-on-surface">Recebimentos manuais</h3>
            <ul className="space-y-2">
              {c.recebimentos.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl bg-surface-container-low px-4 py-3 font-body-sm text-body-sm">
                  <Icone nome="receipt" className="text-[20px] text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-on-surface font-semibold">{moeda(r.valor)} · {r.forma_display} · {dataBR(r.data_pagamento)}</p>
                    <p className="text-[0.8rem] text-on-surface-variant truncate">
                      Registrado por {r.registrado_por_nome} em {dataHoraBR(r.data_criacao)}{r.observacao ? ` · ${r.observacao}` : ''}
                    </p>
                  </div>
                  <a className="text-primary font-semibold hover:underline whitespace-nowrap" href={r.comprovante} rel="noreferrer" target="_blank">
                    Comprovante
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}

/** Links da cobrança atual + reenvio por WhatsApp/e-mail. */
function CartaoCobranca({ competencia: c, onAtualizada }: { competencia: Competencia; onAtualizada?: (c: Competencia) => void }) {
  const avisar = useToast();
  const [enviando, setEnviando] = useState(false);
  const cob = c.cobranca!;
  const ativa = cob.status === 'PENDING' || cob.status === 'OVERDUE';
  const mensagem =
    `Olá, ${c.associado.nome.split(' ')[0]}! Segue a cobrança da mensalidade AFSB (${c.periodo}), ` +
    `vencimento ${dataBR(cob.data_vencimento)}, ${moeda(cob.valor)}:\n${cob.invoice_url}` +
    (cob.pix_copia_cola ? `\n\nPIX copia e cola:\n${cob.pix_copia_cola}` : '');

  const enviarEmail = async () => {
    setEnviando(true);
    try {
      const r = await req<{ detail: string }>('POST', `/cobranca/competencias/${c.id}/enviar-email/`);
      avisar(r.detail);
      onAtualizada?.(c);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Falha ao enviar', 'erro');
    }
    setEnviando(false);
  };

  return (
    <div className="rounded-xl border border-outline-variant/50 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 font-body-sm text-body-sm">
        <span className="text-on-surface">
          <strong>{cob.tipo_display}</strong> · {moeda(cob.valor)} · vence {dataBR(cob.data_vencimento)}
        </span>
        <span className={`font-label-md text-label-md ${ativa ? 'text-tertiary' : 'text-on-surface-variant'}`}>{cob.status_display}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {cob.invoice_url && (
          <>
            <a className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-label-md text-label-md bg-surface-container-high hover:bg-surface-container-highest text-on-surface" href={cob.invoice_url} rel="noreferrer" target="_blank">
              <Icone nome="open_in_new" className="text-[16px]" /> Fatura
            </a>
            <Botao pequeno icone="link" onClick={() => copiar(cob.invoice_url!, avisar, 'Link copiado')}>Copiar link</Botao>
          </>
        )}
        {cob.boleto_url && (
          <a className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-label-md text-label-md bg-surface-container-high hover:bg-surface-container-highest text-on-surface" href={cob.boleto_url} rel="noreferrer" target="_blank">
            <Icone nome="description" className="text-[16px]" /> Boleto
          </a>
        )}
        {cob.pix_copia_cola && (
          <Botao pequeno icone="content_copy" onClick={() => copiar(cob.pix_copia_cola!, avisar, 'PIX copia e cola copiado')}>PIX copia e cola</Botao>
        )}
      </div>
      {ativa && cob.invoice_url && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-outline-variant/40">
          <span className="w-full font-label-md text-label-md text-on-surface-variant">Reenviar ao associado</span>
          <a
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-label-md text-label-md text-white bg-[#25D366] hover:brightness-95"
            href={linkWhatsApp(c.associado.whatsapp, mensagem)}
            rel="noreferrer"
            target="_blank"
          >
            <Icone nome="chat" className="text-[16px]" /> WhatsApp
          </a>
          <Botao pequeno icone="mail" carregando={enviando} onClick={enviarEmail}>
            E-mail ({c.associado.email})
          </Botao>
        </div>
      )}
    </div>
  );
}

// ---------- reemitir ----------

function maisDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Reemitir({
  competencia: c,
  onFechar,
  onAtualizada,
}: {
  competencia: Competencia;
  onFechar: () => void;
  onAtualizada: (c: Competencia) => void;
}) {
  const avisar = useToast();
  const emDia = c.data_vencimento >= hojeISO();
  const [tipo, setTipo] = useState('BOLETO');
  const [vencimento, setVencimento] = useState(emDia ? c.data_vencimento : maisDias(3));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [emitida, setEmitida] = useState<Competencia | null>(null);

  const emitir = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const nova = await req<Competencia>('POST', `/cobranca/competencias/${c.id}/reemitir/`, {
        tipo_cobranca: tipo,
        data_vencimento: vencimento,
      });
      setEmitida(nova);
      onAtualizada(nova);
      avisar('Cobrança gerada no Asaas.');
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Falha de conexão.');
    }
    setEnviando(false);
  };

  if (emitida?.cobranca) {
    return (
      <Modal titulo="Cobrança gerada" subtitulo={`${c.associado.nome} · ${c.periodo}`} onFechar={onFechar} rodape={<Botao variante="primario" onClick={onFechar}>Concluir</Botao>}>
        <div className="space-y-4">
          <Aviso tom="sucesso" icone="check_circle">
            A cobrança anterior foi cancelada no Asaas. Envie a nova ao associado:
          </Aviso>
          <CartaoCobranca competencia={emitida} />
        </div>
      </Modal>
    );
  }

  const comDesconto = emDia && c.valor_desconto && vencimento <= c.data_vencimento;
  return (
    <Modal
      titulo="Reemitir cobrança"
      subtitulo={`${c.associado.nome} · ${c.periodo}`}
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" icone="send" carregando={enviando} type="submit" form="form-reemitir">Gerar cobrança</Botao>
        </>
      }
    >
      <form id="form-reemitir" className="space-y-4" onSubmit={emitir}>
        {erro && <Aviso tom="erro" icone="error">{erro}</Aviso>}
        <Campo rotulo="Forma de cobrança">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['BOLETO', 'Boleto + PIX', 'description'],
              ['PIX', 'Só PIX', 'qr_code_2'],
              ['UNDEFINED', 'Cliente escolhe', 'touch_app'],
            ].map(([valor, rotulo, icone]) => (
              <button
                key={valor}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 font-label-md text-label-md transition-colors ${
                  tipo === valor ? 'border-primary bg-primary-fixed/40 text-on-surface' : 'border-outline-variant/50 text-on-surface-variant hover:border-outline'
                }`}
                onClick={() => setTipo(valor)}
                type="button"
              >
                <Icone nome={icone} className="text-[22px]" />
                {rotulo}
              </button>
            ))}
          </div>
        </Campo>
        <Campo rotulo="Vencimento" ajuda={emDia ? 'Até o vencimento original vale o desconto.' : 'Competência vencida: o valor cheio será cobrado.'}>
          <input className={CLASSE_INPUT} min={hojeISO()} required type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </Campo>
        <div className="rounded-xl bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
          Valor da nova cobrança:{' '}
          <strong className="text-on-surface">{moeda(Number(c.valor_cheio) - Number(c.valor_pago))}</strong>
          {comDesconto && <> · {moeda(Number(c.valor_desconto) - Number(c.valor_pago))} se pago até {dataBR(c.data_vencimento)}</>}
          {c.cobranca && <p className="mt-1">A cobrança atual ({c.cobranca.status_display.toLowerCase()}) será cancelada no Asaas.</p>}
        </div>
      </form>
    </Modal>
  );
}

// ---------- receber PIX manual ----------

function Receber({
  competencia: c,
  onFechar,
  onAtualizada,
}: {
  competencia: Competencia;
  onFechar: () => void;
  onAtualizada: (c: Competencia) => void;
}) {
  const avisar = useToast();
  const [valor, setValor] = useState(c.saldo);
  const [data, setData] = useState(hojeISO());
  const [forma, setForma] = useState('pix_direto');
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [observacao, setObservacao] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Devido na data informada: desconto até o vencimento, cheio depois.
  const devido = (c.valor_desconto && data <= c.data_vencimento ? Number(c.valor_desconto) : Number(c.valor_cheio)) - Number(c.valor_pago);
  const quita = Number(valor) >= devido - 0.004;

  const registrar = async (e: FormEvent) => {
    e.preventDefault();
    if (!comprovante) {
      setErros({ comprovante: 'Anexe o comprovante.' });
      return;
    }
    setEnviando(true);
    setErro(null);
    setErros({});
    const fd = new FormData();
    fd.append('valor', valor);
    fd.append('data_pagamento', data);
    fd.append('forma_pagamento', forma);
    fd.append('comprovante', comprovante);
    if (observacao) fd.append('observacao', observacao);
    try {
      const atualizada = await req<Competencia>('POST', `/cobranca/competencias/${c.id}/receber/`, fd);
      avisar(atualizada.situacao === 'paga' ? 'Pagamento registrado e competência quitada.' : 'Pagamento parcial registrado.');
      onAtualizada(atualizada);
    } catch (falha) {
      if (falha instanceof ErroApi) {
        setErros(falha.campos);
        setErro(falha.message);
      } else setErro('Falha de conexão.');
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo="Receber pagamento manual"
      subtitulo={`${c.associado.nome} · ${c.periodo} · vence ${dataBR(c.data_vencimento)}`}
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" icone="check" carregando={enviando} type="submit" form="form-receber">Registrar pagamento</Botao>
        </>
      }
    >
      <form id="form-receber" className="grid grid-cols-2 gap-4" onSubmit={registrar}>
        {erro && <div className="col-span-2"><Aviso tom="erro" icone="error">{erro}</Aviso></div>}
        <Campo rotulo="Valor recebido" erro={erros.valor} obrigatorio>
          <input className={CLASSE_INPUT} inputMode="decimal" min="0.01" required step="0.01" type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Campo>
        <Campo rotulo="Data do pagamento" erro={erros.data_pagamento} obrigatorio>
          <input className={CLASSE_INPUT} max={hojeISO()} required type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo rotulo="Forma" className="col-span-2">
          <select className={CLASSE_INPUT} value={forma} onChange={(e) => setForma(e.target.value)}>
            <option value="pix_direto">PIX direto na conta</option>
            <option value="transferencia">Transferência bancária</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="outro">Outro</option>
          </select>
        </Campo>
        <Campo rotulo="Comprovante" erro={erros.comprovante} obrigatorio className="col-span-2" ajuda="Imagem ou PDF do comprovante.">
          <label
            className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 cursor-pointer transition-colors ${
              erros.comprovante ? 'border-error' : comprovante ? 'border-primary bg-primary-fixed/30' : 'border-outline-variant hover:border-outline'
            }`}
          >
            <Icone nome={comprovante ? 'task' : 'upload_file'} className="text-[28px] text-primary" />
            <span className="flex-1 min-w-0 font-body-sm text-body-sm">
              {comprovante ? (
                <><strong className="block truncate text-on-surface">{comprovante.name}</strong><span className="text-on-surface-variant">Clique para trocar</span></>
              ) : (
                <span className="text-on-surface-variant">Clique para anexar</span>
              )}
            </span>
            <input accept="image/*,application/pdf" className="sr-only" type="file" onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} />
          </label>
        </Campo>
        <Campo rotulo="Observação" className="col-span-2">
          <textarea className={`${CLASSE_INPUT} min-h-20`} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </Campo>
        <div className="col-span-2">
          {quita ? (
            <Aviso tom="sucesso" icone="task_alt">
              Quita a competência (devido em {dataBR(data)}: {moeda(devido)}).
              {c.cobranca && ' A cobrança em aberto no Asaas será baixada automaticamente.'}
            </Aviso>
          ) : (
            <Aviso tom="alerta" icone="contrast">
              Pagamento parcial: faltarão {moeda(devido - Number(valor || 0))}. A cobrança no Asaas não é alterada.
            </Aviso>
          )}
        </div>
      </form>
    </Modal>
  );
}

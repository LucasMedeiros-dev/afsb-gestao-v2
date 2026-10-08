import { useState } from 'react';
import { get, qs, type Dashboard as DadosDashboard } from './api';
import {
  Aviso,
  Botao,
  Carregando,
  Cartao,
  Icone,
  MESES,
  Selo,
  Vazio,
  dataBR,
  linkWhatsApp,
  moeda,
  moedaCurta,
  navegar,
  useCarregar,
  type Tom,
} from './ui';

const num = (v: string | number) => Number(v);

export default function Dashboard() {
  const [hoje] = useState(() => new Date());
  const [ref, setRef] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 });
  const { dados, erro, carregando } = useCarregar(
    () => get<DadosDashboard>(`/cobranca/dashboard/${qs(ref)}`),
    [ref.ano, ref.mes],
  );

  const mover = (delta: number) => {
    const d = new Date(ref.ano, ref.mes - 1 + delta, 1);
    setRef({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
  };
  const ehMesAtual = ref.ano === hoje.getFullYear() && ref.mes === hoje.getMonth() + 1;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Pagamentos</h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            O que entrou, o que está para entrar e quem está em atraso.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-1">
          <Botao pequeno variante="fantasma" icone="chevron_left" aria-label="Mês anterior" onClick={() => mover(-1)} />
          <span className="min-w-36 text-center font-label-lg text-label-lg text-on-surface">
            {MESES[ref.mes - 1]} {ref.ano}
          </span>
          <Botao pequeno variante="fantasma" icone="chevron_right" aria-label="Próximo mês" disabled={ehMesAtual} onClick={() => mover(1)} />
        </div>
      </header>

      {erro ? (
        <Cartao>
          <Vazio icone="cloud_off" titulo="Não foi possível carregar o dashboard">{erro}</Vazio>
        </Cartao>
      ) : !dados ? (
        <Cartao><Carregando linhas={8} /></Cartao>
      ) : (
        <div className={`space-y-6 transition-opacity ${carregando ? 'opacity-60' : ''}`}>
          {!dados.asaas_configurado && (
            <Aviso tom="alerta" icone="warning">
              <strong>Asaas não configurado.</strong> A reemissão de cobranças e a baixa automática ficam
              desativadas até definir <code>ASAAS_API_KEY</code> no backend. O recebimento manual funciona normalmente.
            </Aviso>
          )}
          <Indicadores dados={dados} />
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <Cartao className="xl:col-span-3 p-5">
              <GraficoMensal serie={dados.serie} />
            </Cartao>
            <Cartao className="xl:col-span-2">
              <UltimosPagamentos itens={dados.ultimos_pagamentos} />
            </Cartao>
          </div>
          <Cartao>
            <Atrasados itens={dados.atrasados} />
          </Cartao>
        </div>
      )}
    </div>
  );
}

function Indicadores({ dados }: { dados: DadosDashboard }) {
  const k = dados.kpis;
  const previsto = num(k.previsto);
  const recebido = num(k.recebido);
  const pct = previsto > 0 ? Math.min(100, Math.round((recebido / previsto) * 100)) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Cartao className="p-5 sm:col-span-2">
        <p className="font-label-md text-label-md text-on-surface-variant">Recebido no mês</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[2.75rem] leading-none font-extrabold tracking-tight text-on-surface">{moeda(recebido)}</span>
          <span className="font-body-md text-body-md text-on-surface-variant">de {moeda(previsto)} previstos</span>
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-primary-fixed overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Percentual recebido">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          <strong className="text-on-surface">{pct}%</strong> do previsto · {k.pagas_mes} de {k.competencias_mes} competências pagas
        </p>
      </Cartao>
      <Kpi rotulo="A vencer no mês" valor={moeda(k.a_vencer)} icone="schedule" detalhe="Ainda dentro do prazo" />
      <Kpi
        rotulo="Vencido no mês"
        valor={moeda(k.vencido_mes)}
        icone="event_busy"
        tom={num(k.vencido_mes) > 0 ? 'erro' : undefined}
        detalhe="Passou do vencimento sem pagar"
        onClick={() => navegar(`/painel/cobrancas${qs({ situacao: 'vencida', ano: dados.referencia.ano, mes: dados.referencia.mes })}`)}
      />
      <Kpi
        rotulo="Inadimplência acumulada"
        valor={moeda(k.vencido_total)}
        icone="report"
        tom={k.inadimplentes > 0 ? 'erro' : 'sucesso'}
        detalhe={`${k.inadimplentes} associado${k.inadimplentes === 1 ? '' : 's'} com atraso`}
        onClick={() => navegar('/painel/cobrancas?situacao=vencida')}
      />
      <Kpi
        rotulo="Associados cobrados"
        valor={String(k.associados_cobrados)}
        icone="groups"
        detalhe={
          k.associados_cobrados > 0
            ? `${Math.round(((k.associados_cobrados - k.inadimplentes) / k.associados_cobrados) * 100)}% em dia`
            : 'Nenhum perfil de cobrança ativo'
        }
        onClick={() => navegar('/painel/perfis')}
      />
    </div>
  );
}

function Kpi({
  rotulo,
  valor,
  icone,
  detalhe,
  tom,
  onClick,
}: {
  rotulo: string;
  valor: string;
  icone: string;
  detalhe: string;
  tom?: Tom;
  onClick?: () => void;
}) {
  const cor = tom === 'erro' ? 'bg-error-container text-on-error-container' : tom === 'sucesso' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-surface-container text-on-surface-variant';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`text-left rounded-2xl bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 ${onClick ? 'hover:shadow-md hover:-translate-y-px transition-all' : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-label-md text-label-md text-on-surface-variant">{rotulo}</p>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${cor}`}>
          <Icone nome={icone} className="text-[18px]" />
        </span>
      </div>
      <p className="mt-2 font-headline-md text-headline-md text-on-surface tabular-nums">{valor}</p>
      <p className="mt-1 font-body-sm text-[0.8rem] text-on-surface-variant">{detalhe}</p>
    </Tag>
  );
}

/**
 * Previsto como trilho claro (mesma rampa verde) e recebido preenchendo por
 * cima: um eixo só, leitura de "quanto do esperado entrou".
 */
function GraficoMensal({ serie }: { serie: DadosDashboard['serie'] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const max = Math.max(1, ...serie.map((s) => Math.max(num(s.previsto), num(s.recebido))));
  const passo = escalaLimpa(max);
  const teto = passo * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * passo);
  const vazio = serie.every((s) => num(s.previsto) === 0 && num(s.recebido) === 0);

  return (
    <figure>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <figcaption>
          <h2 className="font-label-lg text-label-lg text-on-surface">Últimos 12 meses</h2>
          <p className="font-body-sm text-[0.8rem] text-on-surface-variant">Por mês de vencimento</p>
        </figcaption>
        <div className="flex items-center gap-4 font-body-sm text-[0.8rem] text-on-surface-variant">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary-fixed" />Previsto</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary" />Recebido</span>
        </div>
      </div>

      {vazio ? (
        <Vazio icone="bar_chart" titulo="Sem cobranças no período">
          As competências aparecem aqui depois da geração mensal.
        </Vazio>
      ) : (
        <div className="relative mt-5 h-60 flex">
          <div className="relative w-14 shrink-0 font-body-sm text-[0.7rem] text-outline tabular-nums">
            {ticks.map((t) => (
              <span key={t} className="absolute right-2" style={{ bottom: `${(t / teto) * 100}%`, transform: 'translateY(50%)' }}>
                {moedaCurta(t)}
              </span>
            ))}
          </div>
          <div className="relative flex-1">
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 h-px bg-outline-variant/40" style={{ bottom: `${(t / teto) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end" onMouseLeave={() => setFoco(null)}>
              {serie.map((s, i) => {
                const prev = num(s.previsto);
                const rec = num(s.recebido);
                return (
                  <div
                    key={`${s.ano}-${s.mes}`}
                    className="relative flex-1 h-full flex flex-col justify-end items-center"
                    onMouseEnter={() => setFoco(i)}
                    onFocus={() => setFoco(i)}
                    tabIndex={0}
                    aria-label={`${MESES[s.mes - 1]} ${s.ano}: recebido ${moeda(rec)} de ${moeda(prev)} previsto`}
                  >
                    {foco === i && <div className="absolute inset-y-0 inset-x-0.5 rounded-md bg-surface-container/70" />}
                    <div className="relative w-full max-w-6 flex flex-col justify-end h-full">
                      <div className="relative w-full rounded-t bg-primary-fixed" style={{ height: `${(prev / teto) * 100}%` }}>
                        <div className="absolute bottom-0 inset-x-0 rounded-t bg-primary" style={{ height: prev > 0 ? `${Math.min(100, (rec / prev) * 100)}%` : 0 }} />
                      </div>
                    </div>
                    {foco === i && (
                      <div
                        className={`absolute bottom-full mb-2 z-10 w-44 rounded-xl bg-inverse-surface text-inverse-on-surface shadow-lg px-3 py-2 font-body-sm text-[0.8rem] pointer-events-none ${
                          i > serie.length - 4 ? 'right-0' : i < 3 ? 'left-0' : 'left-1/2 -translate-x-1/2'
                        }`}
                        style={{ bottom: `${Math.max(prev, rec) / teto * 100}%` }}
                      >
                        <p className="font-semibold mb-1">{MESES[s.mes - 1]} {s.ano}</p>
                        <p className="flex justify-between gap-2"><span>Previsto</span><span className="tabular-nums">{moeda(prev)}</span></p>
                        <p className="flex justify-between gap-2"><span>Recebido</span><span className="tabular-nums">{moeda(rec)}</span></p>
                        {prev > 0 && <p className="flex justify-between gap-2 opacity-80"><span>Realizado</span><span className="tabular-nums">{Math.round((rec / prev) * 100)}%</span></p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {!vazio && (
        <div className="flex pl-14 mt-2 font-body-sm text-[0.7rem] text-outline">
          {serie.map((s) => (
            <span key={`${s.ano}-${s.mes}`} className="flex-1 text-center">
              {MESES[s.mes - 1].slice(0, 3)}
            </span>
          ))}
        </div>
      )}
      {/* Tabela equivalente para leitores de tela. */}
      <table className="sr-only">
        <caption>Previsto e recebido por mês</caption>
        <thead><tr><th>Mês</th><th>Previsto</th><th>Recebido</th></tr></thead>
        <tbody>
          {serie.map((s) => (
            <tr key={`${s.ano}-${s.mes}`}><td>{MESES[s.mes - 1]} {s.ano}</td><td>{moeda(s.previsto)}</td><td>{moeda(s.recebido)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Passo "redondo" (1, 2, 2.5, 5 × 10^n) para 4 linhas de grade cobrindo o máximo. */
function escalaLimpa(max: number) {
  const bruto = max / 4;
  const ordem = 10 ** Math.floor(Math.log10(bruto));
  return ([1, 2, 2.5, 5, 10].find((m) => m * ordem >= bruto) ?? 10) * ordem;
}

function UltimosPagamentos({ itens }: { itens: DadosDashboard['ultimos_pagamentos'] }) {
  return (
    <div className="h-full flex flex-col">
      <h2 className="px-5 pt-5 pb-3 font-label-lg text-label-lg text-on-surface">Últimos pagamentos</h2>
      {itens.length === 0 ? (
        <Vazio icone="payments" titulo="Nenhum pagamento ainda" />
      ) : (
        <ul className="flex-1">
          {itens.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-2.5 border-t border-outline-variant/30">
              <span className="w-8 h-8 shrink-0 rounded-full bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center">
                <Icone nome={p.origem === 'Manual' ? 'qr_code_2' : 'account_balance'} className="text-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-body-sm text-body-sm text-on-surface truncate">{p.nome}</p>
                <p className="font-body-sm text-[0.75rem] text-on-surface-variant">
                  {p.periodo} · {dataBR(p.data)} · {p.origem === 'Manual' ? 'PIX manual' : 'Asaas'}
                </p>
              </div>
              <span className="font-label-md text-label-md text-on-surface tabular-nums">{moeda(p.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Atrasados({ itens }: { itens: DadosDashboard['atrasados'] }) {
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? itens : itens.slice(0, 10);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h2 className="font-label-lg text-label-lg text-on-surface">Quem está em atraso</h2>
          <p className="font-body-sm text-[0.8rem] text-on-surface-variant">Ordenado pelo atraso mais antigo</p>
        </div>
        {itens.length > 0 && <Selo tom="erro" icone="error">{itens.length} associado{itens.length === 1 ? '' : 's'}</Selo>}
      </div>
      {itens.length === 0 ? (
        <Vazio icone="verified" titulo="Ninguém em atraso">Todas as competências vencidas foram pagas.</Vazio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="font-label-md text-label-md text-on-surface-variant">
                <th className="px-5 py-2.5 font-semibold">Associado</th>
                <th className="px-3 py-2.5 font-semibold text-right">Em aberto</th>
                <th className="px-3 py-2.5 font-semibold hidden sm:table-cell">Competências</th>
                <th className="px-3 py-2.5 font-semibold">Atraso</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="font-body-sm text-body-sm text-on-surface">
              {visiveis.map((a) => (
                <tr key={a.id} className="border-t border-outline-variant/30">
                  <td className="px-5 py-3">
                    <span className="font-semibold">{a.nome}</span>
                    <span className="block text-[0.8rem] text-on-surface-variant">{a.nro ? `#${a.nro} · ` : ''}{a.email}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold">{moeda(a.total)}</td>
                  <td className="px-3 py-3 hidden sm:table-cell tabular-nums">{a.qtd}</td>
                  <td className="px-3 py-3">
                    <Selo tom={a.dias > 60 ? 'erro' : 'alerta'}>{a.dias} dia{a.dias === 1 ? '' : 's'}</Selo>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      {a.whatsapp && (
                        <a
                          aria-label={`WhatsApp de ${a.nome}`}
                          className="p-2 rounded-lg text-[#128C7E] hover:bg-surface-container"
                          href={linkWhatsApp(a.whatsapp, `Olá, ${a.nome.split(' ')[0]}! Aqui é da AFSB. Identificamos ${a.qtd} mensalidade(s) em aberto, totalizando ${moeda(a.total)}. Podemos ajudar a regularizar?`)}
                          rel="noreferrer"
                          target="_blank"
                          title="Cobrar pelo WhatsApp"
                        >
                          <Icone nome="chat" className="text-[20px]" />
                        </a>
                      )}
                      <Botao pequeno variante="fantasma" icone="arrow_forward" onClick={() => navegar(`/painel/cobrancas?usuario=${a.id}&situacao=vencida`)}>
                        Ver
                      </Botao>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {itens.length > 10 && (
            <div className="px-5 py-3 border-t border-outline-variant/40">
              <Botao pequeno variante="fantasma" onClick={() => setTodos(!todos)}>
                {todos ? 'Mostrar menos' : `Ver todos (${itens.length})`}
              </Botao>
            </div>
          )}
        </div>
      )}
    </>
  );
}

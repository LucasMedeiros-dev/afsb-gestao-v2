/**
 * Tabela padrão de valores por quantidade de lojas: mensal (boleto/PIX, com desconto até o vencimento)
 * e anual (cartão). Cada modalidade é salva inteira de uma vez (POST /cobranca/tabela/salvar/).
 */
import { useState } from 'react';
import { ErroApi, get, req } from './api';
import { Aviso, Botao, CLASSE_INPUT, Carregando, Cartao, Icone, moeda, useCarregar, useToast } from './ui';

type Modalidade = 'mensal' | 'anual';

interface LinhaApi {
  id: string;
  modalidade: Modalidade;
  qtd_lojas: number;
  valor_cheio: string;
  valor_desconto: string | null;
  data_atualizacao: string;
}

interface Linha {
  qtd_lojas: number;
  valor_cheio: string;
  valor_desconto: string;
}

const DESCONTO = 0.2;
const comDesconto = (cheio: string) => (Number(cheio) > 0 ? (Number(cheio) * (1 - DESCONTO)).toFixed(2) : '');

const MODALIDADES: Record<Modalidade, { titulo: string; descricao: string; icone: string }> = {
  mensal: {
    titulo: 'Boleto/PIX · mensal',
    descricao: 'Valor normal após o vencimento; valor com desconto (20%) para pagamento até o dia 15 ou 25.',
    icone: 'receipt_long',
  },
  anual: {
    titulo: 'Cartão de crédito · anual',
    descricao: 'Valor único por ano, parcelado no cartão. Sem desconto.',
    icone: 'credit_card',
  },
};

export default function TabelaValores() {
  const { dados, erro, carregando, recarregar } = useCarregar(() => get<LinhaApi[]>('/cobranca/tabela/'), []);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-headline-md text-headline-md text-on-surface">Tabela de valores</h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Preço padrão da mensalidade por quantidade de lojas. Os perfis de cobrança sem valor personalizado usam esta tabela.
        </p>
      </header>

      <Aviso>
        Alterações valem para as cobranças geradas a partir de agora. Competências já geradas mantêm o valor original.
      </Aviso>

      {erro && <Aviso tom="erro" icone="error">{erro}</Aviso>}
      {carregando && !dados ? (
        <Cartao className="p-4"><Carregando /></Cartao>
      ) : (
        dados && (
          <div className="grid gap-5 xl:grid-cols-2">
            {(['mensal', 'anual'] as const).map((m) => {
              const linhas = dados.filter((l) => l.modalidade === m);
              // Chave muda quando a API devolve outra tabela: o quadro recomeça a edição do zero.
              return <Quadro key={m + JSON.stringify(linhas)} modalidade={m} linhas={linhas} aoSalvar={recarregar} />;
            })}
          </div>
        )
      )}
    </div>
  );
}

function paraEdicao(linhas: LinhaApi[]): Linha[] {
  return linhas
    .map((l) => ({ qtd_lojas: l.qtd_lojas, valor_cheio: l.valor_cheio, valor_desconto: l.valor_desconto ?? '' }))
    .sort((a, b) => a.qtd_lojas - b.qtd_lojas);
}

function Quadro({ modalidade, linhas: originais, aoSalvar }: { modalidade: Modalidade; linhas: LinhaApi[]; aoSalvar: () => void }) {
  const mensal = modalidade === 'mensal';
  const info = MODALIDADES[modalidade];
  const toast = useToast();
  const [linhas, setLinhas] = useState(() => paraEdicao(originais));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const alterado = JSON.stringify(linhas) !== JSON.stringify(paraEdicao(originais));
  const atualizadoEm = originais.reduce((max, l) => (l.data_atualizacao > max ? l.data_atualizacao : max), '');

  const mudar = (i: number, campo: 'valor_cheio' | 'valor_desconto', valor: string) =>
    setLinhas((ls) =>
      ls.map((l, j) => {
        if (j !== i) return l;
        // Desconto acompanha o valor normal enquanto estiver nos 20% padrão.
        const segue = campo === 'valor_cheio' && mensal && (!l.valor_desconto || Number(l.valor_desconto) === Number(comDesconto(l.valor_cheio)));
        return { ...l, [campo]: valor, ...(segue ? { valor_desconto: comDesconto(valor) } : {}) };
      }),
    );

  const adicionar = () =>
    setLinhas((ls) => {
      const ultima = ls[ls.length - 1];
      return [...ls, { qtd_lojas: (ultima?.qtd_lojas ?? 0) + 1, valor_cheio: ultima?.valor_cheio ?? '', valor_desconto: ultima?.valor_desconto ?? '' }];
    });

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try {
      await req('POST', '/cobranca/tabela/salvar/', {
        modalidade,
        linhas: linhas.map((l) => ({
          qtd_lojas: l.qtd_lojas,
          valor_cheio: l.valor_cheio,
          valor_desconto: mensal ? l.valor_desconto || null : null,
        })),
      });
      toast(`Tabela ${mensal ? 'mensal' : 'anual'} salva.`);
      aoSalvar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const classeValor = `${CLASSE_INPUT} pl-9 text-right tabular-nums`;

  return (
    <Cartao className="flex flex-col">
      <div className="flex items-start gap-3 p-5 border-b border-outline-variant/40">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center">
          <Icone nome={info.icone} className="text-[22px]" />
        </span>
        <div className="min-w-0">
          <h2 className="font-label-lg text-label-lg font-semibold text-on-surface">{info.titulo}</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{info.descricao}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full font-body-sm text-body-sm">
          <thead>
            <tr className="text-left font-label-md text-label-md text-on-surface-variant">
              <th className="px-5 py-3 w-24">Lojas</th>
              <th className="px-2 py-3">{mensal ? 'Valor normal' : 'Valor anual'}</th>
              <th className="px-2 py-3">{mensal ? 'Com desconto' : 'Equivale a'}</th>
              <th className="pr-5 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const pct = mensal && Number(l.valor_cheio) > 0 && l.valor_desconto
                ? Math.round((1 - Number(l.valor_desconto) / Number(l.valor_cheio)) * 1000) / 10
                : null;
              return (
                <tr key={l.qtd_lojas} className="border-t border-outline-variant/30">
                  <td className="px-5 py-2 font-semibold text-on-surface whitespace-nowrap">
                    {String(l.qtd_lojas).padStart(2, '0')} {l.qtd_lojas === 1 ? 'loja' : 'lojas'}
                  </td>
                  <td className="px-2 py-2 min-w-[9rem]">
                    <ValorInput
                      className={classeValor}
                      rotulo={`${mensal ? 'Valor normal' : 'Valor anual'}, ${l.qtd_lojas} loja(s)`}
                      valor={l.valor_cheio}
                      onChange={(v) => mudar(i, 'valor_cheio', v)}
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[9rem]">
                    {mensal ? (
                      <div>
                        <ValorInput
                          className={classeValor}
                          rotulo={`Valor com desconto, ${l.qtd_lojas} loja(s)`}
                          valor={l.valor_desconto}
                          onChange={(v) => mudar(i, 'valor_desconto', v)}
                        />
                        {pct !== null && pct !== DESCONTO * 100 && (
                          <span className="block mt-0.5 text-right text-[0.75rem] text-secondary">{pct}% de desconto</span>
                        )}
                      </div>
                    ) : (
                      <span className="block text-right tabular-nums text-on-surface-variant pr-3">
                        12x {moeda(Number(l.valor_cheio || 0) / 12)}
                      </span>
                    )}
                  </td>
                  <td className="pr-5 py-2 text-right">
                    {i === linhas.length - 1 && linhas.length > 1 && (
                      <button
                        aria-label={`Remover faixa de ${l.qtd_lojas} lojas`}
                        className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/60"
                        onClick={() => setLinhas((ls) => ls.slice(0, -1))}
                        type="button"
                      >
                        <Icone nome="delete" className="text-[20px]" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-auto px-5 py-4 border-t border-outline-variant/40 space-y-3">
        {erro && <Aviso tom="erro" icone="error">{erro}</Aviso>}
        <div className="flex flex-wrap items-center gap-2">
          <Botao pequeno icone="add" variante="fantasma" onClick={adicionar}>
            Adicionar faixa
          </Botao>
          <span className="flex-1 font-body-sm text-[0.8rem] text-outline">
            {alterado ? 'Alterações não salvas' : atualizadoEm && `Atualizada em ${new Date(atualizadoEm).toLocaleDateString('pt-BR')}`}
          </span>
          {alterado && (
            <Botao pequeno onClick={() => { setLinhas(paraEdicao(originais)); setErro(''); }} disabled={salvando}>
              Descartar
            </Botao>
          )}
          <Botao pequeno variante="primario" icone="save" carregando={salvando} disabled={!alterado} onClick={salvar}>
            Salvar
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}

function ValorInput({ valor, onChange, rotulo, className }: { valor: string; onChange: (v: string) => void; rotulo: string; className: string }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[0.8rem] pointer-events-none">R$</span>
      <input
        aria-label={rotulo}
        className={className}
        inputMode="decimal"
        min="0"
        step="0.01"
        type="number"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

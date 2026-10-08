import { useState, type FormEvent } from 'react';
import { ErroApi, get, req } from './api';
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
  Vazio,
  dataHoraBR,
  linkWhatsApp,
  useCarregar,
  useToast,
} from './ui';

interface Pendente {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  whatsapp: string;
  status: string;
  nro_associado: number | null;
  date_joined: string;
}

interface Fila {
  pendentes: Pendente[];
  decisoes: {
    id: string;
    usuario: Pendente;
    aprovado: boolean;
    motivo_recusa: string | null;
    data_aprovacao: string;
    aprovado_por_nome: string | null;
  }[];
  proximo_nro: number;
}

/** Avisa o menu para recontar o selo de pendentes. */
export const EVENTO_APROVACOES = 'afsb:aprovacoes';

const telefone = (w: string) => w.replace(/^\+55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');

export default function Aprovacoes() {
  const { dados, erro, recarregar } = useCarregar(() => get<Fila>('/usuario/aprovacoes/'), []);
  const [decidindo, setDecidindo] = useState<{ tipo: 'aprovar' | 'reprovar'; pessoa: Pendente } | null>(null);

  const concluir = () => {
    setDecidindo(null);
    recarregar();
    window.dispatchEvent(new Event(EVENTO_APROVACOES));
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline-md text-headline-md text-on-surface">Aprovação de cadastros</h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Pré-cadastros feitos pelo site. Confira pelo WhatsApp se é franqueado ativo antes de aprovar.
        </p>
      </header>

      {erro ? (
        <Cartao><Vazio icone="cloud_off" titulo="Não foi possível carregar">{erro}</Vazio></Cartao>
      ) : !dados ? (
        <Cartao><Carregando linhas={3} /></Cartao>
      ) : (
        <>
          {dados.pendentes.length === 0 ? (
            <Cartao>
              <Vazio icone="how_to_reg" titulo="Nenhum cadastro aguardando">Novos pré-cadastros do site aparecem aqui.</Vazio>
            </Cartao>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {dados.pendentes.map((p) => (
                <Cartao key={p.id} className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-label-lg text-label-lg text-on-surface">{p.nome}</p>
                      <p className="font-body-sm text-[0.8rem] text-on-surface-variant">Pedido em {dataHoraBR(p.date_joined)}</p>
                    </div>
                    <Selo tom="alerta" icone="schedule">Aguardando</Selo>
                  </div>

                  <a
                    className="flex items-center gap-3 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 px-4 py-3 transition-colors"
                    href={linkWhatsApp(p.whatsapp, `Olá, ${p.nome.split(' ')[0]}! Aqui é da AFSB, sobre o seu pré-cadastro no site.`)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center">
                      <Icone nome="call" className="text-[20px]" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-body-sm text-[0.75rem] text-on-surface-variant">WhatsApp</span>
                      <span className="block text-[1.25rem] font-bold tracking-tight text-on-surface tabular-nums">{telefone(p.whatsapp)}</span>
                    </span>
                    <Icone nome="open_in_new" className="text-[18px] text-on-surface-variant" />
                  </a>

                  <dl className="grid grid-cols-2 gap-3 font-body-sm text-body-sm">
                    <div>
                      <dt className="text-on-surface-variant text-[0.75rem]">E-mail</dt>
                      <dd className="text-on-surface break-all">{p.email}</dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-variant text-[0.75rem]">CPF</dt>
                      <dd className="text-on-surface tabular-nums">{p.cpf}</dd>
                    </div>
                  </dl>

                  <div className="flex gap-2 pt-1">
                    <Botao variante="fantasma" icone="close" className="flex-1 !text-error" onClick={() => setDecidindo({ tipo: 'reprovar', pessoa: p })}>
                      Reprovar
                    </Botao>
                    <Botao variante="primario" icone="check" className="flex-1" onClick={() => setDecidindo({ tipo: 'aprovar', pessoa: p })}>
                      Aprovar
                    </Botao>
                  </div>
                </Cartao>
              ))}
            </div>
          )}

          {dados.decisoes.length > 0 && (
            <Cartao>
              <h2 className="px-5 pt-5 pb-3 font-label-lg text-label-lg text-on-surface">Decisões recentes</h2>
              <ul>
                {dados.decisoes.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3 border-t border-outline-variant/30 font-body-sm text-body-sm">
                    <Icone nome={d.aprovado ? 'check_circle' : 'cancel'} className={`text-[20px] ${d.aprovado ? 'text-primary' : 'text-error'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-on-surface truncate">
                        <strong>{d.usuario.nome}</strong> {d.aprovado ? 'aprovado' : 'reprovado'}
                        {d.aprovado && d.usuario.nro_associado ? ` · nº ${d.usuario.nro_associado}` : ''}
                      </p>
                      <p className="text-[0.8rem] text-on-surface-variant truncate">
                        {dataHoraBR(d.data_aprovacao)} por {d.aprovado_por_nome ?? '—'}
                        {d.motivo_recusa ? ` · ${d.motivo_recusa}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </>
      )}

      {decidindo && dados && (
        <Decisao {...decidindo} proximoNro={dados.proximo_nro} onFechar={() => setDecidindo(null)} onConcluido={concluir} />
      )}
    </div>
  );
}

function Decisao({
  tipo,
  pessoa,
  proximoNro,
  onFechar,
  onConcluido,
}: {
  tipo: 'aprovar' | 'reprovar';
  pessoa: Pendente;
  proximoNro: number;
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const avisar = useToast();
  const aprovar = tipo === 'aprovar';
  const [nro, setNro] = useState(String(pessoa.nro_associado ?? proximoNro));
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await req('POST', `/usuario/${pessoa.id}/${tipo}/`, aprovar ? { nro_associado: nro ? Number(nro) : null } : { motivo });
      avisar(aprovar ? `${pessoa.nome} aprovado. O acesso já está liberado.` : `${pessoa.nome} reprovado.`);
      onConcluido();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Falha de conexão.');
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={aprovar ? 'Aprovar cadastro' : 'Reprovar cadastro'}
      subtitulo={`${pessoa.nome} · ${telefone(pessoa.whatsapp)}`}
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao variante={aprovar ? 'primario' : 'perigo'} icone={aprovar ? 'check' : 'close'} carregando={enviando} type="submit" form="form-decisao">
            {aprovar ? 'Aprovar e liberar acesso' : 'Reprovar'}
          </Botao>
        </>
      }
    >
      <form id="form-decisao" className="space-y-4" onSubmit={enviar}>
        {erro && <Aviso tom="erro" icone="error">{erro}</Aviso>}
        {aprovar ? (
          <>
            <Campo rotulo="Nº de associado" ajuda={`Sugestão: próximo número livre (${proximoNro}).`}>
              <input className={CLASSE_INPUT} min={1} type="number" value={nro} onChange={(e) => setNro(e.target.value)} />
            </Campo>
            <Aviso icone="info">
              O associado passa a entrar com o e-mail e a senha que criou. Depois, vincule as lojas e o perfil de
              cobrança em Associados.
            </Aviso>
          </>
        ) : (
          <Campo rotulo="Motivo da recusa" obrigatorio>
            <textarea
              className={`${CLASSE_INPUT} min-h-24`}
              placeholder="Ex.: não é franqueado ativo da rede"
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Campo>
        )}
      </form>
    </Modal>
  );
}

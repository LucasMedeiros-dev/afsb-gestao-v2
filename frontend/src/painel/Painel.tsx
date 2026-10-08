import { useEffect, useState } from 'react';
import { get } from './api';
import Aprovacoes, { EVENTO_APROVACOES } from './Aprovacoes';
import Casca, { type GrupoMenu } from './Casca';
import Cobrancas from './Cobrancas';
import Crud, { type Recurso } from './Crud';
import Dashboard from './Dashboard';
import * as recursos from './recursos';
import { Icone } from './ui';

const CRUDS: Record<string, Recurso> = {
  perfis: recursos.perfis,
  associados: recursos.associados,
  franquias: recursos.franquias,
  noticias: recursos.noticias,
  eventos: recursos.eventos,
  membros: recursos.membros,
  documentos: recursos.documentos,
  parceiros: recursos.parceiros,
};

const menu = (pendentes: number): GrupoMenu[] => [
  {
    grupo: 'Financeiro',
    itens: [
      { rota: '', rotulo: 'Pagamentos', icone: 'monitoring' },
      { rota: 'cobrancas', rotulo: 'Cobranças', icone: 'receipt_long' },
      { rota: 'perfis', rotulo: 'Perfis de cobrança', icone: 'account_balance_wallet' },
    ],
  },
  {
    grupo: 'Cadastros',
    itens: [
      { rota: 'aprovacoes', rotulo: 'Aprovações', icone: 'how_to_reg', contador: pendentes },
      { rota: 'associados', rotulo: 'Associados', icone: 'group' },
      { rota: 'franquias', rotulo: 'Franquias', icone: 'storefront' },
    ],
  },
  {
    grupo: 'Conteúdo do site',
    itens: [
      { rota: 'noticias', rotulo: 'Notícias', icone: 'newspaper' },
      { rota: 'eventos', rotulo: 'Eventos', icone: 'event' },
      { rota: 'membros', rotulo: 'Membros', icone: 'badge' },
      { rota: 'documentos', rotulo: 'Documentos', icone: 'folder_open' },
      { rota: 'parceiros', rotulo: 'Parceiros', icone: 'handshake' },
    ],
  },
];

export default function Painel() {
  const [pendentes, setPendentes] = useState(0);
  useEffect(() => {
    const contar = () =>
      get<{ pendentes: unknown[] }>('/usuario/aprovacoes/')
        .then((d) => setPendentes(d.pendentes.length))
        .catch(() => {});
    contar();
    window.addEventListener(EVENTO_APROVACOES, contar);
    return () => window.removeEventListener(EVENTO_APROVACOES, contar);
  }, []);

  return (
    <Casca
      base="/painel"
      titulo="Painel"
      menu={menu(pendentes)}
      permitido={(u) => u.admin}
      negado="Esta área é exclusiva dos administradores da AFSB."
      rodape={() => (
        <a className="flex items-center gap-3 rounded-xl px-3 py-2 mb-1 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container" href="/area">
          <Icone nome="person" className="text-[20px] text-outline" />
          Minha área de associado
        </a>
      )}
    >
      {(rota, busca) => {
        if (rota === '') return <Dashboard />;
        if (rota === 'cobrancas') return <Cobrancas busca={busca} />;
        if (rota === 'aprovacoes') return <Aprovacoes />;
        return <Crud key={rota + busca.toString()} recurso={CRUDS[rota]} filtrosIniciais={Object.fromEntries(busca.entries())} />;
      }}
    </Casca>
  );
}

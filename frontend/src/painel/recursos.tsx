import { useState, type ReactNode } from 'react';
import { ErroApi, get, verComo } from './api';
import type { CampoForm, Item, Opcao, Recurso, Valores } from './Crud';
import { Botao, Selo, dataBR, dataHoraBR, linkWhatsApp, moeda, navegar, type Tom } from './ui';

// ---------- máscaras ----------

const digitos = (v: string) => v.replace(/\D/g, '');

export const mascaraCpf = (v: string) =>
  digitos(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');

export const mascaraCnpj = (v: string) =>
  digitos(v)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');

const mascaraCpfCnpj = (v: string) => (digitos(v).length > 11 ? mascaraCnpj(v) : mascaraCpf(v));
export const mascaraCep = (v: string) => digitos(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
/** Formato exigido pelo model: +55 + DDD + 9 dígitos, sem espaços. */
const mascaraWhatsapp = (v: string) => {
  const d = digitos(v);
  return d ? `+${d.startsWith('55') ? d.slice(0, 13) : `55${d}`.slice(0, 13)}` : '';
};

// ---------- opções ----------

const op = (pares: [string, string][]): Opcao[] => pares.map(([valor, rotulo]) => ({ valor, rotulo }));

export const STATUS_USUARIO: Record<string, { rotulo: string; tom: Tom }> = {
  ativo: { rotulo: 'Ativo', tom: 'sucesso' },
  aguardando_validacao: { rotulo: 'Aguardando validação', tom: 'alerta' },
  validacao_recusada: { rotulo: 'Validação recusada', tom: 'erro' },
  inativo: { rotulo: 'Inativo', tom: 'neutro' },
  bloqueado: { rotulo: 'Bloqueado', tom: 'erro' },
};
const OPCOES_STATUS = op(Object.entries(STATUS_USUARIO).map(([k, v]) => [k, v.rotulo]));
const OPCOES_CARGO = op([['franqueado', 'Franqueado'], ['admin', 'Administrador']]);
export const OPCOES_COMUNICACAO = op([['whatsapp_email', 'WhatsApp e e-mail'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail']]);
export const OPCOES_UF = op(
  'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ').map((uf) => [uf, uf]),
);
export const FORMAS_PAGAMENTO: Record<string, string> = {
  pix_boleto: 'PIX e boleto',
  cartao_recorrente: 'Cartão recorrente',
  cartao_parcelado: 'Cartão parcelado (anual)',
};

const rotuloUsuario = (u: Item) => `${u.nro_associado ? `#${u.nro_associado} · ` : ''}${u.nome}`;
const rotuloFranquia = (f: Item) => `Loja ${f.nro_da_loja} · ${f.nome_fantasia}`;

const Secundario = ({ children }: { children: ReactNode }) => (
  <span className="block font-body-sm text-[0.8rem] text-on-surface-variant">{children}</span>
);

// ---------- busca de CNPJ ----------

function BuscarCnpj({ valores, aplicar }: { valores: Valores; aplicar: (p: Valores) => void }) {
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cnpj = digitos(String(valores.cnpj ?? ''));
  return (
    <div className="flex flex-col items-end">
      <Botao
        disabled={cnpj.length !== 14}
        carregando={buscando}
        icone="travel_explore"
        title="Preencher com os dados da Receita (OpenCNPJ)"
        onClick={async () => {
          setBuscando(true);
          setErro(null);
          try {
            const d = await get<Valores>(`/franquia/consulta-cnpj/${cnpj}/`);
            const { situacao_cadastral, ...campos } = d;
            aplicar(campos);
            if (situacao_cadastral !== 'Ativa') setErro(`Situação na Receita: ${situacao_cadastral}`);
          } catch (e) {
            setErro(e instanceof ErroApi ? e.message : 'Falha na consulta');
          }
          setBuscando(false);
        }}
      >
        Buscar
      </Botao>
      {erro && <span className="mt-1 text-[0.75rem] text-error whitespace-nowrap">{erro}</span>}
    </div>
  );
}

// ---------- recursos ----------

const camposUsuario: CampoForm[] = [
  { nome: 'first_name', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
  { nome: 'last_name', rotulo: 'Sobrenome', tipo: 'texto' },
  { nome: 'email', rotulo: 'E-mail (login)', tipo: 'email', obrigatorio: true },
  { nome: 'cpf', rotulo: 'CPF', tipo: 'texto', obrigatorio: true, mascara: mascaraCpf, largura: 'terco' },
  { nome: 'whatsapp', rotulo: 'WhatsApp', tipo: 'texto', obrigatorio: true, mascara: mascaraWhatsapp, placeholder: '+5511999998888', largura: 'terco' },
  { nome: 'nro_associado', rotulo: 'Nº de associado', tipo: 'numero', largura: 'terco' },
  { nome: 'status', rotulo: 'Status', tipo: 'select', obrigatorio: true, opcoes: OPCOES_STATUS, largura: 'terco' },
  { nome: 'cargo', rotulo: 'Cargo', tipo: 'select', obrigatorio: true, opcoes: OPCOES_CARGO, largura: 'terco', ajuda: 'Administrador acessa este painel.' },
  { nome: 'tipo_comunicacao', rotulo: 'Comunicação', tipo: 'select', obrigatorio: true, opcoes: OPCOES_COMUNICACAO, largura: 'terco' },
  { nome: 'data_admissao', rotulo: 'Data de admissão', tipo: 'data', largura: 'terco' },
  {
    nome: 'franquias',
    rotulo: 'Lojas',
    tipo: 'relacao',
    largura: 'inteira',
    relacao: { endpoint: '/franquia/', rotulo: rotuloFranquia, multiplo: true },
  },
];

export const associados: Recurso = {
  titulo: 'Associados',
  singular: 'Associado',
  descricao: 'Franqueados e administradores com acesso ao sistema.',
  endpoint: '/usuario/',
  buscaPlaceholder: 'Nome, e-mail, CPF, nº de associado ou CNPJ',
  padrao: { status: 'ativo', cargo: 'franqueado', tipo_comunicacao: 'whatsapp_email' },
  podeExcluir: false,
  filtros: [
    { param: 'status', rotulo: 'Status', opcoes: OPCOES_STATUS },
    { param: 'cargo', rotulo: 'Cargo', opcoes: OPCOES_CARGO },
  ],
  colunas: [
    { titulo: 'Nº', valor: (u) => <span className="tabular-nums text-on-surface-variant">{String(u.nro_associado ?? '—')}</span>, className: 'w-16' },
    { titulo: 'Associado', valor: (u) => <><span className="font-semibold">{String(u.nome)}</span><Secundario>{String(u.email)}</Secundario></> },
    { titulo: 'CPF', valor: (u) => <span className="tabular-nums whitespace-nowrap">{String(u.cpf)}</span>, className: 'hidden lg:table-cell' },
    {
      titulo: 'Lojas',
      valor: (u) => {
        const lojas = u.lojas as number[];
        return <span className="tabular-nums" title={lojas.join(', ')}>{lojas.length}</span>;
      },
      className: 'hidden md:table-cell',
    },
    {
      titulo: 'Status',
      valor: (u) => {
        const s = STATUS_USUARIO[String(u.status)];
        return (
          <span className="inline-flex flex-wrap gap-1">
            <Selo tom={s?.tom}>{s?.rotulo ?? String(u.status)}</Selo>
            {u.cargo === 'admin' && <Selo tom="info" icone="shield_person">Admin</Selo>}
          </span>
        );
      },
    },
  ],
  campos: camposUsuario,
  extrasEdicao: (u) => (
    <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/40">
      <Botao pequeno variante="primario" icone="visibility" onClick={() => verComo.iniciar(u.id, String(u.nome))}>
        Ver como associado
      </Botao>
      <Botao pequeno icone="receipt_long" onClick={() => navegar(`/painel/cobrancas?usuario=${u.id}`)}>
        Ver cobranças
      </Botao>
      <Botao pequeno icone="account_balance_wallet" onClick={() => navegar(`/painel/perfis?usuario=${u.id}`)}>
        Perfis de cobrança
      </Botao>
      {typeof u.whatsapp === 'string' && u.whatsapp && (
        <a className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-label-md text-label-md text-on-surface bg-surface-container-high hover:bg-surface-container-highest" href={linkWhatsApp(u.whatsapp)} rel="noreferrer" target="_blank">
          WhatsApp
        </a>
      )}
    </div>
  ),
};

export const franquias: Recurso = {
  titulo: 'Franquias',
  singular: 'Franquia',
  descricao: 'Lojas Subway dos associados. Use "Buscar" para preencher pelo CNPJ.',
  endpoint: '/franquia/',
  buscaPlaceholder: 'Nº da loja, CNPJ, razão social, cidade ou sócio',
  filtros: [{ param: 'estado', rotulo: 'UF', opcoes: OPCOES_UF }],
  colunas: [
    { titulo: 'Loja', valor: (f) => <span className="tabular-nums font-semibold">{String(f.nro_da_loja)}</span>, className: 'w-20' },
    { titulo: 'Empresa', valor: (f) => <><span className="font-semibold">{String(f.nome_fantasia)}</span><Secundario>{String(f.cnpj)}</Secundario></> },
    { titulo: 'Cidade', valor: (f) => `${f.cidade}/${f.estado}`, className: 'hidden md:table-cell' },
    { titulo: 'Sócios', valor: (f) => (f.socios as string[]).join(', ') || <span className="text-outline">—</span>, className: 'hidden lg:table-cell' },
  ],
  campos: [
    {
      nome: 'cnpj', rotulo: 'CNPJ', tipo: 'texto', obrigatorio: true, mascara: mascaraCnpj, largura: 'meia',
      acao: (v, aplicar) => <BuscarCnpj valores={v} aplicar={aplicar} />,
    },
    { nome: 'nro_da_loja', rotulo: 'Nº da loja', tipo: 'numero', obrigatorio: true, largura: 'meia' },
    { nome: 'razao_social', rotulo: 'Razão social', tipo: 'texto', obrigatorio: true },
    { nome: 'nome_fantasia', rotulo: 'Nome fantasia', tipo: 'texto', obrigatorio: true },
    { nome: 'cep', rotulo: 'CEP', tipo: 'texto', obrigatorio: true, mascara: mascaraCep, largura: 'terco' },
    { nome: 'rua', rotulo: 'Rua', tipo: 'texto', obrigatorio: true, largura: 'meia' },
    { nome: 'numero', rotulo: 'Número', tipo: 'texto', obrigatorio: true, largura: 'terco' },
    { nome: 'complemento', rotulo: 'Complemento', tipo: 'texto', largura: 'terco' },
    { nome: 'bairro', rotulo: 'Bairro', tipo: 'texto', obrigatorio: true, largura: 'terco' },
    { nome: 'cidade', rotulo: 'Cidade', tipo: 'texto', obrigatorio: true, largura: 'terco' },
    { nome: 'estado', rotulo: 'UF', tipo: 'select', obrigatorio: true, opcoes: OPCOES_UF, largura: 'terco' },
    {
      nome: 'usuarios', rotulo: 'Sócios', tipo: 'relacao', largura: 'inteira',
      relacao: { endpoint: '/usuario/', rotulo: rotuloUsuario, multiplo: true },
    },
  ],
};

export const perfis: Recurso = {
  titulo: 'Perfis de cobrança',
  singular: 'Perfil',
  descricao: 'Quem paga, como e quanto. A cobrança mensal é gerada a partir daqui.',
  endpoint: '/cobranca/perfis/',
  buscaPlaceholder: 'Pagador, documento ou associado',
  padrao: { tipo_documento: 'cnpj', forma_pagamento: 'pix_boleto', dia_vencimento: 15, qtd_lojas: 1, ativo: true },
  colunas: [
    { titulo: 'Pagador', valor: (p) => <><span className="font-semibold">{String(p.nome_pagador)}</span><Secundario>{String(p.documento)}</Secundario></> },
    { titulo: 'Associado', valor: (p) => String((p.associado as Item).nome), className: 'hidden md:table-cell' },
    { titulo: 'Forma', valor: (p) => FORMAS_PAGAMENTO[String(p.forma_pagamento)], className: 'hidden lg:table-cell' },
    { titulo: 'Venc.', valor: (p) => `Dia ${p.dia_vencimento}`, className: 'hidden sm:table-cell' },
    { titulo: 'Lojas', valor: (p) => String(p.qtd_lojas), className: 'hidden sm:table-cell tabular-nums' },
    {
      titulo: 'Valor',
      valor: (p) =>
        p.valor_personalizado_cheio ? (
          <Selo tom="alerta" icone="tune">{moeda(String(p.valor_personalizado_cheio))}</Selo>
        ) : (
          <span className="text-on-surface-variant">Tabela</span>
        ),
    },
    { titulo: 'Ativo', valor: (p) => (p.ativo ? <Selo tom="sucesso">Ativo</Selo> : <Selo>Inativo</Selo>) },
  ],
  campos: [
    {
      nome: 'usuario', rotulo: 'Associado', tipo: 'relacao', obrigatorio: true, largura: 'inteira',
      relacao: { endpoint: '/usuario/?status=ativo', rotulo: rotuloUsuario },
    },
    { nome: 'nome_pagador', rotulo: 'Nome do pagador', tipo: 'texto', obrigatorio: true, largura: 'meia' },
    { nome: 'tipo_documento', rotulo: 'Documento', tipo: 'select', obrigatorio: true, opcoes: op([['cnpj', 'CNPJ'], ['cpf', 'CPF']]), largura: 'terco' },
    { nome: 'documento', rotulo: 'CPF/CNPJ', tipo: 'texto', obrigatorio: true, mascara: mascaraCpfCnpj, largura: 'terco' },
    { nome: 'forma_pagamento', rotulo: 'Forma de pagamento', tipo: 'select', obrigatorio: true, opcoes: op(Object.entries(FORMAS_PAGAMENTO)), largura: 'meia' },
    { nome: 'dia_vencimento', rotulo: 'Vencimento', tipo: 'select', obrigatorio: true, opcoes: op([['15', 'Dia 15'], ['25', 'Dia 25']]), largura: 'terco' },
    { nome: 'qtd_lojas', rotulo: 'Qtd. de lojas', tipo: 'numero', obrigatorio: true, largura: 'terco', ajuda: 'Define a linha da tabela de valores.' },
    { nome: 'qtd_parcelas', rotulo: 'Parcelas', tipo: 'numero', largura: 'terco', visivel: (v) => v.forma_pagamento === 'cartao_parcelado' },
    { nome: 'franquias', rotulo: 'Lojas cobertas', tipo: 'relacao', largura: 'inteira', relacao: { endpoint: '/franquia/', rotulo: rotuloFranquia, multiplo: true } },
    {
      nome: 'valor_personalizado_cheio', rotulo: 'Valor personalizado (cheio)', tipo: 'dinheiro', largura: 'meia',
      ajuda: 'Deixe vazio para usar a tabela padrão.',
    },
    { nome: 'valor_personalizado_desconto', rotulo: 'Valor personalizado (em dia)', tipo: 'dinheiro', largura: 'meia', visivel: (v) => Boolean(v.valor_personalizado_cheio) },
    { nome: 'valor_personalizado_inicio', rotulo: 'Vale a partir de', tipo: 'data', largura: 'meia', visivel: (v) => Boolean(v.valor_personalizado_cheio) },
    { nome: 'valor_personalizado_fim', rotulo: 'Vale até', tipo: 'data', largura: 'meia', ajuda: 'Vazio = sem prazo.', visivel: (v) => Boolean(v.valor_personalizado_cheio) },
    { nome: 'motivo_valor_personalizado', rotulo: 'Motivo do valor personalizado', tipo: 'textarea', largura: 'inteira', visivel: (v) => Boolean(v.valor_personalizado_cheio) },
    { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea', largura: 'inteira' },
    { nome: 'ativo', rotulo: 'Perfil ativo (gera cobrança todo mês)', tipo: 'checkbox', largura: 'inteira' },
  ],
  extrasEdicao: (p) => (
    <div className="pt-2 border-t border-outline-variant/40">
      <Botao pequeno icone="receipt_long" onClick={() => navegar(`/painel/cobrancas?usuario=${(p.associado as Item).id}`)}>
        Ver cobranças do associado
      </Botao>
    </div>
  ),
};

export const noticias: Recurso = {
  titulo: 'Notícias',
  singular: 'Notícia',
  descricao: 'Publicadas na landing page.',
  endpoint: '/noticia/',
  buscaPlaceholder: 'Buscar notícia',
  colunas: [
    {
      titulo: '',
      valor: (n) => (n.imagem ? <img alt="" className="w-16 h-10 rounded-md object-cover" src={String(n.imagem)} /> : null),
      className: 'w-20',
    },
    { titulo: 'Notícia', valor: (n) => <><span className="font-semibold">{String(n.titulo)}</span><Secundario>{String(n.subtitulo)}</Secundario></> },
    { titulo: 'Publicada em', valor: (n) => dataBR(String(n.criado_em)), className: 'hidden md:table-cell whitespace-nowrap' },
  ],
  campos: [
    { nome: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, largura: 'inteira' },
    { nome: 'subtitulo', rotulo: 'Subtítulo', tipo: 'texto', obrigatorio: true, largura: 'inteira' },
    { nome: 'texto', rotulo: 'Texto', tipo: 'textarea', obrigatorio: true, largura: 'inteira' },
    { nome: 'imagem', rotulo: 'Imagem', tipo: 'imagem', obrigatorioAoCriar: true, largura: 'inteira' },
  ],
};

export const eventos: Recurso = {
  titulo: 'Eventos',
  singular: 'Evento',
  descricao: 'Agenda exibida na landing page.',
  endpoint: '/evento/',
  buscaPlaceholder: 'Buscar evento',
  colunas: [
    { titulo: 'Evento', valor: (e) => <span className="font-semibold">{String(e.titulo)}</span> },
    { titulo: 'Data', valor: (e) => <span className="tabular-nums whitespace-nowrap">{dataHoraBR(String(e.data_hora))}</span> },
    {
      titulo: '',
      valor: (e) => (new Date(String(e.data_hora)) > new Date() ? <Selo tom="info">Próximo</Selo> : <Selo>Realizado</Selo>),
    },
  ],
  campos: [
    { nome: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, largura: 'inteira' },
    { nome: 'data_hora', rotulo: 'Data e hora', tipo: 'datahora', obrigatorio: true },
  ],
};

export const membros: Recurso = {
  titulo: 'Membros',
  singular: 'Membro',
  descricao: 'Diretoria e representantes exibidos na landing, na ordem definida.',
  endpoint: '/membro/',
  buscaPlaceholder: 'Buscar membro',
  padrao: { ordem: 0 },
  colunas: [
    { titulo: '', valor: (m) => (m.foto ? <img alt="" className="w-10 h-10 rounded-full object-cover object-top" src={String(m.foto)} /> : null), className: 'w-14' },
    { titulo: 'Membro', valor: (m) => <><span className="font-semibold">{String(m.nome)}</span><Secundario>{String(m.titulo)}</Secundario></> },
    { titulo: 'Ordem', valor: (m) => <span className="tabular-nums">{String(m.ordem)}</span>, className: 'w-20' },
  ],
  campos: [
    { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
    { nome: 'titulo', rotulo: 'Cargo/título', tipo: 'texto', obrigatorio: true },
    { nome: 'ordem', rotulo: 'Ordem de exibição', tipo: 'numero', largura: 'terco', ajuda: 'Menor aparece primeiro.' },
    { nome: 'foto', rotulo: 'Foto', tipo: 'imagem', obrigatorioAoCriar: true, largura: 'inteira' },
  ],
};

const TIPOS_DOCUMENTO = op([['documento', 'Documento'], ['palestra', 'Palestra'], ['ata_de_reuniao', 'Ata de reunião'], ['video', 'Vídeo']]);

export const documentos: Recurso = {
  titulo: 'Documentos',
  singular: 'Documento',
  descricao: 'Arquivos disponíveis para os associados logados.',
  endpoint: '/documento/',
  buscaPlaceholder: 'Buscar documento',
  colunas: [
    { titulo: 'Documento', valor: (d) => <span className="font-semibold">{String(d.titulo)}</span> },
    { titulo: 'Tipo', valor: (d) => <Selo>{TIPOS_DOCUMENTO.find((t) => t.valor === d.tipo)?.rotulo ?? String(d.tipo ?? '—')}</Selo> },
    { titulo: 'Enviado em', valor: (d) => dataBR(String(d.criado_em)), className: 'hidden md:table-cell' },
    {
      titulo: 'Arquivo',
      valor: (d) => (
        <a className="text-primary font-semibold hover:underline" href={String(d.arquivo)} onClick={(e) => e.stopPropagation()} rel="noreferrer" target="_blank">
          Abrir
        </a>
      ),
    },
  ],
  campos: [
    { nome: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true },
    { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: TIPOS_DOCUMENTO },
    { nome: 'arquivo', rotulo: 'Arquivo', tipo: 'arquivo', obrigatorioAoCriar: true, largura: 'inteira' },
  ],
};

export const parceiros: Recurso = {
  titulo: 'Parceiros',
  singular: 'Parceiro',
  descricao: 'Benefícios e parcerias exibidos na landing.',
  endpoint: '/parceiro/',
  buscaPlaceholder: 'Buscar parceiro',
  padrao: { tipo: 'beneficio' },
  colunas: [
    { titulo: '', valor: (p) => (p.logo ? <img alt="" className="h-8 w-16 object-contain" src={String(p.logo)} /> : null), className: 'w-20' },
    { titulo: 'Parceiro', valor: (p) => <><span className="font-semibold">{String(p.nome)}</span><Secundario>{String(p.contato ?? '')}</Secundario></> },
    { titulo: 'Tipo', valor: (p) => <Selo>{p.tipo === 'parceria' ? 'Parceria' : 'Benefício'}</Selo>, className: 'hidden md:table-cell' },
  ],
  campos: [
    { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
    { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: op([['beneficio', 'Benefício'], ['parceria', 'Parceria']]) },
    { nome: 'beneficios', rotulo: 'Benefícios', tipo: 'textarea', largura: 'inteira', ajuda: 'A 1ª linha aparece no card da landing.' },
    { nome: 'site', rotulo: 'Site', tipo: 'url', placeholder: 'https://' },
    { nome: 'contato', rotulo: 'Contato', tipo: 'texto' },
    { nome: 'logo', rotulo: 'Logo', tipo: 'imagem', largura: 'inteira' },
  ],
};

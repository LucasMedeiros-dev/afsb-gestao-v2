/**
 * Dados cadastrais da AFSB.
 *
 * Um lugar só: eles aparecem no rodapé público, no rodapé do portal e no
 * JSON-LD da página. Repetir a string em três arquivos garante que um dia
 * três endereços diferentes convivam no site.
 */

export const RAZAO_SOCIAL = 'AFSB - Associação de Franquias Subway® do Brasil';

/** Formatado como sai no cartão CNPJ. */
export const CNPJ = '50.089.970/0001-83';

export const ENDERECO = {
  logradouro: 'Av. Presidente Vargas, 1527 - sala EF92',
  bairro: 'Jd Irajá',
  cidade: 'Ribeirão Preto',
  uf: 'SP',
  cep: '14020-277',
} as const;

/** Duas linhas: quebra natural entre rua e cidade. */
export const ENDERECO_LINHAS = [
  ENDERECO.logradouro,
  `${ENDERECO.bairro} - ${ENDERECO.cidade}/${ENDERECO.uf} - ${ENDERECO.cep}`,
] as const;

/** Uma linha, para onde não cabe quebrar. */
export const ENDERECO_COMPLETO = ENDERECO_LINHAS.join(' - ');

/** schema.org/PostalAddress - o buscador usa para local business. */
export const SCHEMA_ENDERECO = {
  '@type': 'PostalAddress',
  streetAddress: ENDERECO.logradouro,
  addressLocality: ENDERECO.cidade,
  addressRegion: ENDERECO.uf,
  postalCode: ENDERECO.cep,
  addressCountry: 'BR',
} as const;

/** WhatsApp de atendimento (site, rodapé e suporte de acesso). */
export const WHATSAPP_URL = 'https://wa.me/5511993414925';

/**
 * SEO por rota, sem dependência nova.
 *
 * O app é uma SPA: existe um único index.html, então title, description e
 * canonical precisam ser trocados a cada rota - sem isso o Google indexa
 * todas as páginas com o mesmo título e elas concorrem entre si.
 *
 * Não substitui SSR. O crawler do Google executa JavaScript e lê o que este
 * hook escreve; crawler de rede social (WhatsApp, LinkedIn) em geral **não**
 * executa, e para eles a prévia sai a do index.html. Resolver de verdade
 * exige pré-renderização - está anotado como dívida no README.
 */
import { useEffect } from 'react';
import { CNPJ, SCHEMA_ENDERECO } from './dadosInstitucionais';

export const SITE = 'AFSB - Associação de Franquias Subway® do Brasil';

/** Base do canonical. Em dev cai no próprio host. */
function origem(): string {
  return window.location.origin;
}

function meta(seletor: string, atributo: string, valor: string, conteudo: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(seletor);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(atributo, valor);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', conteudo);
}

function elo(rel: string, href: string): void {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
}

export interface DadosSeo {
  titulo: string;
  descricao: string;
  caminho: string;
  /** JSON-LD da página. Dado estruturado é o que rende rich result. */
  schema?: Record<string, unknown>;
}

export function useSeo({ titulo, descricao, caminho, schema }: DadosSeo): void {
  useEffect(() => {
    const completo = titulo === SITE ? titulo : `${titulo} | AFSB`;
    document.title = completo;
    meta('meta[name="description"]', 'name', 'description', descricao);
    // robots explícito: sem isso, um proxy mal configurado pode injetar
    // noindex e o site desaparece sem ninguém perceber.
    meta('meta[name="robots"]', 'name', 'robots', 'index, follow');

    const url = `${origem()}${caminho}`;
    elo('canonical', url);

    // Open Graph e Twitter: prévia ao compartilhar em rede social.
    meta('meta[property="og:title"]', 'property', 'og:title', completo);
    meta('meta[property="og:description"]', 'property', 'og:description', descricao);
    meta('meta[property="og:url"]', 'property', 'og:url', url);
    meta('meta[property="og:type"]', 'property', 'og:type', 'website');
    meta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE);
    meta('meta[property="og:image"]', 'property', 'og:image', `${origem()}/afsb-logo.png`);
    meta('meta[property="og:locale"]', 'property', 'og:locale', 'pt_BR');
    meta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');

    if (!schema) return;
    // JSON-LD com id fixo: remontar a tag a cada rota evita acumular
    // schemas de páginas anteriores, que confunde o validador do Google.
    const ID = 'afsb-jsonld';
    document.getElementById(ID)?.remove();
    const tag = document.createElement('script');
    tag.id = ID;
    tag.type = 'application/ld+json';
    tag.textContent = JSON.stringify(schema);
    document.head.appendChild(tag);
    return () => document.getElementById(ID)?.remove();
  }, [titulo, descricao, caminho, schema]);
}

/** Organização: repetido em toda página, é o que o Google usa no knowledge panel. */
export const SCHEMA_ORG: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AFSB - Associação de Franquias Subway® do Brasil',
  alternateName: 'AFSB',
  description:
    'Associação independente e autofinanciada de franqueados Subway® no Brasil. ' +
    'Atuação jurídica e institucional, redução de custos e representação coletiva.',
  foundingDate: '2022',
  areaServed: 'BR',
  email: 'contato@afsb.com.br',
  address: SCHEMA_ENDERECO,
  // taxID: o buscador reconhece o CNPJ como identificador da entidade.
  taxID: CNPJ,
  knowsLanguage: 'pt-BR',
};

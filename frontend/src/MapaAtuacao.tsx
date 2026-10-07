import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import { lojasPorEstado } from './api';

type Regiao = 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul';

interface Estado {
  nome: string;
  regiao: Regiao;
  /** Centro aproximado do estado: a base só guarda a UF da loja. */
  lat: number;
  lng: number;
}

interface PontoLojas extends Estado {
  uf: string;
  lojas: number;
}

const ESTADOS: Record<string, Estado> = {
  AC: { nome: 'Acre', regiao: 'Norte', lat: -9.0, lng: -70.5 },
  AL: { nome: 'Alagoas', regiao: 'Nordeste', lat: -9.6, lng: -36.6 },
  AP: { nome: 'Amapá', regiao: 'Norte', lat: 1.4, lng: -51.8 },
  AM: { nome: 'Amazonas', regiao: 'Norte', lat: -4.2, lng: -64.6 },
  BA: { nome: 'Bahia', regiao: 'Nordeste', lat: -12.5, lng: -41.7 },
  CE: { nome: 'Ceará', regiao: 'Nordeste', lat: -5.2, lng: -39.5 },
  DF: { nome: 'Distrito Federal', regiao: 'Centro-Oeste', lat: -15.8, lng: -47.9 },
  ES: { nome: 'Espírito Santo', regiao: 'Sudeste', lat: -19.6, lng: -40.6 },
  GO: { nome: 'Goiás', regiao: 'Centro-Oeste', lat: -16.0, lng: -49.6 },
  MA: { nome: 'Maranhão', regiao: 'Nordeste', lat: -5.0, lng: -45.3 },
  MT: { nome: 'Mato Grosso', regiao: 'Centro-Oeste', lat: -12.9, lng: -55.9 },
  MS: { nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste', lat: -20.5, lng: -54.8 },
  MG: { nome: 'Minas Gerais', regiao: 'Sudeste', lat: -18.5, lng: -44.6 },
  PA: { nome: 'Pará', regiao: 'Norte', lat: -3.8, lng: -52.5 },
  PB: { nome: 'Paraíba', regiao: 'Nordeste', lat: -7.1, lng: -36.7 },
  PR: { nome: 'Paraná', regiao: 'Sul', lat: -24.6, lng: -51.6 },
  PE: { nome: 'Pernambuco', regiao: 'Nordeste', lat: -8.4, lng: -37.9 },
  PI: { nome: 'Piauí', regiao: 'Nordeste', lat: -7.4, lng: -42.7 },
  RJ: { nome: 'Rio de Janeiro', regiao: 'Sudeste', lat: -22.3, lng: -42.7 },
  RN: { nome: 'Rio Grande do Norte', regiao: 'Nordeste', lat: -5.8, lng: -36.5 },
  RS: { nome: 'Rio Grande do Sul', regiao: 'Sul', lat: -29.7, lng: -53.3 },
  RO: { nome: 'Rondônia', regiao: 'Norte', lat: -10.9, lng: -62.8 },
  RR: { nome: 'Roraima', regiao: 'Norte', lat: 2.1, lng: -61.4 },
  SC: { nome: 'Santa Catarina', regiao: 'Sul', lat: -27.3, lng: -50.4 },
  SP: { nome: 'São Paulo', regiao: 'Sudeste', lat: -22.3, lng: -48.7 },
  SE: { nome: 'Sergipe', regiao: 'Nordeste', lat: -10.6, lng: -37.4 },
  TO: { nome: 'Tocantins', regiao: 'Norte', lat: -10.2, lng: -48.3 },
};

type MarcadorLojas = L.Marker & { options: L.MarkerOptions & { ponto: PontoLojas } };

const plural = (n: number) => `${n} ${n === 1 ? 'loja' : 'lojas'}`;

/** Nome do grupo: mesma região → região; senão Brasil. */
function nomeDoGrupo(pontos: PontoLojas[]): string {
  if (pontos.every((p) => p.regiao === pontos[0].regiao)) return pontos[0].regiao;
  return 'Brasil';
}

function iconePin(nome: string, lojas: number, grupo: boolean): L.DivIcon {
  // Grupo cresce com o total para dar noção de densidade.
  const tamanho = grupo ? Math.min(64, 40 + Math.round(Math.sqrt(lojas) * 2)) : 36;
  return L.divIcon({
    className: 'afsb-pin',
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
    html: `
      <div class="afsb-pin__bolha ${grupo ? 'afsb-pin__bolha--grupo' : ''}" style="width:${tamanho}px;height:${tamanho}px">
        ${lojas}
      </div>
      <div class="afsb-pin__rotulo">${nome}</div>
    `,
  });
}

export default function MapaAtuacao() {
  const [pontos, setPontos] = useState<PontoLojas[]>([]);

  useEffect(() => {
    lojasPorEstado()
      .then((dados) =>
        // UF fora da tabela (erro de digitação na base) não tem onde cair no mapa.
        setPontos(dados.flatMap(({ uf, lojas }) => (ESTADOS[uf] ? [{ ...ESTADOS[uf], uf, lojas }] : []))),
      )
      .catch(() => setPontos([]));
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mapa = L.map(el, {
      center: [-14.5, -52],
      zoom: 4,
      minZoom: 3,
      maxZoom: 12,
      // Roda do mouse rolaria o mapa em vez da página.
      scrollWheelZoom: false,
      maxBounds: L.latLngBounds([-38, -80], [8, -28]),
      zoomSnap: 0.25,
      attributionControl: true,
    });
    mapa.attributionControl.setPrefix(false).addAttribution('Malha: IBGE');

    // Base sem tiles externos: contorno dos estados (IBGE, qualidade mínima)
    // servido pelo próprio site. Estados com loja ficam em verde claro.
    const ufsComLoja = new Set(pontos.map((p) => p.uf));
    let cancelado = false;
    fetch('/brasil-uf.geojson')
      .then((r) => r.json())
      .then((malha: GeoJSON.FeatureCollection) => {
        if (cancelado) return;
        const estados = L.geoJSON(malha, {
          interactive: false,
          style: (f) => ({
            color: '#ffffff',
            weight: 1.2,
            fillColor: ufsComLoja.has(f?.properties?.uf) ? '#cdeed5' : '#e2e8f0',
            fillOpacity: 1,
          }),
        }).addTo(mapa);
        estados.bringToBack();
        mapa.fitBounds(estados.getBounds(), { padding: [16, 16] });
      })
      .catch(() => {
        // Sem malha, os pins seguem funcionando sobre o fundo liso.
      });

    const grupos = L.markerClusterGroup({
      maxClusterRadius: 70,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: (cluster) => {
        const filhos = cluster.getAllChildMarkers().map((m) => (m as MarcadorLojas).options.ponto);
        const total = filhos.reduce((soma, p) => soma + p.lojas, 0);
        return iconePin(nomeDoGrupo(filhos), total, true);
      },
    });

    for (const ponto of pontos) {
      const marcador = L.marker([ponto.lat, ponto.lng], {
        icon: iconePin(ponto.nome, ponto.lojas, false),
        title: `${ponto.nome}: ${plural(ponto.lojas)}`,
        ponto,
      } as L.MarkerOptions);
      marcador.bindTooltip(`<strong>${ponto.nome}</strong><br/>${plural(ponto.lojas)}`, {
        direction: 'top',
        offset: [0, -20],
      });
      grupos.addLayer(marcador);
    }
    mapa.addLayer(grupos);

    return () => {
      cancelado = true;
      mapa.remove();
    };
  }, [pontos]);

  return (
    <>
      <style>{`
        .afsb-pin { background: none; border: none; }
        .afsb-pin__bolha {
          display: flex; align-items: center; justify-content: center;
          border-radius: 9999px; background: #00652c; color: #fff;
          font: 700 13px/1 Kanit, system-ui, sans-serif;
          border: 3px solid #fff; box-shadow: 0 6px 16px -4px rgba(15,23,42,.45);
          transition: transform .15s ease-out;
        }
        .afsb-pin__bolha--grupo {
          background: #feb63c; color: #281800; font-size: 15px;
          box-shadow: 0 0 0 6px rgba(254,182,60,.3), 0 8px 20px -6px rgba(15,23,42,.45);
        }
        .afsb-pin:hover .afsb-pin__bolha { transform: scale(1.08); }
        .afsb-pin__rotulo {
          position: absolute; top: calc(100% + 4px); left: 50%; transform: translateX(-50%);
          white-space: nowrap; padding: 2px 8px; border-radius: 9999px;
          background: rgba(255,255,255,.92); color: #0f172a;
          font: 600 11px/1.4 Kanit, system-ui, sans-serif;
          box-shadow: 0 2px 6px rgba(15,23,42,.18); pointer-events: none;
        }
      `}</style>
      <div
        ref={containerRef}
        aria-label="Mapa de lojas associadas por região"
        className="w-full h-[420px] md:h-[520px] rounded-3xl overflow-hidden shadow-sm z-0 !bg-[#f1f5f9]"
        role="region"
      />
    </>
  );
}

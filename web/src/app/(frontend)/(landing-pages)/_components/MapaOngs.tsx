'use client'
import { useEffect, useRef, useState, type RefObject } from "react";
import type { ExpressionSpecification, GeoJSONSource, Map as MapaMapbox, Marker } from "mapbox-gl";

import { limitarBbox, type Bbox, type Ponto } from "@/lib/mapa/geo";
import type { PinNoMapa } from "./tipos";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const ZOOM_INICIAL = 12;

/** Comandos que a tela dá ao mapa (voar até uma ONG, enquadrar um bairro). */
export type ControleMapa = {
  voarPara: (ponto: Ponto, zoom?: number) => void;
  enquadrar: (bbox: Bbox) => void;
};

// cor de um token do tema (globals.css), para desenhar no canvas do mapa
function cor(token: string, reserva: string) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim();
  return valor || reserva;
}

/** Pin em gota (protótipo), desenhado em SVG e entregue ao mapa como imagem. */
function imagemPin(preenchimento: string, borda: string, largura: number): Promise<HTMLImageElement> {
  const altura = Math.round(largura * 1.25);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura * 2}" height="${altura * 2}" viewBox="0 0 40 50">
    <path d="M20 47C20 47 5 31 5 19.5a15 15 0 1 1 30 0C35 31 20 47 20 47Z" fill="${preenchimento}" stroke="${borda}" stroke-width="3.5"/>
    <circle cx="20" cy="19.5" r="5" fill="${borda}"/></svg>`;
  return new Promise((resolve, reject) => {
    const img = new Image(largura * 2, altura * 2);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Pin de cada ONG: selecionada maior; com urgência, terracota. */
const imagemDoPin = (selecionada: string | null): ExpressionSpecification => [
  "case",
  ["==", ["get", "id"], selecionada ?? ""],
  ["case", ["get", "urgente"], "pin-urgente-selecionado", "pin-selecionado"],
  ["case", ["get", "urgente"], "pin-urgente", "pin"],
];

const paraGeoJson = (pins: PinNoMapa[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: pins.map((p) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
    properties: { id: p.id, nome: p.nome, urgente: p.urgente },
  })),
});

type Props = {
  centroInicial: Ponto;
  pins: PinNoMapa[];
  pessoa: Ponto | null; // localização de quem está usando, se compartilhou
  selecionada: string | null;
  /** espaço coberto por cima do mapa (painel da lista no celular), para centralizar no que sobra */
  margemInferior: number;
  aoMover: (bbox: Bbox) => void;
  aoSelecionar: (id: string) => void;
  controleRef: RefObject<ControleMapa | null>;
};

/**
 * Mapa da área pública (Mapbox GL JS). Pins próximos viram um círculo com a quantidade;
 * tocar no círculo aproxima, tocar no pin seleciona a ONG.
 */
export function MapaOngs({ centroInicial, pins, pessoa, selecionada, margemInferior, aoMover, aoSelecionar, controleRef }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaMapbox | null>(null);
  const pronto = useRef(false);
  const [carregado, setCarregado] = useState(false); // refaz os efeitos abaixo quando o mapa fica pronto
  const marcadorPessoa = useRef<Marker | null>(null);
  const criarMarcador = useRef<((el: HTMLElement) => Marker) | null>(null);
  // valores mais recentes, lidos pelos eventos do mapa
  const ultimo = useRef({ pins, selecionada, aoMover, aoSelecionar, centroInicial });
  ultimo.current = { pins, selecionada, aoMover, aoSelecionar, centroInicial };

  // comandos para a tela (antes de o mapa carregar, guarda o último pedido)
  const pendente = useRef<(() => void) | null>(null);
  useEffect(() => {
    const executar = (acao: (m: MapaMapbox) => void) => {
      if (mapa.current && pronto.current) acao(mapa.current);
      else pendente.current = () => mapa.current && acao(mapa.current);
    };
    controleRef.current = {
      voarPara: (p, zoom = 15) => executar((m) => m.flyTo({ center: [p.longitude, p.latitude], zoom, essential: true })),
      enquadrar: ([o, s, l, n]) => executar((m) => m.fitBounds([[o, s], [l, n]], { padding: 40, maxZoom: 15 })),
    };
  }, [controleRef]);

  // cria o mapa uma vez (o mapbox-gl só roda no navegador)
  useEffect(() => {
    if (!TOKEN || !container.current) return;
    let cancelado = false;

    import("mapbox-gl").then(async ({ default: mapboxgl }) => {
      if (cancelado || !container.current) return;
      const { centroInicial: centro } = ultimo.current;
      const m = new mapboxgl.Map({
        accessToken: TOKEN,
        container: container.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [centro.longitude, centro.latitude],
        zoom: ZOOM_INICIAL,
        language: "pt",
      });
      mapa.current = m;
      criarMarcador.current = (el) => new mapboxgl.Marker({ element: el });
      m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

      const avisarArea = () => {
        const b = m.getBounds();
        if (b) ultimo.current.aoMover(limitarBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]));
      };

      m.on("load", async () => {
        const musgo = cor("musgo", "#2E5E45");
        const papel = cor("papel", "#FFFDF8");
        // terracota só para urgência (pin da ONG com item urgente)
        const terracota = cor("terracota", "#B9472F");
        const [pin, pinSelecionado, pinUrgente, pinUrgenteSelecionado] = await Promise.all([
          imagemPin(musgo, papel, 30),
          imagemPin(cor("musgo-escuro", "#1F4232"), papel, 40),
          imagemPin(terracota, papel, 30),
          imagemPin(cor("terracota-escura", "#8A2F1C"), papel, 40),
        ]);
        if (cancelado) return;
        m.addImage("pin", pin, { pixelRatio: 2 });
        m.addImage("pin-selecionado", pinSelecionado, { pixelRatio: 2 });
        m.addImage("pin-urgente", pinUrgente, { pixelRatio: 2 });
        m.addImage("pin-urgente-selecionado", pinUrgenteSelecionado, { pixelRatio: 2 });

        m.addSource("ongs", {
          type: "geojson",
          data: paraGeoJson(ultimo.current.pins),
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 48,
          // quantas ONGs com urgência há em cada grupo (o contorno fica terracota)
          clusterProperties: { urgentes: ["+", ["case", ["get", "urgente"], 1, 0]] },
        });
        m.addLayer({
          id: "grupos",
          type: "circle",
          source: "ongs",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": musgo,
            "circle-radius": ["step", ["get", "point_count"], 19, 10, 23, 50, 28],
            "circle-stroke-width": 3,
            "circle-stroke-color": ["case", [">", ["get", "urgentes"], 0], terracota, papel],
          },
        });
        m.addLayer({
          id: "grupos-quantidade",
          type: "symbol",
          source: "ongs",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
            "text-size": 13,
            "text-allow-overlap": true,
          },
          paint: { "text-color": papel },
        });
        m.addLayer({
          id: "pins",
          type: "symbol",
          source: "ongs",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": imagemDoPin(ultimo.current.selecionada),
            "icon-anchor": "bottom",
            "icon-allow-overlap": true,
            "symbol-sort-key": ["case", ["==", ["get", "id"], ultimo.current.selecionada ?? ""], 1, 0],
          },
        });

        m.on("click", "grupos", (e) => {
          const grupo = e.features?.[0];
          if (!grupo || grupo.geometry.type !== "Point") return;
          const centroGrupo = grupo.geometry.coordinates as [number, number];
          (m.getSource("ongs") as GeoJSONSource).getClusterExpansionZoom(grupo.properties!.cluster_id, (erro, zoom) => {
            if (!erro && zoom != null) m.easeTo({ center: centroGrupo, zoom });
          });
        });
        m.on("click", "pins", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (id) ultimo.current.aoSelecionar(String(id));
        });
        for (const camada of ["grupos", "pins"]) {
          m.on("mouseenter", camada, () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", camada, () => (m.getCanvas().style.cursor = ""));
        }

        pronto.current = true;
        setCarregado(true);
        pendente.current?.();
        pendente.current = null;
        avisarArea();
      });
      m.on("moveend", avisarArea);
    });

    return () => {
      cancelado = true;
      pronto.current = false;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  // pins novos
  useEffect(() => {
    if (!carregado) return;
    (mapa.current?.getSource("ongs") as GeoJSONSource | undefined)?.setData(paraGeoJson(pins));
  }, [pins, carregado]);

  // ONG selecionada: pin maior e por cima
  useEffect(() => {
    const m = mapa.current;
    if (!m || !carregado) return;
    const ehSelecionada = ["==", ["get", "id"], selecionada ?? ""];
    m.setLayoutProperty("pins", "icon-image", imagemDoPin(selecionada));
    m.setLayoutProperty("pins", "symbol-sort-key", ["case", ehSelecionada, 1, 0]);
  }, [selecionada, carregado]);

  // ponto da pessoa (protótipo: bolinha escura com halo)
  useEffect(() => {
    marcadorPessoa.current?.remove();
    marcadorPessoa.current = null;
    if (!pessoa || !carregado || !criarMarcador.current || !mapa.current) return;
    const el = document.createElement("div");
    el.className = "size-[18px] rounded-full border-[3px] border-papel bg-tinta shadow-[0_0_0_8px_rgba(46,94,69,.18)]";
    el.setAttribute("aria-label", "Sua localização");
    marcadorPessoa.current = criarMarcador.current(el).setLngLat([pessoa.longitude, pessoa.latitude]).addTo(mapa.current);
  }, [pessoa, carregado]);

  // o painel da lista cobre o pé do mapa no celular: o "centro" fica no que sobra
  useEffect(() => {
    if (!carregado) return;
    mapa.current?.setPadding({ top: 0, left: 0, right: 0, bottom: margemInferior });
  }, [margemInferior, carregado]);

  // o mapbox guarda o tamanho do canvas: sem avisar, arrastar a divisória da lista deixaria
  // o mapa esticado até o próximo movimento
  useEffect(() => {
    if (!carregado || !container.current) return;
    const observador = new ResizeObserver(() => mapa.current?.resize());
    observador.observe(container.current);
    return () => observador.disconnect();
  }, [carregado]);

  if (!TOKEN) {
    return (
      <div className="flex h-full items-center justify-center bg-salvia-clara p-6 text-center text-sm text-tinta-suave">
        Mapa indisponível: falta configurar NEXT_PUBLIC_MAPBOX_TOKEN.
      </div>
    );
  }

  // altura explícita: o CSS do mapbox-gl força position: relative no contêiner do mapa
  return <div ref={container} className="h-full w-full" aria-label="Mapa de ONGs" />;
}

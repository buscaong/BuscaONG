'use client'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import toast from "react-hot-toast";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FILTROS_VAZIOS, MAX_LISTA, type Filtros } from "@/lib/mapa/filtros";
import { CENTRO_PADRAO, formatarDistancia, type Bbox, type Ponto } from "@/lib/mapa/geo";
import { LocateFixed } from "lucide-react";
import { buscarLista, buscarPins } from "../_actions/api";
import { CampoBusca } from "./CampoBusca";
import { ChipsFiltros } from "./ChipsFiltros";
import { DivisoriaLista, useLarguraLista } from "./DivisoriaLista";
import { ListaOngs } from "./ListaOngs";
import { MapaOngs, type ControleMapa } from "./MapaOngs";
import { MenuParaOngs } from "./MenuParaOngs";
import { PainelFiltros } from "./PainelFiltros";
import type { OngNaLista, OpcoesFiltro, PinNoMapa, Referencia, ResultadoLista } from "./tipos";

// a lista começa com este tanto e cresce sozinha conforme a pessoa rola, de PAGINA em PAGINA
const LIMITE_LISTA = 30;
const PAGINA = 20;
const ESPERA_PINS_MS = 250;
const ZOOM_ONG = 15;
// painel da lista no celular: na metade da tela ou aberto (abaixo da busca)
const ALTURA_PAINEL = { meio: 0.46, topo: 128 };

type Props = { opcoes: OpcoesFiltro; raioKm: number };

/** Tela principal (P1 a P4): mapa por área visível + lista por distância, com busca e filtros. */
export function TelaMapa({ opcoes, raioKm }: Props) {
  const celular = useIsMobile();
  const controleMapa = useRef<ControleMapa | null>(null);

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [referencia, setReferencia] = useState<Referencia>({ ponto: CENTRO_PADRAO, origem: "padrao" });
  const [pessoa, setPessoa] = useState<Ponto | null>(null);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [lista, setLista] = useState<ResultadoLista | null>(null);
  const [erroLista, setErroLista] = useState(false);
  // quantas ONGs a lista pede, e para qual busca esse número vale
  const [limiteLista, setLimiteLista] = useState({ busca: "", quantas: LIMITE_LISTA });
  const [pins, setPins] = useState<PinNoMapa[] | null>(null); // null = ainda não carregou
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [painel, setPainel] = useState<"meio" | "aberto">("meio");
  const [alturaJanela, setAlturaJanela] = useState(800);
  const [larguraLista, setLarguraLista] = useLarguraLista();

  useEffect(() => {
    const medir = () => setAlturaJanela(window.innerHeight);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  // ---- localização ----
  const localizar = useCallback((avisarSeNegar: boolean) => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const ponto = { latitude: coords.latitude, longitude: coords.longitude };
        setPessoa(ponto);
        setReferencia({ ponto, origem: "pessoa" });
        controleMapa.current?.voarPara(ponto, 13);
      },
      () => {
        if (avisarSeNegar) toast("Permita a localização no navegador para ver as ONGs perto de você.");
      },
      { timeout: 10_000, maximumAge: 5 * 60_000 }
    );
  }, []);

  // ao abrir, pede a localização; se a pessoa negar, fica em São Paulo
  useEffect(() => localizar(false), [localizar]);

  // ---- lista (perto da referência) ----
  // O limite guarda a busca a que pertence: com filtros ou ponto novos ele não vale mais e a
  // lista volta ao tamanho inicial, sem carregar de uma vez o que a rolagem anterior esticou.
  const chaveDaBusca = `${referencia.ponto.latitude},${referencia.ponto.longitude}|${JSON.stringify(filtros)}`;
  const limiteAtual = limiteLista.busca === chaveDaBusca ? limiteLista.quantas : LIMITE_LISTA;

  // estável entre renders: a lista a usa dentro de um IntersectionObserver
  const carregarMais = useCallback(() => {
    setLimiteLista((atual) => {
      const quantas = atual.busca === chaveDaBusca ? atual.quantas : LIMITE_LISTA;
      return { busca: chaveDaBusca, quantas: Math.min(quantas + PAGINA, MAX_LISTA) };
    });
  }, [chaveDaBusca]);

  useEffect(() => {
    const controle = new AbortController();
    buscarLista(referencia.ponto, filtros, limiteAtual, controle.signal)
      .then((resultado) => {
        setLista(resultado);
        setErroLista(false);
      })
      .catch((erro) => {
        if (erro.name !== "AbortError") setErroLista(true);
      });
    return () => controle.abort();
  }, [referencia, filtros, limiteAtual]);

  // ---- pins (área visível do mapa) ----
  useEffect(() => {
    if (!bbox) return;
    const controle = new AbortController();
    const timer = setTimeout(() => {
      buscarPins(bbox, filtros, controle.signal)
        .then(setPins)
        .catch(() => {});
    }, ESPERA_PINS_MS);
    return () => {
      clearTimeout(timer);
      controle.abort();
    };
  }, [bbox, filtros]);

  // ---- ações ----
  function escolherOng(ong: Pick<OngNaLista, "id" | "latitude" | "longitude">) {
    setSelecionada(ong.id);
    controleMapa.current?.voarPara(ong, ZOOM_ONG);
    if (celular) setPainel("meio");
  }

  function selecionarPin(id: string) {
    setSelecionada(id);
    if (celular) setPainel("meio");
    // o card pode não estar na lista (a lista mostra só as mais próximas)
    requestAnimationFrame(() => document.getElementById(`ong-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  // arrastar ou tocar na alça do painel (celular)
  const inicioArraste = useRef<number | null>(null);
  function soltarAlca(e: PointerEvent) {
    if (inicioArraste.current === null) return;
    const deslocamento = e.clientY - inicioArraste.current;
    inicioArraste.current = null;
    if (Math.abs(deslocamento) < 8) setPainel(painel === "meio" ? "aberto" : "meio");
    else setPainel(deslocamento < 0 ? "aberto" : "meio");
  }

  const alturaPainel =
    painel === "meio" ? Math.round(alturaJanela * ALTURA_PAINEL.meio) : alturaJanela - ALTURA_PAINEL.topo;

  // P4: há resultados, mas nenhum na área visível do mapa
  const maisProxima = lista?.ongs[0];
  const foraDaArea = pins !== null && pins.length === 0 && !!lista && lista.total > 0;

  const topo = (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2">
        <CampoBusca
          perto={referencia.ponto}
          aoEscolherOng={(ong) => escolherOng(ong)}
          aoEscolherLugar={(lugar) => {
            setReferencia({ ponto: lugar.ponto, origem: "lugar", nome: lugar.nome });
            if (lugar.bbox) controleMapa.current?.enquadrar(lugar.bbox);
            else controleMapa.current?.voarPara(lugar.ponto, 14);
          }}
        />
        <MenuParaOngs />
      </div>
      <ChipsFiltros filtros={filtros} opcoes={opcoes} aoMudar={setFiltros} aoAbrirFiltros={() => setFiltrosAbertos(true)} />
    </div>
  );

  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-creme md:grid"
      style={celular ? undefined : { gridTemplateColumns: `${larguraLista}px 1fr` }}
    >
      {/* lista: painel deslizante no celular, coluna de largura ajustável no computador */}
      <aside
        style={celular ? { height: alturaPainel } : undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[24px] bg-creme shadow-[0_-8px_30px_rgba(31,43,36,.18)] transition-[height] duration-300",
          "md:static md:z-auto md:h-dvh md:rounded-none md:border-r md:border-borda-suave md:shadow-none"
        )}
        aria-label="Lista de ONGs"
      >
        <button
          type="button"
          aria-label={painel === "meio" ? "Abrir a lista" : "Diminuir a lista"}
          onPointerDown={(e) => (inicioArraste.current = e.clientY)}
          onPointerUp={soltarAlca}
          className="flex shrink-0 cursor-grab touch-none justify-center py-3 md:hidden"
        >
          <span className="h-[5px] w-10 rounded-full bg-borda" />
        </button>

        <div className="hidden px-5 pb-3 pt-5 md:block">{topo}</div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-6 md:px-5">
          <ListaOngs
            lista={lista}
            erro={erroLista}
            referencia={referencia}
            raioKm={raioKm}
            filtros={filtros}
            opcoes={opcoes}
            selecionada={selecionada}
            aoEscolher={escolherOng}
            aoMudarFiltros={setFiltros}
            aoChegarNoFim={carregarMais}
          />
        </div>
      </aside>

      {!celular && <DivisoriaLista largura={larguraLista} aoMudar={setLarguraLista} />}

      <div className="absolute inset-0 md:relative md:inset-auto md:h-dvh">
        <MapaOngs
          centroInicial={CENTRO_PADRAO}
          pins={pins ?? []}
          pessoa={pessoa}
          selecionada={selecionada}
          margemInferior={celular ? alturaPainel : 0}
          aoMover={setBbox}
          aoSelecionar={selecionarPin}
          controleRef={controleMapa}
        />

        {/* celular: busca e filtros por cima do mapa */}
        <div className="absolute inset-x-0 top-0 z-30 p-3.5 md:hidden">{topo}</div>

        <button
          type="button"
          onClick={() => localizar(true)}
          aria-label="Usar minha localização"
          className="absolute right-3.5 top-[132px] z-10 flex size-11 cursor-pointer items-center justify-center rounded-[14px] bg-papel text-musgo shadow-[0_4px_14px_rgba(31,43,36,.15)] hover:bg-salvia-clara md:right-4 md:top-4"
        >
          <LocateFixed className="size-5" />
        </button>

        {foraDaArea && maisProxima && (
          <div className="absolute inset-x-3.5 top-[188px] z-10 flex flex-col gap-2 rounded-[20px] bg-papel p-4 shadow-[0_8px_24px_rgba(31,43,36,.18)] md:left-4 md:right-auto md:top-4 md:max-w-[380px]">
            <span className="font-display text-base font-semibold">Nenhuma ONG nesta área do mapa</span>
            <span className="text-sm leading-normal text-tinta-suave">
              {lista!.total} {lista!.total === 1 ? "ONG com seus filtros está" : "ONGs com seus filtros estão"} fora da
              área visível. A mais próxima fica a {formatarDistancia(maisProxima.distanciaKm)}.
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (celular) setPainel("aberto");
                  document.getElementById(`ong-${maisProxima.id}`)?.scrollIntoView({ block: "nearest" });
                }}
                className="h-10 cursor-pointer rounded-[12px] bg-salvia-clara px-4 text-sm font-semibold text-musgo hover:bg-salvia"
              >
                Ver na lista
              </button>
              <button
                type="button"
                onClick={() => escolherOng(maisProxima)}
                className="h-10 cursor-pointer rounded-[12px] bg-musgo px-4 text-sm font-semibold text-papel hover:bg-musgo-escuro"
              >
                Ir para a mais próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {filtrosAbertos && (
        <PainelFiltros
          filtros={filtros}
          opcoes={opcoes}
          referencia={referencia.ponto}
          aoAplicar={(novos) => {
            setFiltros(novos);
            setFiltrosAbertos(false);
          }}
          aoFechar={() => setFiltrosAbertos(false)}
        />
      )}
    </div>
  );
}

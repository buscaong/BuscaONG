'use client'
import { useEffect, useRef } from "react";

import { MAX_LISTA, temFiltroDeItem, temFiltroDeVoluntariado, type Filtros } from "@/lib/mapa/filtros";
import { CartaoResultado } from "./CartaoResultado";
import { SemResultados } from "./SemResultados";
import type { OngNaLista, OpcoesFiltro, Referencia, ResultadoLista } from "./tipos";

type Props = {
  lista: ResultadoLista | null; // null = carregando a primeira vez
  erro: boolean;
  referencia: Referencia;
  raioKm: number;
  filtros: Filtros;
  opcoes: OpcoesFiltro;
  selecionada: string | null;
  aoEscolher: (ong: OngNaLista) => void;
  aoMudarFiltros: (filtros: Filtros) => void;
  /** chamado ao chegar perto do fim da lista; traz mais ONGs sem a pessoa pedir */
  aoChegarNoFim: () => void;
};

/** Lista (P1/P3): das mais próximas para as mais distantes, independente da área do mapa. */
export function ListaOngs({ lista, erro, referencia, raioKm, filtros, opcoes, selecionada, aoEscolher, aoMudarFiltros, aoChegarNoFim }: Props) {
  const comItem = temFiltroDeItem(filtros);
  const comHorario = temFiltroDeVoluntariado(filtros);

  // sentinela no fim da lista: ao aparecer na tela, pede o próximo pedaço.
  // No teto (MAX_LISTA) a lista para de crescer, mesmo com mais ONGs no raio.
  const fim = useRef<HTMLDivElement>(null);
  const faltamCarregar = !!lista && lista.total > lista.ongs.length && lista.ongs.length < MAX_LISTA;
  // quantas já estão na tela: muda a cada pedaço novo, refazendo o observador
  const carregadas = lista?.ongs.length ?? 0;

  useEffect(() => {
    const alvo = fim.current;
    if (!faltamCarregar || !alvo) return;
    const observador = new IntersectionObserver(
      ([entrada]) => entrada.isIntersecting && aoChegarNoFim(),
      // começa a carregar antes de a pessoa chegar no fim, para a rolagem não travar
      { rootMargin: "400px" }
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [faltamCarregar, carregadas, aoChegarNoFim]);

  if (erro && !lista) {
    return <p className="p-2 text-sm text-tinta-suave">Não foi possível carregar as ONGs agora. Tente de novo em instantes.</p>;
  }
  if (!lista) {
    return <p className="p-2 text-sm text-tinta-suave">Procurando ONGs por perto…</p>;
  }

  const de = `${referencia.ponto.latitude.toFixed(5)},${referencia.ponto.longitude.toFixed(5)}`;
  const cartao = (ong: OngNaLista) => (
    <li key={ong.id}>
      <CartaoResultado
        ong={ong}
        comFiltroDeItem={comItem}
        comFiltroDeHorario={comHorario}
        selecionada={selecionada === ong.id}
        de={de}
        aoEscolher={() => aoEscolher(ong)}
      />
    </li>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">ONGs perto de você</h2>
        {lista.total > 0 && <span className="shrink-0 text-[13px] font-medium text-tinta-suave">por distância</span>}
      </div>

      {lista.total === 0 ? (
        <SemResultados
          filtros={filtros}
          opcoes={opcoes}
          referencia={referencia.ponto}
          raioKm={raioKm}
          aoMudarFiltros={aoMudarFiltros}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">{lista.ongs.map(cartao)}</ul>
          {faltamCarregar && (
            <div ref={fim} className="py-3 text-center text-xs text-tinta-suave" aria-live="polite">
              Carregando mais ONGs…
            </div>
          )}
        </>
      )}
    </div>
  );
}

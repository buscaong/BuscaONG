'use client'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

// Divisória entre a lista e o mapa (só no computador): arrastar para os lados muda a largura
// da lista, e a escolha fica guardada no navegador para a próxima visita.

export const LARGURA_LISTA = { minima: 300, maxima: 720, padrao: 400 };
const CHAVE = "buscaong:largura-lista";
/** Quanto o teclado move a divisória por tecla (acessibilidade: o arraste não pode ser o único jeito). */
const PASSO_TECLADO = 24;

const limitar = (largura: number) => Math.min(LARGURA_LISTA.maxima, Math.max(LARGURA_LISTA.minima, Math.round(largura)));

// A largura guardada é um estado de fora do React (localStorage), então é lida por
// useSyncExternalStore: no servidor vale o padrão, e o cliente corrige na hidratação.
const ouvintes = new Set<() => void>();
const assinar = (avisar: () => void) => {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
};

// valor da visita atual; sem localStorage (janela anônima, cookies bloqueados) é o único
let emMemoria = LARGURA_LISTA.padrao;

function lerGuardada() {
  try {
    const guardada = Number(localStorage.getItem(CHAVE));
    if (guardada) emMemoria = limitar(guardada);
  } catch {
    // sem localStorage: vale o que estiver em memória
  }
  return emMemoria;
}

/** Largura da lista, lembrada entre visitas. */
export function useLarguraLista() {
  const largura = useSyncExternalStore(assinar, lerGuardada, () => LARGURA_LISTA.padrao);

  const guardar = useCallback((nova: number) => {
    emMemoria = limitar(nova);
    try {
      localStorage.setItem(CHAVE, String(emMemoria));
    } catch {
      // sem onde guardar: a largura vale só para esta visita
    }
    for (const avisar of ouvintes) avisar();
  }, []);

  return [largura, guardar] as const;
}

type Props = { largura: number; aoMudar: (largura: number) => void };

export function DivisoriaLista({ largura, aoMudar }: Props) {
  const arrastando = useRef(false);
  const [ativa, setAtiva] = useState(false);

  useEffect(() => {
    if (!ativa) return;

    const mover = (e: PointerEvent) => arrastando.current && aoMudar(e.clientX);
    const soltar = () => {
      arrastando.current = false;
      setAtiva(false);
    };

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    // enquanto arrasta, não deixa o navegador selecionar texto nem mostrar o cursor de texto
    const estilo = document.body.style.cssText;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      document.body.style.cssText = estilo;
    };
  }, [ativa, aoMudar]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Largura da lista"
      aria-valuenow={largura}
      aria-valuemin={LARGURA_LISTA.minima}
      aria-valuemax={LARGURA_LISTA.maxima}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        arrastando.current = true;
        setAtiva(true);
      }}
      onDoubleClick={() => aoMudar(LARGURA_LISTA.padrao)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") aoMudar(largura - PASSO_TECLADO);
        else if (e.key === "ArrowRight") aoMudar(largura + PASSO_TECLADO);
        else if (e.key === "Home") aoMudar(LARGURA_LISTA.padrao);
        else return;
        e.preventDefault();
      }}
      title="Arraste para mudar a largura (dois cliques volta ao padrão)"
      className="group absolute inset-y-0 z-30 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none md:block"
      style={{ left: largura }}
    >
      {/* a barra fina fica no meio da área de arraste, que é maior para ser fácil de pegar */}
      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-borda-suave transition-colors",
          "group-hover:bg-musgo group-focus-visible:bg-musgo",
          ativa && "bg-musgo"
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-borda transition-colors",
          "group-hover:bg-musgo group-focus-visible:bg-musgo",
          ativa && "bg-musgo"
        )}
      />
    </div>
  );
}

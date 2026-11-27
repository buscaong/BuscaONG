'use client'
import { cn } from "@/lib/utils";
import type { Filtros } from "@/lib/mapa/filtros";
import { SlidersHorizontal, X } from "lucide-react";
import { alternarFiltro, filtrosAtivos, semFiltro, type OpcoesFiltro } from "./tipos";

type Props = {
  filtros: Filtros;
  opcoes: OpcoesFiltro;
  aoMudar: (filtros: Filtros) => void;
  aoAbrirFiltros: () => void;
};

/** Fileira abaixo da busca (P1/P3): botão de filtros, filtros ativos (com ×) e atalhos de causa. */
export function ChipsFiltros({ filtros, opcoes, aoMudar, aoAbrirFiltros }: Props) {
  const ativos = filtrosAtivos(filtros, opcoes);
  // todas as causas que ainda não estão ativas; a fileira rola na horizontal
  const atalhos = opcoes.causas.filter((c) => !filtros.causas.includes(c.slug));

  const chip = "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[11px] px-3 text-sm";

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      <button
        type="button"
        onClick={aoAbrirFiltros}
        className={cn(chip, "bg-musgo font-semibold text-papel hover:bg-musgo-escuro")}
      >
        <SlidersHorizontal className="size-[15px]" aria-hidden="true" />
        Filtros
        {ativos.length > 0 && (
          <span className="rounded-lg bg-papel px-1.5 text-xs font-bold text-musgo">{ativos.length}</span>
        )}
      </button>

      {ativos.map((ativo) => (
        <button
          key={`${ativo.campo}:${ativo.valor}`}
          type="button"
          onClick={() => aoMudar(semFiltro(filtros, ativo))}
          aria-label={`Remover filtro ${ativo.rotulo}`}
          className={cn(chip, "bg-musgo-escuro font-semibold text-papel")}
        >
          {ativo.rotulo}
          <X className="size-4" aria-hidden="true" />
        </button>
      ))}

      {atalhos.map((causa) => (
        <button
          key={causa.slug}
          type="button"
          onClick={() => aoMudar(alternarFiltro(filtros, "causas", causa.slug))}
          className={cn(chip, "border border-borda bg-papel font-medium shadow-[0_2px_8px_rgba(31,43,36,.06)] hover:border-musgo")}
        >
          {causa.nome}
        </button>
      ))}
    </div>
  );
}

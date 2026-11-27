import { DIAS_FILTRO, TURNOS_FILTRO, type Filtros } from "@/lib/mapa/filtros";
import type { Ponto } from "@/lib/mapa/geo";

export type Opcao = { slug: string; nome: string };
export type ItemLivre = { chave: string; nome: string; ongs: number };

/** Listas que alimentam os filtros (carregadas no servidor). */
export type OpcoesFiltro = {
  causas: Opcao[];
  itens: Opcao[];
  atividades: Opcao[];
  livres: ItemLivre[];
  /** por causa, os itens que as ONGs dela pedem, do mais ao menos comum */
  itensPorCausa: Record<string, { itens: string[]; livres: ItemLivre[] }>;
};

/** De onde a lista mede as distâncias. */
export type Referencia = {
  ponto: Ponto;
  /** "pessoa": localização do navegador; "lugar": bairro ou cidade buscado; "padrao": São Paulo */
  origem: "pessoa" | "lugar" | "padrao";
  nome?: string;
};

// mesmos formatos que a API devolve (services/ongs/publico.ts)
export type OngNaLista = {
  id: string;
  /** endereço da página pública: /ong/<endereco> */
  endereco: string;
  nome: string;
  logoUrl: string | null;
  causa: string | null;
  local: string | null;
  latitude: number;
  longitude: number;
  aproximada: boolean;
  distanciaKm: number;
  itens: string[];
  itensQueBatem: string[];
  horarios: string[];
  horariosQueBatem: string[];
  /** itens com urgência ativa */
  urgentes: string[];
};
export type ResultadoLista = { total: number; ongs: OngNaLista[] };
export type PinNoMapa = { id: string; nome: string; latitude: number; longitude: number; urgente: boolean };

/** Um valor de filtro ativo, com o texto do chip ("Fraldas", "Sáb", "Manhã"). */
export type FiltroAtivo = { campo: keyof Filtros; valor: string; rotulo: string };

export function filtrosAtivos(filtros: Filtros, opcoes: OpcoesFiltro): FiltroAtivo[] {
  const nome = (lista: Opcao[], slug: string) => lista.find((o) => o.slug === slug)?.nome ?? slug;
  return [
    ...filtros.causas.map((v) => ({ campo: "causas" as const, valor: v, rotulo: nome(opcoes.causas, v) })),
    ...filtros.itens.map((v) => ({ campo: "itens" as const, valor: v, rotulo: nome(opcoes.itens, v) })),
    ...filtros.livres.map((v) => ({
      campo: "livres" as const,
      valor: v,
      rotulo: opcoes.livres.find((l) => l.chave === v)?.nome ?? v,
    })),
    ...filtros.dias.map((v) => ({
      campo: "dias" as const,
      valor: v,
      rotulo: DIAS_FILTRO.find((d) => d.valor === v)?.curto ?? v,
    })),
    ...filtros.turnos.map((v) => ({
      campo: "turnos" as const,
      valor: v,
      rotulo: TURNOS_FILTRO.find((t) => t.valor === v)?.nome ?? v,
    })),
    ...filtros.atividades.map((v) => ({ campo: "atividades" as const, valor: v, rotulo: nome(opcoes.atividades, v) })),
  ];
}

export function semFiltro(filtros: Filtros, { campo, valor }: Pick<FiltroAtivo, "campo" | "valor">): Filtros {
  return { ...filtros, [campo]: (filtros[campo] as string[]).filter((v) => v !== valor) };
}

export function alternarFiltro(filtros: Filtros, campo: keyof Filtros, valor: string): Filtros {
  const atual = filtros[campo] as string[];
  return { ...filtros, [campo]: atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor] };
}

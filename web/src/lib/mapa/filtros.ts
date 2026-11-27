// Filtros da área pública (P2): usados pela tela, pela URL das rotas e pelo servidor.

/**
 * Máximo de ONGs que a lista carrega (P1/P3). A lista cresce de pedaço em pedaço conforme a
 * pessoa rola e para aqui: o custo de cada consulta fica limitado, e quem precisa de mais que
 * isso acha pelos filtros ou pela busca, não rolando.
 */
export const MAX_LISTA = 120;

export const DIAS_FILTRO = [
  { valor: "DOMINGO", letra: "D", nome: "Domingo", curto: "Dom" },
  { valor: "SEGUNDA", letra: "S", nome: "Segunda", curto: "Seg" },
  { valor: "TERCA", letra: "T", nome: "Terça", curto: "Ter" },
  { valor: "QUARTA", letra: "Q", nome: "Quarta", curto: "Qua" },
  { valor: "QUINTA", letra: "Q", nome: "Quinta", curto: "Qui" },
  { valor: "SEXTA", letra: "S", nome: "Sexta", curto: "Sex" },
  { valor: "SABADO", letra: "S", nome: "Sábado", curto: "Sáb" },
] as const;
export type DiaFiltro = (typeof DIAS_FILTRO)[number]["valor"];

export const TURNOS_FILTRO = [
  { valor: "MANHA", nome: "Manhã" },
  { valor: "TARDE", nome: "Tarde" },
  { valor: "NOITE", nome: "Noite" },
] as const;
export type TurnoFiltro = (typeof TURNOS_FILTRO)[number]["valor"];

export type Filtros = {
  causas: string[]; // slugs
  itens: string[]; // slugs da lista fixa
  livres: string[]; // chaves de itens livres (minúsculas, sem acento)
  dias: DiaFiltro[];
  turnos: TurnoFiltro[];
  atividades: string[]; // slugs
};

export const FILTROS_VAZIOS: Filtros = { causas: [], itens: [], livres: [], dias: [], turnos: [], atividades: [] };

const CHAVES: Record<keyof Filtros, string> = {
  causas: "causa",
  itens: "item",
  livres: "livre",
  dias: "dia",
  turnos: "turno",
  atividades: "atividade",
};

/** Filtros → parâmetros repetidos na URL (?causa=animais&causa=idosos&item=fraldas). */
export function filtrosParaParams(filtros: Filtros, params = new URLSearchParams()): URLSearchParams {
  for (const [campo, chave] of Object.entries(CHAVES) as [keyof Filtros, string][]) {
    for (const valor of filtros[campo]) params.append(chave, valor);
  }
  return params;
}

/** Parâmetros da URL → valores crus de cada filtro (a validação fica no schema da rota). */
export function paramsParaFiltrosCrus(params: URLSearchParams): Record<keyof Filtros, string[]> {
  return Object.fromEntries(
    (Object.entries(CHAVES) as [keyof Filtros, string][]).map(([campo, chave]) => [campo, params.getAll(chave)])
  ) as Record<keyof Filtros, string[]>;
}

export function contarFiltros(filtros: Filtros): number {
  return Object.values(filtros).reduce((total, lista) => total + lista.length, 0);
}

export const temFiltroDeVoluntariado = (f: Filtros) => f.dias.length + f.turnos.length + f.atividades.length > 0;
export const temFiltroDeItem = (f: Filtros) => f.itens.length + f.livres.length > 0;

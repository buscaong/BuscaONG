import { z } from "zod";
import { DIAS_FILTRO, MAX_LISTA, TURNOS_FILTRO, type DiaFiltro, type TurnoFiltro } from "@/lib/mapa/filtros";
import { slugSchema } from "./base.schema";

// Área pública: GET /api/ongs (lista perto de um ponto), GET /api/ongs/mapa (pins) e
// GET /api/ongs/busca (nome). Os filtros chegam como parâmetros repetidos na URL.

const DIAS = DIAS_FILTRO.map((d) => d.valor) as [DiaFiltro, ...DiaFiltro[]];
const TURNOS = TURNOS_FILTRO.map((t) => t.valor) as [TurnoFiltro, ...TurnoFiltro[]];

const lista = <T extends z.ZodType>(item: T) => z.array(item).max(30, "Filtros demais");

export const filtrosSchema = z.object({
  causas: lista(slugSchema),
  itens: lista(slugSchema),
  livres: lista(z.string().trim().min(1).max(40)),
  dias: lista(z.enum(DIAS, { error: "Dia inválido" })),
  turnos: lista(z.enum(TURNOS, { error: "Turno inválido" })),
  atividades: lista(slugSchema),
});

const latitude = z.coerce.number({ error: "Latitude inválida" }).min(-90).max(90);
const longitude = z.coerce.number({ error: "Longitude inválida" }).min(-180).max(180);

/** GET /api/ongs: ponto de referência (pessoa ou lugar buscado) e quantas ONGs devolver. */
export const listaProximasSchema = z.object({
  lat: latitude,
  lng: longitude,
  // 0 = só a contagem. O teto segura o custo da consulta: a lista cresce de pedaço em pedaço
  // conforme a pessoa rola, e para de crescer aqui.
  limite: z.coerce.number().int().min(0).max(MAX_LISTA).default(30),
});

/** GET /api/ongs/mapa: área visível do mapa, "oeste,sul,leste,norte". */
export const bboxSchema = z
  .string({ error: "Informe a área do mapa (bbox)" })
  .transform((texto, ctx) => {
    const numeros = texto.split(",").map(Number);
    const [oeste, sul, leste, norte] = numeros;
    const valido =
      numeros.length === 4 &&
      numeros.every(Number.isFinite) &&
      oeste < leste &&
      sul < norte &&
      sul >= -90 &&
      norte <= 90 &&
      oeste >= -180 &&
      leste <= 180;
    if (!valido) {
      ctx.addIssue({ code: "custom", message: "bbox inválido: use oeste,sul,leste,norte" });
      return z.NEVER;
    }
    return [oeste, sul, leste, norte] as [number, number, number, number];
  });

/** GET /api/ongs/busca: nome (ou parte do nome) da ONG. */
export const buscaOngSchema = z.object({
  q: z.string().trim().min(2, "Digite pelo menos 2 letras").max(80),
});

export type FiltrosData = z.infer<typeof filtrosSchema>;

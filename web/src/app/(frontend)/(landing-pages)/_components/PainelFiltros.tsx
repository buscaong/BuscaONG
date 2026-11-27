'use client'
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { contarFiltros, DIAS_FILTRO, FILTROS_VAZIOS, TURNOS_FILTRO, type Filtros } from "@/lib/mapa/filtros";
import type { Ponto } from "@/lib/mapa/geo";
import { normalizarChave } from "@/utils/formatters/texto";
import { X } from "lucide-react";
import { contarOngs } from "../_actions/api";
import { alternarFiltro, type ItemLivre, type OpcoesFiltro } from "./tipos";

type Props = {
  filtros: Filtros;
  opcoes: OpcoesFiltro;
  referencia: Ponto;
  aoAplicar: (filtros: Filtros) => void;
  aoFechar: () => void;
};

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

function Chip({
  ativo,
  tracejado,
  aoClicar,
  children,
}: {
  ativo: boolean;
  tracejado?: boolean;
  aoClicar: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={cn(
        "cursor-pointer whitespace-nowrap rounded-[11px] px-3 py-2 text-sm",
        ativo
          ? "bg-musgo font-semibold text-papel"
          : cn("border bg-papel font-medium hover:border-musgo", tracejado ? "border-dashed border-tinta-suave" : "border-borda")
      )}
    >
      {ativo && "✓ "}
      {children}
    </button>
  );
}

const ESPERA_CONTAGEM_MS = 300;

/** Filtros (P2): causa, item para doar e voluntariado. Aplica só no botão, com a contagem ao vivo. */
export function PainelFiltros({ filtros, opcoes, referencia, aoAplicar, aoFechar }: Props) {
  const [rascunho, setRascunho] = useState(filtros);
  const [buscaItem, setBuscaItem] = useState("");
  const [contagem, setContagem] = useState<number | null>(null);

  // contagem ao vivo do botão "Mostrar N ONGs"
  useEffect(() => {
    const controle = new AbortController();
    const timer = setTimeout(() => {
      contarOngs(referencia, rascunho, controle.signal)
        .then(setContagem)
        .catch(() => {});
    }, ESPERA_CONTAGEM_MS);
    return () => {
      clearTimeout(timer);
      controle.abort();
    };
  }, [rascunho, referencia]);

  // Esc fecha
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aoFechar]);

  const alternar = (campo: keyof Filtros, valor: string) => setRascunho((atual) => alternarFiltro(atual, campo, valor));
  const ativo = (campo: keyof Filtros, valor: string) => (rascunho[campo] as string[]).includes(valor);

  const busca = normalizarChave(buscaItem);

  /**
   * Ordem da busca: quem começa com o que foi digitado vem primeiro ("a" → Alimentos antes de
   * Fraldas), depois quem contém no meio. Dentro de cada grupo, mantém a ordem recebida.
   */
  const porBusca = <T,>(lista: T[], chaveDe: (item: T) => string) => {
    if (!busca) return lista;
    const combinam = lista.filter((i) => chaveDe(i).includes(busca));
    return [...combinam.filter((i) => chaveDe(i).startsWith(busca)), ...combinam.filter((i) => !chaveDe(i).startsWith(busca))];
  };

  const comCausa = rascunho.causas.length > 0;

  /**
   * Itens da lista fixa: com uma causa escolhida, os que as ONGs dela pedem sobem para o topo e
   * os que nenhuma pede saem. Sem causa, a lista fica inteira, na ordem do admin.
   */
  const itensDaCausa = () => {
    if (!comCausa) return opcoes.itens;
    const posicao = new Map<string, number>();
    for (const causa of rascunho.causas) {
      (opcoes.itensPorCausa[causa]?.itens ?? []).forEach((slug, i) => {
        posicao.set(slug, Math.min(posicao.get(slug) ?? Infinity, i));
      });
    }
    // um item já marcado continua visível, mesmo que a causa nova não o use
    return opcoes.itens
      .filter((i) => posicao.has(i.slug) || ativo("itens", i.slug))
      .sort((a, b) => (posicao.get(a.slug) ?? Infinity) - (posicao.get(b.slug) ?? Infinity));
  };

  /**
   * Itens fora da lista: sem causa, os mais usados no site todo. Com causa, os mais pedidos por
   * ela — que podem não estar entre os populares do site (ração está em poucas ONGs no total,
   * mas é o que um abrigo de animais mais precisa), por isso vêm do servidor já com o nome.
   */
  const livresDaCausa = () => {
    if (!comCausa) return opcoes.livres;
    const porChave = new Map<string, { item: ItemLivre; posicao: number }>();
    for (const causa of rascunho.causas) {
      (opcoes.itensPorCausa[causa]?.livres ?? []).forEach((item, i) => {
        const antes = porChave.get(item.chave);
        if (!antes || i < antes.posicao) porChave.set(item.chave, { item, posicao: i });
      });
    }
    // os já marcados continuam visíveis, mesmo fora da causa nova
    for (const chave of rascunho.livres) {
      if (!porChave.has(chave)) {
        const item = opcoes.livres.find((l) => l.chave === chave);
        if (item) porChave.set(chave, { item, posicao: Infinity });
      }
    }
    return [...porChave.values()].sort((a, b) => a.posicao - b.posicao).map(({ item }) => item);
  };

  const itensVisiveis = porBusca(itensDaCausa(), (i) => normalizarChave(i.nome));
  const livresVisiveis = porBusca(livresDaCausa(), (i) => i.chave);

  return (
    <div className="fixed inset-0 z-50 flex md:justify-start" role="dialog" aria-modal="true" aria-labelledby="titulo-filtros">
      <button type="button" aria-label="Fechar filtros" onClick={aoFechar} className="absolute inset-0 hidden bg-tinta/40 md:block" />

      <div className="relative flex h-full w-full flex-col bg-creme md:max-w-[440px] md:shadow-[0_0_40px_rgba(31,43,36,.25)]">
        <header className="flex items-center justify-between gap-3 border-b border-borda-suave px-5 py-4">
          <button type="button" aria-label="Fechar" onClick={aoFechar} className="cursor-pointer text-tinta-suave hover:text-tinta">
            <X className="size-6" />
          </button>
          <h2 id="titulo-filtros" className="font-display text-xl font-semibold">
            Filtros
          </h2>
          <button
            type="button"
            onClick={() => setRascunho(FILTROS_VAZIOS)}
            disabled={contarFiltros(rascunho) === 0}
            className="cursor-pointer text-sm font-semibold text-musgo underline underline-offset-2 disabled:cursor-default disabled:text-tinta-suave disabled:no-underline"
          >
            Limpar tudo
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-7 overflow-y-auto px-5 py-6">
          <Secao titulo="Causa">
            <div className="flex flex-wrap gap-2">
              {opcoes.causas.map((c) => (
                <Chip key={c.slug} ativo={ativo("causas", c.slug)} aoClicar={() => alternar("causas", c.slug)}>
                  {c.nome}
                </Chip>
              ))}
            </div>
          </Secao>

          <Secao titulo="Tenho para doar">
            {rascunho.causas.length > 0 && (
              <span className="text-sm leading-normal text-tinta-suave">
                Mostrando o que as ONGs {rascunho.causas.length === 1 ? "dessa causa pedem" : "dessas causas pedem"}.
              </span>
            )}
            <input
              type="search"
              value={buscaItem}
              onChange={(e) => setBuscaItem(e.target.value)}
              placeholder="Buscar item"
              aria-label="Buscar item"
              className="h-11 rounded-[13px] border border-borda bg-papel px-[14px] text-[15px] outline-none focus:border-2 focus:border-musgo"
            />
            <div className="flex flex-wrap gap-2">
              {itensVisiveis.map((i) => (
                <Chip key={i.slug} ativo={ativo("itens", i.slug)} aoClicar={() => alternar("itens", i.slug)}>
                  {i.nome}
                </Chip>
              ))}
            </div>
            {livresVisiveis.length > 0 && (
              <>
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-tinta-suave">Cadastrados pelas ONGs</span>
                <div className="flex flex-wrap gap-2">
                  {livresVisiveis.map((i) => (
                    <Chip key={i.chave} tracejado ativo={ativo("livres", i.chave)} aoClicar={() => alternar("livres", i.chave)}>
                      {i.nome}
                    </Chip>
                  ))}
                </div>
              </>
            )}
            {itensVisiveis.length + livresVisiveis.length === 0 && (
              <span className="text-sm text-tinta-suave">
                {busca ? "Nenhum item com esse nome." : "As ONGs dessa causa ainda não cadastraram itens."}
              </span>
            )}
          </Secao>

          <Secao titulo="Quero ser voluntário">
            <div className="flex gap-2">
              {DIAS_FILTRO.map((d) => (
                <button
                  key={d.valor}
                  type="button"
                  aria-pressed={ativo("dias", d.valor)}
                  aria-label={d.nome}
                  title={d.nome}
                  onClick={() => alternar("dias", d.valor)}
                  className={cn(
                    "flex size-10 cursor-pointer items-center justify-center rounded-full text-sm font-semibold",
                    ativo("dias", d.valor) ? "bg-musgo text-papel" : "border border-borda bg-papel hover:border-musgo"
                  )}
                >
                  {d.letra}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {TURNOS_FILTRO.map((t) => (
                <Chip key={t.valor} ativo={ativo("turnos", t.valor)} aoClicar={() => alternar("turnos", t.valor)}>
                  {t.nome}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {opcoes.atividades.map((a) => (
                <Chip key={a.slug} ativo={ativo("atividades", a.slug)} aoClicar={() => alternar("atividades", a.slug)}>
                  {a.nome}
                </Chip>
              ))}
            </div>
          </Secao>
        </div>

        <footer className="border-t border-borda-suave px-5 py-4">
          <button
            type="button"
            onClick={() => aoAplicar(rascunho)}
            className="h-[52px] w-full cursor-pointer rounded-[15px] bg-musgo text-base font-semibold text-papel transition-colors hover:bg-musgo-escuro"
          >
            {contagem === null ? "Mostrar ONGs" : `Mostrar ${contagem} ${contagem === 1 ? "ONG" : "ONGs"}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

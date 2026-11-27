import { listarOpcoes } from "@/backend/services/listas";
import { itensDasCausas, itensLivresPopulares, RAIO_LISTA_KM } from "@/backend/services/ongs";
import { TelaMapa } from "./_components/TelaMapa";

// tela principal (P1): mapa e lista de ONGs; as listas dos filtros vêm do banco a cada visita
export const dynamic = "force-dynamic";

export default async function Home() {
  const [causas, itens, atividades, livres, itensPorCausa] = await Promise.all([
    listarOpcoes("CAUSA"),
    listarOpcoes("ITEM"),
    listarOpcoes("ATIVIDADE"),
    itensLivresPopulares(),
    itensDasCausas(),
  ]);

  return <TelaMapa opcoes={{ causas, itens, atividades, livres, itensPorCausa }} raioKm={RAIO_LISTA_KM} />;
}

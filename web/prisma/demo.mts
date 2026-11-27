// Popula o banco com ONGs de demonstração (Grande São Paulo), para ter o que mostrar
// no mapa, na lista e nos filtros. Rodar pela raiz: pnpm db:demo
//
// É seguro rodar de novo: as contas de demonstração usam e-mails @demo.buscaong.local
// e são recriadas do zero a cada execução (nenhuma ONG real é tocada).
// Para apagar só a demonstração: pnpm db:demo --limpar
import { PrismaClient, type Prisma, type DiaVoluntariado, type Turno } from "@prisma/client";

const prisma = new PrismaClient();

// As regras abaixo são as mesmas de src/lib (voluntariado, geo, slug e texto), repetidas aqui
// porque o Node não resolve o alias "@/" dos imports do Next fora do bundler — igual ao seed.mts.

/** Turnos que um horário cobre (src/lib/cadastro/voluntariado.ts). */
function calcularTurnos(inicio: number | null, fim: number | null): Turno[] {
  const faixas: { turno: Turno; inicio: number; fim: number }[] = [
    { turno: "MANHA", inicio: 0, fim: 12 },
    { turno: "TARDE", inicio: 12, fim: 18 },
    { turno: "NOITE", inicio: 18, fim: 24 },
  ];
  if (inicio == null || fim == null) return faixas.map((f) => f.turno);
  return faixas.filter((f) => inicio < f.fim && fim > f.inicio).map((f) => f.turno);
}

const RAIO_TERRA_KM = 6371;

/** Ponto deslocado de 150 a 400 m, para quem mostra só o bairro (src/lib/mapa/geo.ts). */
function posicaoAproximada({ latitude, longitude }: { latitude: number; longitude: number }, sortear: () => number) {
  const angulo = sortear() * 2 * Math.PI;
  const distancia = 0.15 + sortear() * 0.25;
  const dLat = (distancia / RAIO_TERRA_KM) * (180 / Math.PI);
  const dLng = dLat / Math.cos((latitude * Math.PI) / 180);
  return { latitude: latitude + dLat * Math.sin(angulo), longitude: longitude + dLng * Math.cos(angulo) };
}

/** "  Fraldas  G " → "fraldas g" (src/utils/formatters/texto.ts). */
const normalizarChave = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// src/lib/ong/slug.ts
const SLUGS_RESERVADOS = new Set(["cadastro", "painel", "entrar", "login", "admin", "nova", "minha"]);
const ehObjectId = (valor: string) => /^[a-f0-9]{24}$/.test(valor);

/** "Casa Lar Esperança!" → "casa-lar-esperanca" */
function slugDoNome(nome: string): string {
  return (
    normalizarChave(nome)
      .replace(/&/g, " e ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "ong"
  );
}

/** Marca das contas criadas aqui; é por ela que a limpeza encontra o que apagar. */
const DOMINIO_DEMO = "demo.buscaong.local";
const TOTAL = 100;

// ---- sorteio determinístico (mulberry32): rodar de novo dá o mesmo resultado ----
function gerador(semente: number) {
  return () => {
    semente = (semente + 0x6d2b79f5) | 0;
    let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const aleatorio = gerador(20261127);
const inteiro = (min: number, max: number) => min + Math.floor(aleatorio() * (max - min + 1));
const escolher = <T,>(lista: readonly T[]): T => lista[Math.floor(aleatorio() * lista.length)];
const chance = (p: number) => aleatorio() < p;
/** `n` itens distintos da lista, em ordem sorteada. */
function varios<T>(lista: readonly T[], n: number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, Math.min(n, copia.length));
}

// ---- bairros da Grande SP, com coordenadas reais ----
type Bairro = { bairro: string; municipio: string; uf: string; cep: string; lat: number; lng: number };

const BAIRROS: Bairro[] = [
  // capital — centro
  { bairro: "Sé", municipio: "São Paulo", uf: "SP", cep: "01001000", lat: -23.5505, lng: -46.6333 },
  { bairro: "República", municipio: "São Paulo", uf: "SP", cep: "01045001", lat: -23.5438, lng: -46.6417 },
  { bairro: "Bela Vista", municipio: "São Paulo", uf: "SP", cep: "01310000", lat: -23.5614, lng: -46.6559 },
  { bairro: "Consolação", municipio: "São Paulo", uf: "SP", cep: "01302000", lat: -23.5547, lng: -46.6614 },
  { bairro: "Liberdade", municipio: "São Paulo", uf: "SP", cep: "01503000", lat: -23.5587, lng: -46.635 },
  { bairro: "Bom Retiro", municipio: "São Paulo", uf: "SP", cep: "01122000", lat: -23.5255, lng: -46.6388 },
  { bairro: "Santa Cecília", municipio: "São Paulo", uf: "SP", cep: "01216000", lat: -23.538, lng: -46.651 },
  { bairro: "Campos Elíseos", municipio: "São Paulo", uf: "SP", cep: "01203000", lat: -23.533, lng: -46.6445 },
  // capital — zona oeste
  { bairro: "Pinheiros", municipio: "São Paulo", uf: "SP", cep: "05422000", lat: -23.5629, lng: -46.7006 },
  { bairro: "Butantã", municipio: "São Paulo", uf: "SP", cep: "05508000", lat: -23.5707, lng: -46.73 },
  { bairro: "Vila Madalena", municipio: "São Paulo", uf: "SP", cep: "05435000", lat: -23.5546, lng: -46.69 },
  { bairro: "Lapa", municipio: "São Paulo", uf: "SP", cep: "05077000", lat: -23.528, lng: -46.705 },
  { bairro: "Perdizes", municipio: "São Paulo", uf: "SP", cep: "05014000", lat: -23.537, lng: -46.676 },
  { bairro: "Rio Pequeno", municipio: "São Paulo", uf: "SP", cep: "05379000", lat: -23.572, lng: -46.748 },
  { bairro: "Raposo Tavares", municipio: "São Paulo", uf: "SP", cep: "05577000", lat: -23.588, lng: -46.768 },
  { bairro: "Jaguaré", municipio: "São Paulo", uf: "SP", cep: "05345000", lat: -23.545, lng: -46.752 },
  // capital — zona sul
  { bairro: "Vila Mariana", municipio: "São Paulo", uf: "SP", cep: "04101000", lat: -23.589, lng: -46.634 },
  { bairro: "Saúde", municipio: "São Paulo", uf: "SP", cep: "04141000", lat: -23.618, lng: -46.639 },
  { bairro: "Santo Amaro", municipio: "São Paulo", uf: "SP", cep: "04743000", lat: -23.652, lng: -46.705 },
  { bairro: "Campo Limpo", municipio: "São Paulo", uf: "SP", cep: "05777000", lat: -23.648, lng: -46.76 },
  { bairro: "Capão Redondo", municipio: "São Paulo", uf: "SP", cep: "05861000", lat: -23.669, lng: -46.779 },
  { bairro: "Grajaú", municipio: "São Paulo", uf: "SP", cep: "04850000", lat: -23.757, lng: -46.693 },
  { bairro: "Cidade Ademar", municipio: "São Paulo", uf: "SP", cep: "04410000", lat: -23.683, lng: -46.665 },
  { bairro: "Jabaquara", municipio: "São Paulo", uf: "SP", cep: "04321000", lat: -23.646, lng: -46.642 },
  { bairro: "Ipiranga", municipio: "São Paulo", uf: "SP", cep: "04263000", lat: -23.595, lng: -46.605 },
  { bairro: "Interlagos", municipio: "São Paulo", uf: "SP", cep: "04777000", lat: -23.701, lng: -46.698 },
  { bairro: "Parelheiros", municipio: "São Paulo", uf: "SP", cep: "04825000", lat: -23.822, lng: -46.732 },
  { bairro: "Jardim Ângela", municipio: "São Paulo", uf: "SP", cep: "04934000", lat: -23.695, lng: -46.743 },
  // capital — zona leste
  { bairro: "Mooca", municipio: "São Paulo", uf: "SP", cep: "03106000", lat: -23.555, lng: -46.598 },
  { bairro: "Tatuapé", municipio: "São Paulo", uf: "SP", cep: "03063000", lat: -23.54, lng: -46.576 },
  { bairro: "Penha", municipio: "São Paulo", uf: "SP", cep: "03632000", lat: -23.526, lng: -46.542 },
  { bairro: "Itaquera", municipio: "São Paulo", uf: "SP", cep: "08210000", lat: -23.54, lng: -46.46 },
  { bairro: "São Miguel Paulista", municipio: "São Paulo", uf: "SP", cep: "08010000", lat: -23.496, lng: -46.444 },
  { bairro: "Itaim Paulista", municipio: "São Paulo", uf: "SP", cep: "08110000", lat: -23.501, lng: -46.396 },
  { bairro: "Cidade Tiradentes", municipio: "São Paulo", uf: "SP", cep: "08471000", lat: -23.588, lng: -46.406 },
  { bairro: "Guaianases", municipio: "São Paulo", uf: "SP", cep: "08410000", lat: -23.541, lng: -46.412 },
  { bairro: "São Mateus", municipio: "São Paulo", uf: "SP", cep: "03970000", lat: -23.6, lng: -46.476 },
  { bairro: "Sapopemba", municipio: "São Paulo", uf: "SP", cep: "03977000", lat: -23.594, lng: -46.513 },
  { bairro: "Vila Prudente", municipio: "São Paulo", uf: "SP", cep: "03131000", lat: -23.583, lng: -46.581 },
  { bairro: "Ermelino Matarazzo", municipio: "São Paulo", uf: "SP", cep: "03805000", lat: -23.502, lng: -46.483 },
  // capital — zona norte
  { bairro: "Santana", municipio: "São Paulo", uf: "SP", cep: "02013000", lat: -23.502, lng: -46.625 },
  { bairro: "Casa Verde", municipio: "São Paulo", uf: "SP", cep: "02516000", lat: -23.507, lng: -46.661 },
  { bairro: "Freguesia do Ó", municipio: "São Paulo", uf: "SP", cep: "02925000", lat: -23.498, lng: -46.692 },
  { bairro: "Brasilândia", municipio: "São Paulo", uf: "SP", cep: "02845000", lat: -23.464, lng: -46.688 },
  { bairro: "Tucuruvi", municipio: "São Paulo", uf: "SP", cep: "02304000", lat: -23.476, lng: -46.603 },
  { bairro: "Jaçanã", municipio: "São Paulo", uf: "SP", cep: "02273000", lat: -23.459, lng: -46.583 },
  { bairro: "Pirituba", municipio: "São Paulo", uf: "SP", cep: "02945000", lat: -23.486, lng: -46.728 },
  { bairro: "Vila Maria", municipio: "São Paulo", uf: "SP", cep: "02114000", lat: -23.514, lng: -46.589 },
  // Grande SP
  { bairro: "Centro", municipio: "Guarulhos", uf: "SP", cep: "07011000", lat: -23.4538, lng: -46.5333 },
  { bairro: "Pimentas", municipio: "Guarulhos", uf: "SP", cep: "07252000", lat: -23.448, lng: -46.433 },
  { bairro: "Centro", municipio: "Osasco", uf: "SP", cep: "06010000", lat: -23.5329, lng: -46.792 },
  { bairro: "Jardim Piratininga", municipio: "Osasco", uf: "SP", cep: "06230000", lat: -23.519, lng: -46.77 },
  { bairro: "Centro", municipio: "Santo André", uf: "SP", cep: "09010000", lat: -23.6639, lng: -46.5383 },
  { bairro: "Centro", municipio: "São Bernardo do Campo", uf: "SP", cep: "09710000", lat: -23.6939, lng: -46.565 },
  { bairro: "Centro", municipio: "Diadema", uf: "SP", cep: "09910000", lat: -23.6861, lng: -46.6228 },
  { bairro: "Centro", municipio: "São Caetano do Sul", uf: "SP", cep: "09510000", lat: -23.623, lng: -46.554 },
  { bairro: "Centro", municipio: "Mauá", uf: "SP", cep: "09310000", lat: -23.6677, lng: -46.4614 },
  { bairro: "Centro", municipio: "Barueri", uf: "SP", cep: "06401000", lat: -23.5107, lng: -46.8761 },
  { bairro: "Centro", municipio: "Taboão da Serra", uf: "SP", cep: "06754000", lat: -23.626, lng: -46.792 },
  { bairro: "Centro", municipio: "Embu das Artes", uf: "SP", cep: "06803000", lat: -23.649, lng: -46.852 },
  { bairro: "Centro", municipio: "Carapicuíba", uf: "SP", cep: "06320000", lat: -23.5225, lng: -46.8356 },
  { bairro: "Centro", municipio: "Itapecerica da Serra", uf: "SP", cep: "06850000", lat: -23.717, lng: -46.849 },
  { bairro: "Centro", municipio: "Cotia", uf: "SP", cep: "06700000", lat: -23.6035, lng: -46.919 },
  { bairro: "Centro", municipio: "Suzano", uf: "SP", cep: "08674000", lat: -23.5425, lng: -46.311 },
  { bairro: "Centro", municipio: "Ferraz de Vasconcelos", uf: "SP", cep: "08500000", lat: -23.541, lng: -46.369 },
  { bairro: "Centro", municipio: "Itaquaquecetuba", uf: "SP", cep: "08570000", lat: -23.486, lng: -46.348 },
  { bairro: "Centro", municipio: "Ribeirão Pires", uf: "SP", cep: "09400000", lat: -23.711, lng: -46.413 },
  { bairro: "Centro", municipio: "Santana de Parnaíba", uf: "SP", cep: "06501000", lat: -23.444, lng: -46.918 },
];

const LOGRADOUROS = [
  "Rua das Acácias",
  "Avenida Brasil",
  "Rua São João",
  "Rua das Flores",
  "Avenida Paulista",
  "Rua Sete de Setembro",
  "Rua da Paz",
  "Avenida dos Trabalhadores",
  "Rua Projetada",
  "Rua Dom Pedro II",
  "Rua Santa Luzia",
  "Avenida das Nações",
  "Rua do Comércio",
  "Rua Marechal Deodoro",
  "Rua José Bonifácio",
  "Avenida Interlagos",
  "Rua Tiradentes",
  "Rua Boa Esperança",
  "Avenida Santo Antônio",
  "Rua Padre Anchieta",
];

// ---- causas, itens e atividades (slugs de prisma/seed.mts) ----
type Causa =
  | "orfanatos"
  | "situacao-de-rua"
  | "animais"
  | "idosos"
  | "pessoas-com-deficiencia"
  | "saude"
  | "educacao"
  | "mulheres"
  | "meio-ambiente";

/** Vocabulário por causa: o que o nome, a descrição e os itens da ONG puxam. */
const PERFIS: Record<
  Causa,
  {
    nomes: string[];
    complementos: string[];
    itens: string[];
    livres: string[];
    atividades: string[];
    frases: string[];
    sobre: string[];
  }
> = {
  orfanatos: {
    nomes: ["Casa Lar", "Lar da Criança", "Abrigo", "Casa de Acolhida", "Lar Infantil", "Aconchego", "Recanto Infantil"],
    complementos: ["Esperança", "Nossa Senhora", "São Francisco", "Bom Pastor", "Luz do Amanhã", "Semear", "Acolher", "Girassol"],
    itens: ["fraldas", "leite-em-po", "roupas-infantis", "brinquedos", "material-escolar", "higiene", "alimentos"],
    livres: ["Mamadeiras", "Carrinho de bebê", "Berço", "Lençóis de solteiro", "Mochilas"],
    atividades: ["recreacao", "reforco-escolar", "cozinha", "eventos-e-campanhas"],
    frases: [
      "Acolhemos crianças e adolescentes afastados do convívio familiar.",
      "Casa de acolhimento para crianças de 0 a 12 anos, por determinação judicial.",
      "Cuidamos de crianças em medida protetiva até a reintegração familiar.",
    ],
    sobre: [
      "Somos um serviço de acolhimento institucional conveniado com a prefeitura. A casa recebe crianças e adolescentes encaminhados pela Vara da Infância e oferece moradia, alimentação, acompanhamento escolar e apoio psicológico enquanto a situação familiar é avaliada. O trabalho é feito por uma equipe de educadores, assistente social e psicóloga, com apoio de voluntários no reforço escolar e nas atividades de fim de semana.",
      "A casa funciona há mais de vinte anos no bairro e atende em média vinte crianças por vez, com quartos divididos por faixa etária. Além do abrigo, mantemos acompanhamento das famílias de origem, porque a maior parte das crianças retorna para casa. As doações de fraldas, leite e material escolar são o que sustenta o dia a dia.",
    ],
  },
  "situacao-de-rua": {
    nomes: ["Casa de Passagem", "Centro de Acolhida", "Projeto", "Movimento", "Associação", "Casa", "Núcleo"],
    complementos: ["Renascer", "Nova Vida", "Caminho", "Porto Seguro", "Boa Noite", "Dignidade", "Travessia", "Reviver"],
    itens: ["cobertores", "alimentos", "higiene", "remedios"],
    livres: ["Roupas adultas", "Calçados", "Marmitas", "Kits de higiene", "Agasalhos", "Guarda-chuva"],
    atividades: ["cozinha", "doacao-de-sangue-triagem", "apoio-administrativo", "eventos-e-campanhas"],
    frases: [
      "Distribuímos refeições e cobertores para pessoas em situação de rua.",
      "Casa de passagem com banho, refeição e encaminhamento para documentos.",
      "Atendemos pessoas em situação de rua com acolhida noturna e apoio social.",
    ],
    sobre: [
      "O projeto nasceu de um grupo de moradores do bairro que passou a distribuir sopa duas vezes por semana. Hoje mantemos uma casa de passagem com vinte vagas, banho, lavanderia e café da manhã, além do trabalho de rua que continua toda quarta e sexta à noite. Encaminhamos as pessoas para emissão de documentos, CadÚnico e vagas de abrigo da prefeitura.",
      "Trabalhamos na lógica do vínculo: antes de propor qualquer encaminhamento, a equipe passa meses construindo confiança na rua. Mantemos oficinas de geração de renda e um espaço de convivência que funciona de segunda a sexta. Cobertores e kits de higiene são o que mais falta no inverno.",
    ],
  },
  animais: {
    nomes: ["Abrigo Animal", "Projeto", "ONG", "Associação Protetora", "Lar dos Animais", "Instituto", "Grupo"],
    complementos: ["Patas Felizes", "Focinho Amigo", "SOS Animais", "Au Miau", "Vira-Lata", "Quatro Patas", "Amigo Fiel", "Resgate"],
    itens: ["alimentos", "remedios", "cobertores"],
    livres: ["Ração para cães", "Ração para gatos", "Areia higiênica", "Caixa de transporte", "Coleiras", "Tapete higiênico", "Antipulgas"],
    atividades: ["cuidado-com-animais", "limpeza-e-manutencao", "eventos-e-campanhas", "apoio-administrativo"],
    frases: [
      "Resgatamos e cuidamos de cães e gatos abandonados até a adoção.",
      "Abrigo com mais de cem animais resgatados esperando um lar.",
      "Castração, tratamento e adoção responsável de animais de rua.",
    ],
    sobre: [
      "Somos um abrigo mantido por voluntários, sem nenhum repasse público. Cuidamos de cães e gatos resgatados de maus-tratos e abandono, com atendimento veterinário, castração e vermifugação antes da adoção. Fazemos feiras de adoção um sábado por mês e acompanhamos cada adotante por seis meses.",
      "O trabalho começou com o resgate de uma ninhada na porta de casa e hoje envolve mais de cem animais sob cuidado, entre o abrigo e os lares temporários. A maior parte do custo é ração e veterinário. Quem quiser ajudar sem adotar pode ser lar temporário, apadrinhar um animal ou doar ração.",
    ],
  },
  idosos: {
    nomes: ["Lar dos Idosos", "Casa de Repouso", "Recanto", "Vila", "Instituição", "Residencial", "Centro de Convivência"],
    complementos: ["São Vicente", "Bom Jesus", "Paz e Bem", "Vovô Feliz", "Horizonte", "Sol Poente", "Monte Alegre", "Serenidade"],
    itens: ["fraldas", "remedios", "alimentos", "higiene", "cobertores"],
    livres: ["Fraldas geriátricas", "Cadeira de rodas", "Andador", "Suplemento alimentar", "Colchão"],
    atividades: ["recreacao", "cozinha", "apoio-administrativo", "limpeza-e-manutencao"],
    frases: [
      "Instituição de longa permanência para idosos sem suporte familiar.",
      "Cuidamos de 40 idosos com moradia, alimentação e atenção à saúde.",
      "Centro de convivência e residência para pessoas idosas.",
    ],
    sobre: [
      "Somos uma instituição de longa permanência filantrópica, com alvará da Vigilância Sanitária e equipe de enfermagem 24 horas. A maior parte dos residentes chegou por encaminhamento do CREAS, sem família que pudesse cuidar. Oferecemos moradia, cinco refeições por dia, fisioterapia e atividades de convivência.",
      "A casa existe desde os anos 1970 e atende hoje quarenta pessoas acima de 60 anos. Além da moradia, mantemos um centro-dia aberto a idosos da vizinhança, com oficinas, ginástica e almoço. Fraldas geriátricas e medicamentos de uso contínuo são a maior despesa mensal.",
    ],
  },
  "pessoas-com-deficiencia": {
    nomes: ["Instituto", "Associação", "Centro de Apoio", "Casa", "Espaço", "Núcleo de Inclusão", "Centro de Reabilitação"],
    complementos: ["Incluir", "Caminhar", "Vida Plena", "Superar", "Mais Acesso", "Juntos", "Equilíbrio", "Avante"],
    itens: ["fraldas", "remedios", "material-escolar", "higiene", "alimentos"],
    livres: ["Cadeira de rodas", "Muletas", "Órteses", "Material de fisioterapia", "Tablet", "Fones de ouvido"],
    atividades: ["recreacao", "reforco-escolar", "apoio-administrativo", "eventos-e-campanhas"],
    frases: [
      "Atendimento especializado a crianças e adultos com deficiência.",
      "Terapias, inclusão escolar e apoio às famílias.",
      "Centro de reabilitação e convivência para pessoas com deficiência.",
    ],
    sobre: [
      "Atendemos crianças, jovens e adultos com deficiência intelectual e múltipla, com fisioterapia, fonoaudiologia, terapia ocupacional e acompanhamento pedagógico. O serviço é gratuito e a fila de espera é grande. Também orientamos famílias sobre direitos, BPC e matrícula na rede regular de ensino.",
      "Nosso trabalho tem duas frentes: a reabilitação, feita por uma equipe multiprofissional, e a inclusão, que envolve formar professores da rede pública e acompanhar os alunos na escola. Mantemos ainda oficinas de geração de renda para jovens a partir dos 16 anos.",
    ],
  },
  saude: {
    nomes: ["Instituto", "Casa de Apoio", "Associação", "Grupo de Apoio", "Rede", "Centro", "Projeto"],
    complementos: ["Vida", "Esperança", "Bem Viver", "Coração Valente", "Cuidar", "Amparo", "Renascer", "Elo"],
    itens: ["remedios", "alimentos", "higiene", "cobertores", "fraldas"],
    livres: ["Lenços de cabeça", "Suplemento alimentar", "Material de curativo", "Cadeira de banho", "Termômetro"],
    atividades: ["doacao-de-sangue-triagem", "apoio-administrativo", "cozinha", "eventos-e-campanhas"],
    frases: [
      "Casa de apoio a pacientes em tratamento fora do domicílio.",
      "Apoiamos pacientes oncológicos e suas famílias durante o tratamento.",
      "Grupo de apoio e transporte para pacientes em tratamento contínuo.",
    ],
    sobre: [
      "Hospedamos gratuitamente pacientes que vêm de outras cidades para tratamento nos hospitais da região, junto com um acompanhante. Além da hospedagem, oferecemos as refeições, transporte até o hospital e apoio psicológico. A casa tem trinta leitos e funciona o ano inteiro.",
      "O grupo começou como uma roda de conversa entre pacientes e familiares e hoje mantém casa de apoio, distribuição de suplementos e um serviço de transporte para sessões de quimioterapia e hemodiálise. Remédios de uso contínuo e suplementos alimentares são a necessidade mais constante.",
    ],
  },
  educacao: {
    nomes: ["Centro Educacional", "Projeto", "Instituto", "Casa de Cultura", "Espaço", "Núcleo", "Associação"],
    complementos: ["Saber", "Futuro", "Aprender", "Semente", "Caminho do Saber", "Horizonte", "Primeira Letra", "Crescer"],
    itens: ["material-escolar", "alimentos", "brinquedos", "higiene", "roupas-infantis"],
    livres: ["Livros infantis", "Computadores", "Mochilas", "Uniformes", "Instrumentos musicais", "Cadernos"],
    atividades: ["reforco-escolar", "recreacao", "apoio-administrativo", "eventos-e-campanhas"],
    frases: [
      "Reforço escolar e atividades no contraturno para crianças do bairro.",
      "Oficinas de leitura, música e informática para crianças e jovens.",
      "Projeto socioeducativo para estudantes da rede pública.",
    ],
    sobre: [
      "Atendemos crianças e adolescentes da rede pública no contraturno escolar, com reforço de português e matemática, oficinas de arte e esporte e uma refeição por dia. A frequência na escola é acompanhada junto com as famílias, e esse acompanhamento é parte central do trabalho.",
      "O projeto funciona num salão cedido pela paróquia e atende cento e vinte crianças em dois turnos. Além do reforço escolar, mantemos biblioteca comunitária, aulas de música e um curso de informática para jovens a partir de 14 anos. Material escolar e livros são sempre bem-vindos.",
    ],
  },
  mulheres: {
    nomes: ["Casa da Mulher", "Coletivo", "Instituto", "Associação", "Rede de Apoio", "Centro de Referência", "Projeto"],
    complementos: ["Maria", "Florescer", "Guerreiras", "Marias", "Lírio", "Vem Mulher", "Autonomia", "Raízes"],
    itens: ["higiene", "alimentos", "roupas-infantis", "fraldas", "cobertores"],
    livres: ["Absorventes", "Roupas femininas", "Kits de maternidade", "Material de costura", "Cestas básicas"],
    atividades: ["apoio-administrativo", "reforco-escolar", "eventos-e-campanhas", "cozinha"],
    frases: [
      "Acolhimento e apoio jurídico a mulheres em situação de violência.",
      "Geração de renda e autonomia para mulheres do bairro.",
      "Casa de referência com atendimento psicológico e social para mulheres.",
    ],
    sobre: [
      "Atendemos mulheres em situação de violência doméstica com escuta, orientação jurídica e encaminhamento para a rede de proteção. O atendimento é sigiloso e gratuito. Também mantemos grupos de apoio semanais e oficinas de geração de renda, porque autonomia financeira é parte de sair da violência.",
      "A casa oferece atendimento psicossocial, assessoria jurídica e cursos profissionalizantes de costura, confeitaria e informática. Boa parte das mulheres chega por indicação de outra que já passou por aqui. Absorventes, itens de higiene e cestas básicas sustentam o apoio emergencial às famílias.",
    ],
  },
  "meio-ambiente": {
    nomes: ["Instituto", "Coletivo", "Movimento", "Associação", "Projeto", "Rede", "Núcleo Ambiental"],
    complementos: ["Verde", "Raiz", "Mata Viva", "Nascente", "Replantar", "Terra Boa", "Semente Nativa", "Araucária"],
    itens: ["alimentos", "material-escolar"],
    livres: ["Mudas de árvore", "Ferramentas de jardinagem", "Composteira", "Sementes", "Luvas de trabalho", "Carrinho de mão"],
    atividades: ["limpeza-e-manutencao", "eventos-e-campanhas", "reforco-escolar", "apoio-administrativo"],
    frases: [
      "Plantio de mudas e educação ambiental em escolas do bairro.",
      "Hortas comunitárias e compostagem com moradores da região.",
      "Recuperação de nascentes e mutirões de limpeza no córrego.",
    ],
    sobre: [
      "Trabalhamos com recuperação de áreas degradadas, plantio de mudas nativas e educação ambiental nas escolas da região. Os mutirões acontecem aos sábados e são abertos a qualquer pessoa. Mantemos um viveiro comunitário que produz mudas distribuídas gratuitamente.",
      "O coletivo cuida de duas hortas comunitárias e de um projeto de compostagem que recebe resíduos de feiras e restaurantes do bairro. Além da produção de alimentos, o espaço funciona como sala de aula ao ar livre para escolas públicas. Ferramentas e mudas são as doações mais úteis.",
    ],
  },
};

const CAUSAS = Object.keys(PERFIS) as Causa[];

/** Causas que combinam, para ONGs com mais de uma (o cadastro permite até 3). */
// "animais" não entra como secundária de ninguém: uma ONG ambiental que a marcasse levaria
// composteira e material escolar para o filtro de Animais, onde quem doa espera ração.
const COMBINAM: Record<Causa, Causa[]> = {
  orfanatos: ["educacao", "saude", "mulheres"],
  "situacao-de-rua": ["saude", "idosos", "mulheres"],
  animais: [],
  idosos: ["saude", "situacao-de-rua"],
  "pessoas-com-deficiencia": ["saude", "educacao"],
  saude: ["idosos", "pessoas-com-deficiencia", "situacao-de-rua"],
  educacao: ["orfanatos", "mulheres"],
  mulheres: ["educacao", "saude", "situacao-de-rua"],
  "meio-ambiente": ["educacao"],
};

const DIAS: DiaVoluntariado[] = [
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
  "DOMINGO",
  "DIAS_UTEIS",
  "FIM_DE_SEMANA",
  "TODO_DIA",
];
const FAIXAS: [number, number][] = [
  [8, 12],
  [9, 13],
  [13, 17],
  [14, 18],
  [8, 17],
  [18, 21],
  [19, 22],
  [10, 16],
];

const DETALHES_URGENCIA: Record<string, string[]> = {
  fraldas: ["Tamanhos G e XG acabaram", "Estoque zerado desde a semana passada"],
  "leite-em-po": ["Precisamos para os bebês de até 1 ano", "Fórmula infantil acabando"],
  alimentos: ["Cestas básicas para 30 famílias", "Estoque da despensa no fim"],
  cobertores: ["Frente fria chegando no fim de semana", "Faltam para a distribuição noturna"],
  remedios: ["Analgésicos e antitérmicos", "Medicação de uso contínuo em falta"],
  higiene: ["Sabonete e pasta de dente acabaram", "Kits para a ação de sábado"],
  "material-escolar": ["Volta às aulas na semana que vem", "Cadernos para 60 crianças"],
  "roupas-infantis": ["Faltam tamanhos de 2 a 6 anos", "Agasalhos infantis para o inverno"],
  brinquedos: ["Para a festa das crianças", "Jogos e livros para a sala de leitura"],
  moveis: ["Precisamos de armários para os quartos", "Faltam mesas para a sala de aula"],
};

// ---- geração ----

/** CNPJ com dígitos verificadores corretos (os dados vêm da Receita no cadastro real). */
function comDigitos(base: string): string {
  const calc = (nums: number[], pesos: number[]) => {
    const soma = nums.reduce((s, n, i) => s + n * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const nums = base.split("").map(Number);
  const d1 = calc(nums, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc([...nums, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${d2}`;
}

/** Endereço público do perfil, único entre as ONGs (mesma regra de lib/ong/slug.ts). */
function slugUnico(nome: string, usados: Set<string>): string {
  const base = slugDoNome(nome);
  for (let n = 1; ; n++) {
    const candidato = n === 1 ? base : `${base}-${n}`;
    if (SLUGS_RESERVADOS.has(candidato) || ehObjectId(candidato) || usados.has(candidato)) continue;
    usados.add(candidato);
    return candidato;
  }
}

const RAZOES = ["ASSOCIACAO", "INSTITUTO", "SOCIEDADE BENEFICENTE", "ORGANIZACAO SOCIAL", "FUNDACAO"];
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

function gerarOng(indice: number, usados: Set<string>) {
  const causaPrincipal = CAUSAS[indice % CAUSAS.length];
  const perfil = PERFIS[causaPrincipal];
  const local = escolher(BAIRROS);

  const nomePublico = `${escolher(perfil.nomes)} ${escolher(perfil.complementos)}`;
  const slug = slugUnico(nomePublico, usados);

  // causas: a principal + 0 a 2 que combinam
  const extras = chance(0.55) ? varios(COMBINAM[causaPrincipal], chance(0.25) ? 2 : 1) : [];
  const causas = [...new Set([causaPrincipal, ...extras])].slice(0, 3);

  // itens da lista fixa (puxados das causas) e itens fora da lista
  // Os itens saem só da causa principal. Juntar os das secundárias faria um abrigo de animais
  // que também marcou "educação" pedir material escolar, e no filtro por causa isso aparece
  // como ruído: quem escolhe "Animais" quer ver ração, não caderno.
  const daPrincipal = <T,>(escolha: (c: Causa) => T[]) => [...new Set(escolha(causaPrincipal))];

  const itensPossiveis = daPrincipal((c) => PERFIS[c].itens);
  const itens = varios(itensPossiveis, inteiro(2, Math.min(5, itensPossiveis.length)));
  // Nas causas com poucos itens na lista fixa, o que a ONG precisa está quase todo fora dela
  // (um abrigo de animais pede ração e areia, que não são opções do cadastro): aí quase toda
  // ONG cadastra itens livres, e mais deles.
  const livresPossiveis = daPrincipal((c) => PERFIS[c].livres);
  const dependeDeLivres = PERFIS[causaPrincipal].itens.length <= 3;
  const quantosLivres = dependeDeLivres ? inteiro(2, 4) : inteiro(1, 3);
  const itensLivres = (chance(dependeDeLivres ? 0.95 : 0.6) ? varios(livresPossiveis, quantosLivres) : []).map((nome) => ({
    nome,
    chave: normalizarChave(nome),
  }));

  // posição: o ponto do bairro com um desvio de até ~1,2 km, para os pins não empilharem
  const latitude = local.lat + (aleatorio() - 0.5) * 0.022;
  const longitude = local.lng + (aleatorio() - 0.5) * 0.022;
  const mostrarSoBairro = chance(0.18);
  const publica = mostrarSoBairro ? posicaoAproximada({ latitude, longitude }, aleatorio) : { latitude, longitude };

  // voluntariado
  const aceitaVoluntarios = chance(0.68);
  // as atividades podem vir de todas as causas: uma ONG de animais que também faz educação
  // ambiental realmente oferece as duas coisas a quem se voluntaria
  const atividades = [...new Set(causas.flatMap((c) => PERFIS[c].atividades))];
  const horariosVoluntariado = aceitaVoluntarios
    ? varios(DIAS, inteiro(1, 3)).map((dia) => {
        const livre = chance(0.15);
        const [inicio, fim] = livre ? [null, null] : escolher(FAIXAS);
        const usarOutra = chance(0.12);
        return {
          dia,
          inicio,
          fim,
          atividade: usarOutra ? "outra" : escolher(atividades),
          atividadeOutra: usarOutra
            ? escolher(["Apoio na horta", "Transporte", "Oficina de música", "Costura", "Aula de informática"])
            : null,
          turnos: calcularTurnos(inicio, fim),
        };
      })
    : [];

  // urgências: só em parte das ONGs; 1 ou 2 itens, com prazo ainda em aberto
  const urgencias: { item: string; nome: string; detalhe: string | null; criadaEm: Date; ate: Date }[] = [];
  if (chance(0.22) && itens.length) {
    const agora = Date.now();
    for (const item of varios(itens, chance(0.3) ? 2 : 1)) {
      const detalhes = DETALHES_URGENCIA[item];
      urgencias.push({
        item,
        nome: item, // trocado pelo nome da lista fixa na hora de gravar
        detalhe: detalhes && chance(0.75) ? escolher(detalhes) : null,
        criadaEm: new Date(agora - inteiro(1, 72) * 3_600_000),
        ate: new Date(agora + inteiro(2, 12) * 86_400_000),
      });
    }
  }

  const razaoSocial = semAcento(`${escolher(RAZOES)} ${nomePublico}`).toUpperCase();
  const publicadaEm = new Date(Date.now() - inteiro(5, 420) * 86_400_000);

  return {
    cnpj: comDigitos(String(10_000_000_000_00 + indice * 7_919).slice(0, 12)),
    razaoSocial,
    naturezaJuridica: escolher(["3999", "3069", "3220", "3301"]),
    situacaoCadastral: "ATIVA",
    receitaConsultadaEm: publicadaEm,
    status: "PUBLICADA" as const,
    passoAtual: 8,
    endereco: {
      logradouro: escolher(LOGRADOUROS),
      numero: String(inteiro(10, 2480)),
      complemento: chance(0.2) ? escolher(["Fundos", "Casa 2", "Galpão", "Sala 3"]) : null,
      bairro: local.bairro,
      municipio: local.municipio,
      uf: local.uf,
      cep: local.cep,
    },
    localizacao: { type: "Point", coordinates: [longitude, latitude] },
    localizacaoPublica: { type: "Point", coordinates: [publica.longitude, publica.latitude] },
    mostrarSoBairro,
    contatos: {
      whatsapp: { valor: `+5511${inteiro(90000, 99999)}${inteiro(1000, 9999)}`, visivel: true },
      email: { valor: `contato@${slug.slice(0, 24)}.org.br`, visivel: chance(0.85) },
      site: chance(0.35) ? { valor: `https://www.${slug.slice(0, 24)}.org.br`, visivel: true } : null,
      instagram: chance(0.6) ? { valor: `@${slug.replace(/-/g, "").slice(0, 24)}`, visivel: true } : null,
    },
    causas,
    itens,
    itensLivres,
    aceitaVoluntarios,
    horariosVoluntariado,
    requisitosVoluntariado:
      aceitaVoluntarios && chance(0.5)
        ? escolher([
            "Maior de 18 anos. Pedimos um compromisso de pelo menos três meses.",
            "Não é preciso experiência: a formação é feita aqui, no primeiro sábado do mês.",
            "Maior de 16 anos com autorização dos responsáveis. Trazer documento com foto.",
            "Buscamos gente que possa vir com regularidade, nem que seja uma vez por semana.",
          ])
        : null,
    nomePublico,
    descricaoCurta: escolher(perfil.frases),
    sobre: chance(0.8) ? escolher(perfil.sobre) : null,
    logo: null,
    capa: null,
    termosAceitosEm: publicadaEm,
    publicadaEm,
    slug,
    urgencias,
  };
}

// ---- execução ----
const limpar = process.argv.includes("--limpar");

try {
  // apaga a demonstração anterior, para rodar de novo não duplicar nada
  const antigos = await prisma.user.findMany({
    where: { email: { endsWith: `@${DOMINIO_DEMO}` } },
    select: { id: true },
  });
  if (antigos.length) {
    const ids = antigos.map((u) => u.id);
    await prisma.ong.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.info(`${antigos.length} ONG(s) de demonstração anteriores removidas`);
  }
  if (limpar) {
    console.info("pronto: só a limpeza foi pedida (--limpar)");
  } else {
    // nomes reais dos itens, para a urgência guardar o nome como a ONG viu
    const itensDaLista = await prisma.opcaoLista.findMany({ where: { tipo: "ITEM" }, select: { slug: true, nome: true } });
    if (!itensDaLista.length) {
      console.error("as listas fixas estão vazias: rode `pnpm db:seed` antes");
      process.exit(1);
    }
    const nomeDoItem = new Map(itensDaLista.map((i) => [i.slug, i.nome]));

    // slugs já ocupados por ONGs reais
    const usados = new Set(
      (await prisma.ong.findMany({ where: { slug: { not: null } }, select: { slug: true } })).map((o) => o.slug!)
    );

    const agora = new Date();
    for (let i = 0; i < TOTAL; i++) {
      const { urgencias, ...dados } = gerarOng(i, usados);

      // a Ong exige um User (relação userId). Estas contas não têm senha: ninguém entra nelas.
      const user = await prisma.user.create({
        data: {
          id: `demo-${String(i + 1).padStart(3, "0")}-${Math.floor(aleatorio() * 1e9).toString(36)}`,
          name: dados.nomePublico,
          email: `ong${String(i + 1).padStart(3, "0")}@${DOMINIO_DEMO}`,
          emailVerified: true,
          role: "ONG",
          createdAt: dados.publicadaEm,
          updatedAt: agora,
        },
      });

      await prisma.ong.create({
        data: {
          ...dados,
          urgencias: urgencias.map((u) => ({ ...u, nome: nomeDoItem.get(u.item) ?? u.item })),
          user: { connect: { id: user.id } },
        } as Prisma.OngCreateInput,
      });
    }
    console.info(`${TOTAL} ONGs de demonstração criadas`);

    // ONGs reais publicadas que ficaram sem posição pública ou sem slug não aparecem no mapa
    // nem na lista; completa o que falta (mesma regra do cadastro).
    const incompletas = await prisma.ong.findMany({
      where: {
        status: "PUBLICADA",
        user: { email: { not: { endsWith: `@${DOMINIO_DEMO}` } } },
        OR: [{ localizacaoPublica: { isSet: false } }, { slug: null }, { slug: { isSet: false } }],
      },
      select: {
        id: true,
        nomePublico: true,
        razaoSocial: true,
        slug: true,
        localizacao: true,
        localizacaoPublica: true,
        mostrarSoBairro: true,
        endereco: true,
      },
    });
    for (const ong of incompletas) {
      const data: Prisma.OngUpdateInput = {};
      if (!ong.slug) data.slug = slugUnico(ong.nomePublico ?? ong.razaoSocial, usados);
      if (!ong.localizacaoPublica) {
        // sem localização real não dá para inventar o ponto: usa o centro do bairro do endereço
        const real = ong.localizacao?.coordinates
          ? { latitude: ong.localizacao.coordinates[1], longitude: ong.localizacao.coordinates[0] }
          : (() => {
              const b =
                BAIRROS.find((x) => x.bairro === ong.endereco?.bairro && x.municipio === ong.endereco?.municipio) ??
                BAIRROS.find((x) => x.municipio === ong.endereco?.municipio) ??
                BAIRROS[0];
              return { latitude: b.lat + (aleatorio() - 0.5) * 0.01, longitude: b.lng + (aleatorio() - 0.5) * 0.01 };
            })();
        if (!ong.localizacao) data.localizacao = { type: "Point", coordinates: [real.longitude, real.latitude] };
        const publica = ong.mostrarSoBairro ? posicaoAproximada(real, aleatorio) : real;
        data.localizacaoPublica = { type: "Point", coordinates: [publica.longitude, publica.latitude] };
      }
      await prisma.ong.update({ where: { id: ong.id }, data });
      console.info(`ONG "${ong.nomePublico ?? ong.razaoSocial}" completada (${Object.keys(data).join(", ")})`);
    }
  }
} finally {
  await prisma.$disconnect();
}

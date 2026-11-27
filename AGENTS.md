# AGENTS.md

Instruções para agentes de IA (Codex/GPT, Claude Code, Cursor, Copilot...) e para pessoas que trabalham neste repositório. **Este arquivo é a fonte única**: o `CLAUDE.md` apenas o importa. Edite aqui, não lá.

## Projeto

**BuscaONG** é o nome do projeto e do site. É um site que conecta doadores a ONGs próximas, com mapa (Mapbox) e lista sincronizada, filtros por causa, item e voluntariado, e destaque visual de urgência.

- Não há conta de doador: só **ONG** (`/ong`) e **Admin** (`/admin`) têm login.
- O site **não envia notificações**; a urgência é só visual.
- Monorepo pnpm: o app Next.js fica em `web/`, e a raiz cuida das ferramentas compartilhadas.

Idioma: documentação, commits, branches e textos da interface em **português**.

## Regras obrigatórias

### Git

- **Nunca commitar nem dar push na `main`.** Trabalhar sempre numa branch e entregar por PR.
- **Branch:** `<tipo>/<descricao-em-kebab-case>`, sem acento (ex.: `feat/cadastro-ong`).
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/), descrição em minúscula (ex.: `fix(api): exige perfil admin no GET /api/users`).
- **Commits atômicos:** uma mudança lógica por commit, com build e testes passando em cada um.
- **Título do PR:** mesmo formato dos commits. Merge preservando os commits (sem squash).
- **Não usar `--no-verify`.** Hooks e CI verificam essas regras.
- Detalhes e exemplos: [docs/git.md](docs/git.md).

### Código

- **Prisma fica na linha 6** (`^6.19`), porque o Prisma 7 não suporta MongoDB. **Nunca instale `prisma` ou `@prisma/client` sem versão**: a tag `latest` do npm aponta para um release candidate do Prisma 8.
- **Autenticação é com better-auth** (não Auth.js/NextAuth). Operações de conta passam pelo better-auth, nunca pelo Prisma direto ([docs/autenticacao.md](docs/autenticacao.md)).
- **Rotas da API não importam o Prisma**: rota → schema (Zod) → service ([docs/padroes-api.md](docs/padroes-api.md)).
- **Cores só pelos tokens do projeto** (`bg-musgo`, `text-tinta`...). **Terracota é exclusiva de urgência** ([docs/buscaong.md §11](docs/buscaong.md)).
- **Código herdado do template:** ao reescrever, **não copie** o código antigo; parta do requisito e da documentação oficial ([docs/codigo-herdado.md](docs/codigo-herdado.md)).
- **Antes de mexer em auth ou validação de IDs**, leia [docs/erros-a-consertar.md](docs/erros-a-consertar.md): há bugs de segurança conhecidos que dependem uns dos outros.

### Ao trabalhar

- Em decisões com mais de uma opção razoável (arquitetura, dependências, escopo), **pergunte antes** de escolher.
- **Não faça commit nem push sem pedido explícito.**
- Ao mudar estrutura, regras ou padrões, **atualize o doc correspondente** em `docs/`.

## Comandos

Requisitos: Node `>=24` e pnpm 10.34.9 (fixado em `packageManager`; o pnpm troca de versão sozinho).

Rode tudo da raiz:

```bash
pnpm install       # instala tudo (gera o cliente Prisma no postinstall)
pnpm dev           # http://localhost:3000
pnpm lint          # ESLint (pnpm lint:fix corrige)
pnpm test          # Vitest (integração)
pnpm test:e2e      # Playwright (precisa do dev rodando)
pnpm build         # build de produção
pnpm db:push       # cria coleções e índices no MongoDB (precisa do DATABASE_URL)
pnpm db:seed       # listas fixas, índices (geográfico e slug único) e dados que faltam em ONGs antigas
pnpm db:demo       # 100 ONGs de demonstração na Grande SP (pnpm db:demo --limpar remove só elas)
pnpm admin:criar   # cria uma conta de admin (pergunta e-mail, nome e senha)
```

Ferramentas de desenvolvimento (TypeScript, ESLint, Vitest, Playwright...) ficam no `package.json` da **raiz**; dependências do app ficam em `web/package.json`. Instale cada uma no lugar certo (`pnpm add -Dw <pkg>` para a raiz, `pnpm --filter web add <pkg>` para o app).

O app precisa de `web/.env` (modelo em `web/.env.example`).

## Documentação

| Doc | Conteúdo |
|---|---|
| [docs/buscaong.md](docs/buscaong.md) | produto, escopo, stack, versões, serviços externos, identidade visual |
| [docs/arquitetura.md](docs/arquitetura.md) | estrutura do repositório, fluxos, onde colocar código novo |
| [docs/padroes-api.md](docs/padroes-api.md) | camadas, validação e formato de resposta da API |
| [docs/padroes-frontend.md](docs/padroes-frontend.md) | componentes, pastas, convenções de UI, imports |
| [docs/autenticacao.md](docs/autenticacao.md) | better-auth e regras de conta |
| [docs/git.md](docs/git.md) | branches, commits, PRs e verificação automática |
| [docs/erros-a-consertar.md](docs/erros-a-consertar.md) | bugs conhecidos, ainda não corrigidos |
| [docs/codigo-herdado.md](docs/codigo-herdado.md) | código do template a reescrever antes do lançamento |

`docs/estado-anterior.md` (estado do repositório antes da limpeza) existe só localmente e não é versionado.

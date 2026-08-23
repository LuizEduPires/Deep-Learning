# Estrutura de pastas

Cinco camadas, uma pasta cada: **front**, **back**, **api**, **banco** e
**documentação**.

```
IA PITAYA/
├── src/
│   ├── app/          roteamento (Next) — páginas e rotas HTTP, ambas finas
│   ├── frontend/     componentes de UI
│   ├── server/       regra de negócio
│   └── instrumentation.ts   gancho de inicialização do Next (ver abaixo)
├── banco/            docker-compose, config do Drizzle, migrações
├── docs/             esta documentação
├── scripts/          operações de linha de comando
└── data/conhecimento/  base própria em .md que alimenta o RAG
```

## Por que `src/app` não some

Em Next.js **a pasta é a rota**: `src/app/agrofit/page.tsx` existe porque a URL
é `/agrofit`, e `src/app/api/chat/route.ts` porque o endpoint é `/api/chat`.
Mover esses arquivos apaga as rotas. Por isso a separação aqui não é "cada
camada num projeto", e sim: `src/app` guarda **só o roteamento**, e todo o resto
mora em `frontend/` e `server/`.

Na prática:

| Arquivo em `src/app` | Tem permissão de | Não pode |
| --- | --- | --- |
| `page.tsx` | importar um componente de `src/frontend` e definir o `metadata` | conter JSX de tela, estado ou fetch |
| `api/**/route.ts` | ler parâmetros, validar entrada, chamar `src/server`, montar a resposta e o status | conter SQL, chamada a API externa ou regra de negócio |

Os arquivos de rota hoje têm entre 15 e 90 linhas, e nenhum tem `sql\`` ou
`fetch` de terceiro.

## As camadas

### `src/frontend` — front

Componentes `"use client"`. Falam com o back **só** por `fetch` nas rotas de
`/api` — nunca importam `src/server`, que roda com segredos e conexão de banco.

| Arquivo | O que é |
| --- | --- |
| `chat.tsx` | a tela do chat: mensagens, sugestões, propriedade em contexto |
| `historico.tsx` | painel "Conversas": lista, abre, cria e apaga conversas |
| `config-llm.tsx` | painel de troca de provedor e modelo de LLM |
| `usar-ditado.ts`, `icones-microfone.tsx` | ditado por voz ([09](09-ditado-por-voz.md)) |
| `agrofit/busca.tsx`, `bioinsumos/busca.tsx` | as duas telas de consulta às bases do MAPA |

Os painéis são componentes separados, e não seções do `chat.tsx`, porque cada
um tem estado e ciclo de vida próprios — o histórico busca a lista quando abre,
o de LLM busca o catálogo quando monta. Juntos, virariam um componente com
quatro fetches e sete estados.

### `src/server` — back

Onde vive a decisão. Nada aqui conhece `Request`, `NextResponse` ou React, o que
permite chamar a mesma função da rota HTTP, de uma tool do agente ou de um
script.

| Pasta | O que faz |
| --- | --- |
| `agent.ts`, `llm/`, `tools/` | o agente: system prompt, abstração de provedor e as tools |
| `conversas.ts` | uma rodada de chat e o histórico: listar, abrir e apagar conversas |
| `ingestao.ts`, `embeddings.ts`, `conhecimento-observador.ts` | a base de conhecimento: recorte em trechos, embeddings e o observador que ingere `.md` novo em desenvolvimento |
| `propriedades.ts`, `usuarios.ts` | cadastro e o usuário demo do MVP |
| `agroapi/` | credencial e paginação do gateway da Embrapa, comuns a todas as APIs do portal |
| `agrofit/` | `api.ts` (cliente) e `busca.ts` (consulta à cópia local no Postgres) |
| `bioinsumos/` | `api.ts` (cliente, só para a coleta) e `busca.ts` (consulta à cópia local no Postgres) |
| `db/` | schema Drizzle e pool de conexão |

#### `src/server/llm/` — os provedores

| Arquivo | O que faz |
| --- | --- |
| `types.ts` | o contrato neutro (`LlmProvider`, `ToolDef`, `ChatRequest`). Nada abaixo dele conhece fornecedor |
| `anthropic.ts` | cliente e laço de tool use no dialeto da Anthropic |
| `openai.ts` | o laço de tool use no dialeto Chat Completions, compartilhado |
| `openrouter.ts`, `nvidia.ts` | só montam o cliente (baseURL, chave, headers) e reusam o laço de `openai.ts` |
| `catalogo.ts` | provedores e modelos que o painel oferece |
| `modelos-openrouter.ts` | lista viva de modelos do OpenRouter, filtrada por tool calling |
| `config.ts` | o que está valendo: tabela `configuracoes` na frente do `.env` |
| `index.ts` | o `switch` que monta o provedor ativo |
| `erros.ts` | traduz falha de provedor em mensagem acionável no chat |

São quatro provedores — `anthropic`, `openai`, `openrouter`, `nvidia` — e
trocar entre eles é clique no painel do chat, sem reiniciar o servidor
([README](../README.md#trocando-de-modelo), [08](08-openrouter.md),
[10](10-nvidia.md)).

O par `api.ts` / `busca.ts` se repete de propósito: `api.ts` é o que a fonte
externa oferece, `busca.ts` é o que esta aplicação precisa. Quando a Embrapa
mudar um campo, só `api.ts` muda.

### `banco/`

`docker-compose.yml` (Postgres + pgvector, e o Adminer atrás de um profile),
`drizzle.config.ts` e `migracoes/*.sql`.

As migrações são **escritas à mão** e aplicadas por `scripts/migrate.ts` na
ordem do nome do arquivo — hoje `0000_init`, `0001_agrofit_api`,
`0002_bioinsumos`, `0003_unaccent` e `0004_configuracoes`. Todas usam
`IF NOT EXISTS`, então rodar de novo é seguro. O `out` do drizzle-kit aponta para `banco/_gerado`
(ignorado no git) justamente para que um `drizzle-kit generate` acidental não
sobrescreva nem renumere o que já rodou.

Os caminhos dentro de `drizzle.config.ts` são relativos à **raiz do projeto**,
não à pasta `banco/`: o drizzle-kit resolve a partir de onde é chamado, e os
scripts do `package.json` rodam sempre da raiz.

Comandos (nenhum exige lembrar do `-f`):

```bash
npm run db:up        # sobe o Postgres
npm run db:migrate   # aplica banco/migracoes/*.sql
npm run db:seed      # ingere data/conhecimento no RAG
npm run db:studio    # Drizzle Studio
npm run db:adminer   # cliente web em http://localhost:8081
npm run db:down      # derruba (o volume sobrevive; -- -v apaga os dados)
```

### `scripts/`

Operações que não são a aplicação: `migrate`, `ingest`, `agrofit-sync`,
`import-agrofit`, `bioinsumos-sync`, `bioinsumos-test` e `llm-test` (fumaça do
provedor: confere se a chave autentica e se o modelo chama ferramenta).
Importam de `src/server` e são chamadas pelo `package.json`. O
`pdf-para-md.py` é o único fora do Node: converte PDF em `.md` para a base de
conhecimento.

### `src/instrumentation.ts`

Gancho que o Next executa uma vez quando o servidor sobe. Serve para ligar o
observador de `data/conhecimento/` em desenvolvimento: salvar um `.md` na pasta
basta para ele entrar na base, sem `db:seed` e sem segundo terminal. Em
produção o observador não roda — sistema de arquivos costuma ser somente
leitura, e quem semeia é o deploy. O arquivo fica em `src/` porque o Next exige
esse caminho, como as páginas em `src/app`.

### `docs/`

| Documento | Assunto |
| --- | --- |
| [00-handoff-produto.md](00-handoff-produto.md) | escopo, decisões de produto |
| [01-arquitetura-dados.md](01-arquitetura-dados.md) | modelo de dados |
| [02-como-rodar.md](02-como-rodar.md) | passo a passo do ambiente |
| [03-drizzle-studio.md](03-drizzle-studio.md) | navegar o banco |
| [04-estrutura.md](04-estrutura.md) | este documento |
| [05-api-http.md](05-api-http.md) | referência das rotas HTTP |
| [06-panorama-e-deep-learning.md](06-panorama-e-deep-learning.md) | panorama técnico e uso de deep learning |
| [07-drone-visao-computacional.md](07-drone-visao-computacional.md) | viabilidade de drone e visão computacional |
| [08-openrouter.md](08-openrouter.md) | cadastrar a chave do OpenRouter |
| [09-ditado-por-voz.md](09-ditado-por-voz.md) | ditado por voz no chat |
| [10-nvidia.md](10-nvidia.md) | cadastrar a chave gratuita da NVIDIA |

## Onde mexer

| Tarefa | Arquivo |
| --- | --- |
| Mudar uma tela | `src/frontend/…` |
| Mudar uma consulta ou regra | `src/server/…` |
| Adicionar um endpoint | `src/app/api/<nome>/route.ts`, delegando ao `src/server` |
| Adicionar uma tool do agente | `src/server/tools/`, registrando em `tools/index.ts` |
| Trocar de provedor ou modelo de LLM | painel do chat (botão com o nome do modelo); o `.env` é só o padrão de partida |
| Adicionar um provedor de LLM | `src/server/llm/<nome>.ts` implementando `LlmProvider`, mais o `switch` de `llm/index.ts` e a entrada em `llm/catalogo.ts` |
| Adicionar uma chave de API | só no `.env` — nenhum segredo passa pelo painel nem pelo banco |
| Alterar tabela | nova migração em `banco/migracoes/`, e o schema em `src/server/db/schema.ts` |

# 🐉 IA Pitaya

Chat de IA para manejo da pitaya. O agente cruza previsão do tempo, clima
histórico, registros fitossanitários do MAPA e uma base própria de conhecimento
técnico, sempre citando a fonte que usou.

- **Como rodar (passo a passo):** [docs/02-como-rodar.md](docs/02-como-rodar.md)
- **Deploy com Docker Compose e Turnstile:** [docs/11-deploy-docker-compose.md](docs/11-deploy-docker-compose.md)
- Handoff de produto: [docs/00-handoff-produto.md](docs/00-handoff-produto.md)
- Arquitetura de dados: [docs/01-arquitetura-dados.md](docs/01-arquitetura-dados.md)
- Drizzle Studio: [docs/03-drizzle-studio.md](docs/03-drizzle-studio.md)
- **Estrutura de pastas:** [docs/04-estrutura.md](docs/04-estrutura.md)
- **API HTTP:** [docs/05-api-http.md](docs/05-api-http.md)
- **Panorama técnico e deep learning:** [docs/06-panorama-e-deep-learning.md](docs/06-panorama-e-deep-learning.md)
- **Drone e visão computacional (viabilidade):** [docs/07-drone-visao-computacional.md](docs/07-drone-visao-computacional.md)
- **Cadastrar a chave do OpenRouter:** [docs/08-openrouter.md](docs/08-openrouter.md)
- **Ditado por voz no chat:** [docs/09-ditado-por-voz.md](docs/09-ditado-por-voz.md)
- **Cadastrar a chave da NVIDIA (gratuita):** [docs/10-nvidia.md](docs/10-nvidia.md)

## Como rodar

```bash
npm install
```

**1. Banco de dados** (PostgreSQL + pgvector):

```bash
npm run db:up
```

**2. Configuração:** copie `.env.example` para `.env` e preencha. O mínimo é
`DATABASE_URL` mais a chave de um provedor de LLM. Para uma demonstração
rápida sem custo, `.env.nvidia.example` já vem com o mínimo para rodar com a
NVIDIA — só falta colar a chave gratuita (ver
[docs/10-nvidia.md](docs/10-nvidia.md)).

**3. Migrações e base de conhecimento:**

```bash
npm run db:migrate
npm run db:seed
```

**4. Suba a aplicação:**

```bash
npm run dev
```

Abra http://localhost:3000, cadastre a propriedade (nome + lat/lon) e pergunte.

No alto do chat ficam os três botões que controlam a sessão: **Conversas**
(histórico — retomar uma conversa antiga, começar outra ou apagar), o **modelo**
em uso (troca de provedor e modelo, ver abaixo) e a **propriedade** em
contexto.

## Trocando de modelo

Pelo painel, no chat: o botão com o nome do modelo, no alto à direita, abre a
escolha de provedor e modelo. A troca vale a partir da próxima pergunta — sem
editar arquivo, sem reiniciar o servidor.

O que você salva ali fica na tabela `configuracoes` (chave `llm`) e tem
precedência sobre o `.env`; o botão "Usar o do .env" apaga a linha e devolve o
controle ao ambiente. Enquanto o painel nunca foi usado, vale o `.env`:

```bash
LLM_PROVIDER=openrouter         # anthropic | openai | openrouter | nvidia
OPENROUTER_API_KEY=sk-or-...
LLM_MODEL=openai/gpt-4o         # opcional — vazio usa o padrão do provedor
```

### Servidor compatível com OpenAI

Configure a **URL base da API**, incluindo `/v1` se esse for o prefixo usado
pelo seu servidor:

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=chave-do-seu-servidor
OPENAI_BASE_URL=https://llm.exemplo.com/v1
LLM_MODEL=nome-do-modelo-no-servidor
# Se o servidor não oferecer embeddings:
EMBEDDINGS_ENABLED=false
```

Neste exemplo, o app chama `POST https://llm.exemplo.com/v1/chat/completions`
para o chat e, quando embeddings estão habilitados,
`POST https://llm.exemplo.com/v1/embeddings` para o RAG. **Não** coloque
`/chat/completions`, `/embeddings` ou `/models` em `OPENAI_BASE_URL`: são caminhos
de operação, não a URL base. O app não consulta `/models` para o provedor
`openai`; escolha `LLM_MODEL` no `.env` ou "Outro modelo…" no painel. Se seu
servidor oferece `/chat/completions` diretamente na raiz, use só
`https://llm.exemplo.com`; se oferece outro prefixo, informe esse prefixo.
Confira os caminhos na documentação oficial da OpenAI para
[Chat Completions](https://developers.openai.com/api/reference/resources/chat)
e [embeddings](https://developers.openai.com/api/reference/resources/embeddings/methods/create).

A mesma `OPENAI_BASE_URL` e a mesma chave valem para chat e embeddings. Ajuste
`EMBEDDINGS_MODEL` para um modelo de embeddings do servidor, ou use
`EMBEDDINGS_ENABLED=false` para manter a busca full-text. O modelo de chat
precisa aceitar tool calling; `docker compose run --rm init npm run llm:test`
verifica isso. No Compose, o domínio de `OPENAI_BASE_URL` é liberado
automaticamente no `egress-proxy`; o proxy exige HTTPS na porta 443 e bloqueia
endereços privados. Depois de editar `.env`, execute
`docker compose up -d --build` para recriar os serviços. O banco armazena
vetores de 1536 dimensões; embeddings de outro tamanho caem para busca
full-text. Se habilitar embeddings depois da primeira
carga, rode `docker compose run --rm init npm run db:seed` para recriar os vetores.

Para demonstrar a aplicação sem custo, a **NVIDIA** é o caminho mais curto:
chave gratuita e sem cartão em build.nvidia.com, cota própria e uma centena de
modelos abertos — ver [docs/10-nvidia.md](docs/10-nvidia.md). Como cada
provedor tem a sua cota, ter dois cadastrados significa que a demonstração
sobrevive à cota de um deles acabar: troca no painel e segue.

No OpenRouter o painel lista os modelos direto do catálogo deles, gratuitos
primeiro, e só os que suportam tool calling — sem isso o agente responde de
memória em vez de consultar Agrofit, clima e a base. Para Anthropic, OpenAI e
NVIDIA a lista é a curada em `src/server/llm/catalogo.ts`, e "Outro modelo…"
aceita qualquer id em qualquer provedor.

**As chaves de API continuam só no `.env`.** O painel não edita segredo: ele
mostra quais provedores têm chave e quais não têm, para a troca não virar erro
na primeira pergunta. Detalhes do OpenRouter em [docs/08-openrouter.md](docs/08-openrouter.md).

Não há código específico de fornecedor fora de `src/server/llm/`. Para
acrescentar um quinto, implemente a interface `LlmProvider`
(`src/server/llm/types.ts`), registre no `switch` de `src/server/llm/index.ts` e
adicione a entrada em `src/server/llm/catalogo.ts` — o painel se monta a partir
do catálogo, e as tools e o resto da aplicação não mudam.

## Fontes de dados

| Fonte | Tool | Precisa de chave? |
| --- | --- | --- |
| Open-Meteo (previsão) | `previsao_tempo` | Não |
| ClimAPI Embrapa / Open-Meteo Archive | `clima_historico` | Opcional — sem `AGROAPI_TOKEN` usa Open-Meteo |
| Agrofit (API) / Dados Abertos Agrofit | `consulta_agrofit` | Opcional — a consulta usa a cópia local |
| Base própria (RAG) | `busca_conhecimento` | Não — sem embeddings usa busca full-text |
| Responde Agro | `responde_agro` | Sim — a tool só é registrada se houver `AGROAPI_TOKEN` |

Nenhuma fonte é bloqueante: cada uma tem plano B, e a falha de uma não derruba
a resposta — o agente informa a indisponibilidade e usa as demais.

### Base Agrofit completa (API)

`npm run agrofit:sync` baixa **toda** a base da API Agrofit — as 18 coleções —
para o Postgres local. Depois disso a consulta do agente é local: instantânea,
sem cota gasta e sem depender da API estar de pé.

**Credencial** — cadastro gratuito em
[agroapi.cnptia.embrapa.br](https://www.agroapi.cnptia.embrapa.br), assine a API
AGROFIT (plano `Gratuito100KPorMes`, 100 mil requisições/mês) e ponha no `.env`:

```bash
AGROAPI_CONSUMER_KEY=...
AGROAPI_CONSUMER_SECRET=...
```

O par key/secret é o caminho certo aqui: a coleta dura mais que a validade de um
token (~1h) e o script renova sozinho. `AGROAPI_TOKEN` (bearer colado do portal)
também funciona, mas quebra no meio se a coleta passar da hora.

```bash
npm run agrofit:sync                       # tudo
npm run agrofit:sync -- --listar           # só mostra as coleções
npm run agrofit:sync -- --colecao produtos-formulados,culturas
npm run agrofit:sync -- --pausa 300        # ms entre requisições
npm run agrofit:sync -- --do-cache         # renormaliza sem chamar a API
```

`--do-cache` reconstrói `agrofit_products` e `agrofit_indicacoes` a partir do
payload cru já gravado. Use quando o mapeamento mudar — um sentinela novo
descoberto nos dados, um campo que passa a importar: leva segundos em vez dos
~7 minutos de rebaixar 4.252 produtos.

Cada coleção é independente — se uma falhar, o erro fica em
`agrofit_colecoes.ultimo_erro` e as demais continuam. Rodar de novo é
idempotente, então dá para agendar diariamente (o Mapa publica todo dia).

**O que fica no banco:**

| Tabela | Conteúdo |
| --- | --- |
| `agrofit_itens` | payload cru de toda coleção (`colecao`, `chave`, `payload` jsonb) |
| `agrofit_products` | produtos formulados normalizados — registro, marca, i.a., classe, formulação, modo de ação, toxicológica, ambiental, biológico, orgânico |
| `agrofit_indicacoes` | uma linha por produto × cultura × praga |
| `agrofit_colecoes` | estado da última coleta por coleção |

`agrofit_indicacoes` existe porque cruzar cultura e praga em colunas agregadas
acha produto registrado para a praga **em outra cultura** — erro grave neste
domínio. O join garante que os dois casem na mesma indicação de uso.

O cru em `agrofit_itens` é o seguro contra mudança de layout: se o mapeamento
precisar mudar, remapeia-se dali sem baixar tudo de novo.

**Onde a resposta real diverge do OpenAPI** — descoberto rodando a coleta, e
tratado no código:

- `indicacao_uso[].praga_nome_comum` é declarado `array<string>`, mas vem como
  a string `"Ausente"` quando a praga não tem nome comum cadastrado (~2,7 mil
  ocorrências). `nomesComuns()` normaliza e descarta o sentinela — gravar
  "Ausente" como nome de praga faria o agente oferecê-lo numa busca.
- `/versao` não devolve o `id` nem o `ultima_publicacao` do schema; devolve
  `data_ultima_atualizacao` e os totais de produtos.
- Coleções de apoio repetem o nome científico em registros **distintos**
  (mesma espécie, outra lista de culturas ou nomes comuns). Onde há
  `url_agrofit`, a chave sai do id numérico embutido nela — a PK real do
  Agrofit. Onde não há (`/pragas`), o desempate é um hash do payload.

```sql
-- exemplos
SELECT colecao, registros_gravados, sincronizado_em FROM agrofit_colecoes;
SELECT count(*) FROM agrofit_indicacoes WHERE cultura ILIKE '%pitaya%';
SELECT payload FROM agrofit_itens WHERE colecao = 'produtos-formulados' LIMIT 1;
```

### API Bioinsumos

A mesma credencial da AgroAPI serve para a API **Bioinsumos** — basta assinar a
API `Bioinsumos v2` no [portal](https://www.agroapi.cnptia.embrapa.br/store)
com a mesma aplicação. Ela é o recorte biológico da base do MAPA em duas
categorias: **produtos biológicos** (controle de pragas, 834 registros) e
**inoculantes** (1.032 produtos / 1.239 linhas produto × cultura).

```bash
npm run bioinsumos:test
```

O script confere credencial, `/health`, `/versao`, as 12 coleções, a paginação,
os filtros de `/search/*` e a busca por chave — e sai com código 1 se algo
falhar. Nada é gravado no banco: é teste de fumaça, não coleta.

**Para trazer a base para o Postgres** — e poder abrir no Drizzle Studio ou
consultar em SQL:

```bash
npm run bioinsumos:sync                  # tudo (~40s, 22 requisições)
npm run bioinsumos:sync -- --listar      # só mostra as coleções
npm run bioinsumos:sync -- --colecao produtos-biologicos,inoculantes
npm run bioinsumos:sync -- --do-cache    # renormaliza sem chamar a API
```

| Tabela | Conteúdo |
| --- | --- |
| `bioinsumos_itens` | payload cru de toda coleção (`colecao`, `chave`, `payload` jsonb) |
| `bioinsumos_produtos` | 834 produtos biológicos normalizados |
| `bioinsumos_indicacoes` | 3.172 linhas produto × cultura × praga, com a marca `todas_as_culturas` |
| `bioinsumos_inoculantes` | 1.239 linhas (1.032 produtos × cultura) |
| `bioinsumos_colecoes` | estado da última coleta por coleção |

`todas_as_culturas` é a coluna que faz esta base servir em SQL: 2.950 das 3.172
indicações são de registro genérico, então a pergunta que importa vira uma
linha —

```sql
-- bioinsumos que servem à pitaya (795): os nominais mais os de uso geral
SELECT count(DISTINCT numero_registro)
  FROM bioinsumos_indicacoes
 WHERE cultura ILIKE '%pitaya%' OR todas_as_culturas;
```

A página `/bioinsumos` lê **desta cópia**, não da API: sem a coleta, ela avisa
que a base está vazia em vez de mostrar zero resultado — "não coletado" e "não
existe registro" são respostas diferentes.

O contrato é o mesmo do Agrofit — `page` 1-based, totais em
`X-Records-Count`/`X-Pages`/`X-Page-Size` — sobre `https://api.cnptia.embrapa.br/bioinsumos/v2`:

| Endpoint | Conteúdo |
| --- | --- |
| `/produtos-biologicos`, `/produtos-biologicos/{registro}` | mesmo formato de `produtos-formulados` do Agrofit, com `indicacao_uso[]` |
| `/inoculantes`, `/inoculantes/{registro_produto}` | UF, razão social, espécie, garantia (UFC), natureza física, cultura |
| `/pragas`, `/pragas-nomes-comuns`, `/pragas-nomes-cientificos`, `/culturas`, `/ingredientes-ativos`, `/marcas-comerciais`, `/titulares-registros`, `/formulacoes`, `/modos-acoes`, `/tecnicas-aplicacoes` | vocabulários |
| `/search/produtos-biologicos`, `/search/inoculantes` | as mesmas coleções, filtradas |
| `/health`, `/versao` | 204 vazio; totais e data da última atualização |

**Armadilhas confirmadas no teste:**

- **Só `/search/*` filtra.** `GET /produtos-biologicos?cultura=Soja` devolve os
  834 registros — a coleção ignora os parâmetros. O filtro vive em
  `/search/produtos-biologicos?cultura=Soja` (8 registros).
- **Nome de filtro errado passa batido**: o gateway ignora o parâmetro
  desconhecido e devolve 200 com a coleção inteira. Uma consulta "sem filtro
  nenhum" parece uma consulta que casou tudo — confira o `X-Records-Count`.
- `cultura` casa **exato** contra o vocabulário (`Todas` não acha
  `Todas as culturas`); `ingrediente_ativo` e `titular_registro` casam por
  substring.
- **Pitaya**: `cultura=Pitaya` devolve **zero** produtos biológicos, mas 795 dos
  834 estão registrados para `Todas as culturas` — que incluem a pitaya. Uma
  consulta que filtre só pelo nome da cultura conclui, errado, que não há
  bioinsumo para pitaya. Some as duas.
- A **v1 responde 403** (`Resource forbidden`) mesmo com a assinatura ativa; use
  a v2. Não há `/swagger.json` servido pelo gateway — a documentação é a do
  portal.

### Consultar pela interface: `/agrofit`

`http://localhost:3000/agrofit` — busca estruturada sobre a base, direto no
Postgres: **sem LLM**, sem chave e sem custo por consulta. Filtros por produto/nº
de registro, cultura, praga, ingrediente ativo, titular, classe agronômica, além
de biológico e uso orgânico. A coluna de alvos só aparece quando há filtro de
cultura — sem ele seriam as centenas de pragas de todas as culturas do produto.

Os campos de cultura, praga, ingrediente, titular e classe autocompletam a
partir das listas canônicas do próprio Agrofit (`/api/agrofit/vocabulario`).
Isso não é conforto, é correção: a busca é `ILIKE` sobre o nome exato, então
"pitaia" ou "fruta-do-dragão" não acham a cultura que o MAPA registra como
**Pitaya** — e o usuário leria o vazio como "não há produto registrado".

A mesma consulta pela API: `GET /api/agrofit?cultura=Pitaya&praga=antracnose`.

### Consultar pela interface: `/bioinsumos`

`http://localhost:3000/bioinsumos` — mesma ideia da página Agrofit, **sem LLM**,
em duas abas: produtos biológicos para controle de pragas e inoculantes.

Consulta ao Postgres, como a página Agrofit: exige `npm run bioinsumos:sync`
uma vez, e a partir daí não há chamada à Embrapa em tempo de request — ~50ms
por consulta, sem cota gasta e imune à API estar fora do ar.

Consultar em SQL não é só desempenho — é o que permite fazer o que
`/search/*` da Embrapa **não** faz:

- **Cultura e praga casam na mesma indicação de uso.** Cruzá-las em campos
  agregados acharia produto registrado para a praga em *outra* cultura.
- **Registro para "Todas as culturas" entra no resultado da cultura filtrada.**
  Sem isso, `Pitaya` devolveria zero produto biológico — quando na verdade 795
  dos 834 valem para ela. A página soma os dois e **marca** cada linha que casou
  só pelo registro genérico, com um aviso no topo dizendo quantas foram: o
  usuário precisa saber que o produto não foi registrado nominalmente para a
  cultura dele.
- Os textos casam por substring **sem acento** (`unaccent` + `ILIKE`): "Feijao"
  acha "Feijão". Como é substring, `cultura=Soja` nos inoculantes traz também
  "Soja perene".

A mesma consulta pela API:

```bash
GET /api/bioinsumos?aba=produtos&cultura=Pitaya&praga=Mosca-branca
GET /api/bioinsumos?aba=inoculantes&cultura=Soja&uf=SP
GET /api/bioinsumos/vocabulario          # listas para autocompletar
GET /api/bioinsumos/culturas?registro=2798
```

Sem `AGROAPI_CONSUMER_KEY`/`SECRET` no `.env` a página responde 503 com a
instrução de cadastro — nada quebra silenciosamente.

### Navegar o banco

Cliente web em http://localhost:8081 (usuário/senha `pitaya`, servidor `db`):

```bash
npm run db:adminer
```

Há também o Drizzle Studio (`npm run db:studio`, em https://local.drizzle.studio),
mais bonito — mas é uma página externa alcançando o seu `localhost`, e o Chrome
bloqueia isso até você liberar "Acesso à rede local" nas informações do site.
Passo a passo em [docs/03-drizzle-studio.md](docs/03-drizzle-studio.md).

Ou direto no terminal, sem instalar cliente — o `psql` vem dentro do container:

```bash
docker exec -it pitaya-db psql -U pitaya -d pitaya
```

`banco/drizzle.config.ts` serve ao Studio. As migrações continuam sendo escritas à mão
em `banco/migracoes/*.sql` e aplicadas por `npm run db:migrate` — não rode
`drizzle-kit push`, que altera o banco sem deixar migração registrada.

### Alternativa sem credencial: Dados Abertos

Traz só produtos formulados e técnicos, com menos campos, mas não pede token:

```bash
# Baixe o CSV de produtos formulados em https://dados.agricultura.gov.br
npm run agrofit:import -- caminho/para/produtos.csv

# ou defina AGROFIT_CSV_URL no .env e rode sem argumento
npm run agrofit:import
```

O mapeamento de colunas fica isolado em `scripts/import-agrofit.ts` (os Dados
Abertos mudam de layout entre publicações) e a linha original é preservada em
`raw`. Este caminho não popula `agrofit_indicacoes` — o CSV não traz a indicação
de uso estruturada. Sem ela a tool cai para o cruzamento aproximado das colunas
agregadas (cultura e alvo podem vir de indicações diferentes) e declara isso na
resposta, para o agente repassar a ressalva ao usuário.

### Base de conhecimento

Arquivos `.md` em `data/conhecimento/`. Veja
[data/conhecimento/00-LEIA-ME.md](data/conhecimento/00-LEIA-ME.md) para o
formato. Rode `npm run db:seed` após editar — a reingestão é idempotente por
título do documento.

Os documentos que acompanham o projeto são um ponto de partida e **precisam de
revisão do responsável técnico** antes do uso em produção.

## Estrutura

Cinco camadas, uma pasta cada. Detalhe e as regras de fronteira em
[docs/04-estrutura.md](docs/04-estrutura.md).

```
src/
  app/          ROTEAMENTO — o Next exige que fique aqui
    page.tsx, agrofit/page.tsx, bioinsumos/page.tsx    páginas (só montam o front)
    api/                                              rotas HTTP (só traduzem HTTP)
  frontend/     FRONT — componentes de UI ("use client")
    chat.tsx, historico.tsx, config-llm.tsx    o chat e seus painéis
    agrofit/busca.tsx, bioinsumos/busca.tsx
    usar-ditado.ts, icones-microfone.tsx       ditado por voz
  server/       BACK — regra de negócio, nada de HTTP nem de React
    agent.ts, tools/                o agente e as 4 tools (+1 com token da AgroAPI)
    llm/                            4 provedores atrás de um contrato neutro
    conversas.ts                    rodada de chat e histórico de conversas
    ingestao.ts, embeddings.ts, conhecimento-observador.ts   base de conhecimento
    propriedades.ts, usuarios.ts
    agroapi/                        credencial e paginação do gateway Embrapa
    agrofit/, bioinsumos/           clientes das APIs + buscas
    db/                             schema Drizzle + pool
  instrumentation.ts   gancho do Next: liga o observador de conhecimento no dev
banco/          BANCO
  docker-compose.yml, drizzle.config.ts, migracoes/*.sql
docs/           DOCUMENTAÇÃO
scripts/        operações: migrate, ingest, agrofit-sync, bioinsumos-test, llm-test
data/conhecimento/   base própria (.md) que alimenta o RAG
```

A regra que mantém isso de pé: **`src/app` não contém lógica**. Uma rota lê
parâmetros, chama `src/server` e devolve JSON; uma página só renderiza o
componente de `src/frontend`. Assim a mesma regra de negócio serve à página, à
tool do agente e a um script de linha de comando sem ser reescrita.

## Aviso

O chat informa quais produtos estão **registrados** no MAPA. Ele não prescreve
dose, calda ou intervalo de aplicação, e não substitui receituário agronômico
emitido por profissional habilitado.

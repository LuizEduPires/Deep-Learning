# Arquitetura de Dados — Chat IA Pitaya

> PostgreSQL + Drizzle ORM. Extensão `pgvector` para RAG. Modela **somente** o exigido pelo MVP aprovado.

## Entidades

### users
Identificação mínima (MVP sem senha — sessão por cookie).
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | uuid PK default gen_random_uuid() | |
| name | text NOT NULL | |
| email | text UNIQUE NOT NULL | |
| created_at | timestamptz default now() | |

### properties
Propriedade/fazenda para consultas de clima.
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK → users ON DELETE CASCADE | |
| name | text NOT NULL | |
| latitude / longitude | double precision NOT NULL | CHECK lat ∈ [-90,90], lon ∈ [-180,180] |
| created_at | timestamptz | |

### conversations
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK → users ON DELETE CASCADE | |
| property_id | uuid FK → properties ON DELETE SET NULL, nullable | contexto de clima |
| title | text | primeira pergunta truncada |
| created_at | timestamptz | |

### messages
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | uuid PK | |
| conversation_id | uuid FK → conversations ON DELETE CASCADE | |
| role | text CHECK IN ('user','assistant') | |
| content | text NOT NULL | |
| sources | jsonb nullable | citações (tool, API, documento) exibidas na UI |
| created_at | timestamptz | ordenação do histórico |

### configuracoes
Configuração editável em runtime, uma linha por chave. Hoje só a chave `llm`,
gravada pelo painel de troca de provedor/modelo do chat.
| Campo | Tipo | Regras |
| --- | --- | --- |
| chave | text PK | `"llm"` |
| valor | jsonb NOT NULL | `{ "provider": "openrouter", "model": "openai/gpt-4o" }` |
| atualizado_em | timestamptz | |

Quando a linha `llm` existe, ela **tem precedência** sobre `LLM_PROVIDER` /
`LLM_MODEL` do `.env`; apagá-la devolve o controle ao ambiente. Chave de API
não entra aqui: segredo lido pela UI é segredo vazado.

### documents
Documento da base de conhecimento (pitaya).
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | uuid PK | |
| title | text NOT NULL | |
| source | text | origem/URL/publicação |
| created_at | timestamptz | |

### chunks
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | uuid PK | |
| document_id | uuid FK → documents ON DELETE CASCADE | |
| chunk_index | int NOT NULL | ordem no documento |
| content | text NOT NULL | |
| embedding | vector(1536) **nullable** | null quando sem chave de embeddings |
| tsv | tsvector GERADO (portuguese, content) | fallback full-text |

Índices: HNSW em `embedding` (cosine), GIN em `tsv`.

### agrofit_products
Cache local dos Dados Abertos Agrofit (plano B da API).
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | serial PK | |
| registration | text UNIQUE | nº de registro MAPA |
| product_name | text NOT NULL | |
| active_ingredient | text | |
| product_class | text | fungicida, inseticida… |
| crops | text | culturas indicadas (texto pesquisável) |
| pests | text | pragas/doenças alvo (texto pesquisável) |
| holder | text | titular do registro |
| toxicological_class | text | |
| environmental_class | text | |
| raw | jsonb | linha original do dump |
| updated_at | timestamptz | |

Índices: GIN trigram (`pg_trgm`) em `crops`, `pests`, `product_name`, `active_ingredient` para ILIKE rápido.

## As bases do MAPA coletadas por API

`agrofit_products` nasceu do CSV dos Dados Abertos. Depois entrou a coleta pela
API da AgroAPI/Embrapa, que traz mais campos e a indicação de uso explodida.
As duas bases — Agrofit e Bioinsumos — seguem o **mesmo desenho**, e por isso
aparecem juntas aqui.

| Tabela | Papel | Linhas na base local (Agrofit / Bioinsumos) |
| --- | --- | --- |
| `agrofit_itens` / `bioinsumos_itens` | payload cru de cada coleção (`colecao`, `chave`, `payload` jsonb) | 19.500 / 6.297 |
| `agrofit_colecoes` / `bioinsumos_colecoes` | estado da coleta: registros declarados pela API, gravados, páginas, último erro | 18 / 13 coleções |
| `agrofit_indicacoes` / `bioinsumos_indicacoes` | `indicacao_uso` explodida: uma linha por produto × cultura × praga | 292.509 / 3.172 |
| `bioinsumos_produtos` | produtos biológicos normalizados | — / 834 |
| `bioinsumos_inoculantes` | inoculantes: uma linha por produto × cultura | — / 1.239 |

Duas decisões explicam o desenho:

- **O cru fica gravado.** Quando a Embrapa muda o layout, remapeia-se a partir
  de `*_itens` sem baixar tudo de novo.
- **A indicação é explodida.** "Existe produto registrado para antracnose em
  pitaya?" é uma pergunta de cultura × praga; dentro de um jsonb, seria varredura.

`bioinsumos_indicacoes` tem ainda a coluna `todas_as_culturas`: 795 dos 834
produtos estão cadastrados de forma genérica, e sem essa marca a pergunta sobre
pitaya responderia zero em SQL.

## Consultas que o produto precisa

1. Histórico: mensagens por conversa ordenadas por `created_at` — tanto para o contexto do agente quanto para reabrir a conversa na tela.
2. RAG vetorial: `ORDER BY embedding <=> $query LIMIT k` filtrando `embedding IS NOT NULL`.
3. RAG fallback: `WHERE tsv @@ websearch_to_tsquery('portuguese', $q)` com `ts_rank`.
4. Agrofit: `WHERE crops ILIKE '%pitaya%' AND (pests ILIKE '%…%' OR active_ingredient ILIKE '%…%')`.
5. Conversas do usuário ordenadas por atividade recente: `left join` em `messages` agrupado por conversa, ordenado por `max(created_at)` — é o painel "Conversas" do chat.
6. Configuração de LLM em uso: uma leitura de `configuracoes` por resposta, o que faz a troca pelo painel valer sem reiniciar o servidor.

## Migrações

Escritas à mão, aplicadas em ordem por `npm run db:migrate`, todas com
`IF NOT EXISTS` — rodar de novo é seguro.

| Arquivo | O que traz |
| --- | --- |
| `0000_init` | extensões (`pgcrypto`, `vector`, `pg_trgm`) + tabelas do MVP + índices |
| `0001_agrofit_api` | as tabelas da coleta pela API do Agrofit |
| `0002_bioinsumos` | o mesmo desenho para a base Bioinsumos |
| `0003_unaccent` | extensão `unaccent`: "acao" tem que achar "ação" na busca |
| `0004_configuracoes` | `configuracoes`, usada pelo painel de troca de LLM |

Dados entram por scripts separados: `db:seed` (base de conhecimento),
`agrofit:sync` / `bioinsumos:sync` (coleta pela API) e `agrofit:import` (CSV dos
Dados Abertos).

## Riscos

- **Dimensão do embedding fixa (1536)** — trocar de modelo de embedding exige re-ingestão; aceitável no MVP (re-rodar pipeline).
- **Dados abertos Agrofit mudam de layout** — importador isola o mapeamento de colunas; `raw` jsonb preserva o original.
- **tsvector 'portuguese'** não faz stemming perfeito de termos agronômicos — mitigado por trigram nos campos Agrofit e RAG vetorial como via principal.
- Sem auth real no MVP — `users` já em uuid permite evoluir para auth de verdade sem migração destrutiva. As rotas de conversa já conferem o dono e respondem 404 para id alheio, então ligar auth não exige reescrever a regra de acesso.
- **`configuracoes` na frente do `.env`** — quem edita `LLM_PROVIDER` com uma linha `llm` gravada no banco não vê efeito. O painel mostra a origem do que está valendo ("painel" ou ".env") e tem botão para voltar ao ambiente.

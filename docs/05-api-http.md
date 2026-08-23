# Referência da API HTTP

As rotas em `src/app/api/`. Todas respondem JSON e são adaptadores finos: quem
decide é `src/server/` (ver [04-estrutura.md](04-estrutura.md)).

Base local: `http://localhost:3000`.

---

## `POST /api/chat`

Uma rodada de conversa com o agente. É a única rota que consome LLM.

```jsonc
// requisição
{
  "message": "Qual produto é registrado para antracnose em pitaya?",
  "conversationId": "uuid",   // opcional — sem ele, abre uma conversa nova
  "propertyId": "uuid"        // opcional — sem ele, usa a 1ª propriedade do usuário
}
```

```jsonc
// 200
{ "conversationId": "uuid", "text": "…", "sources": [ … ] }
```

| Status | Quando |
| --- | --- |
| 400 | corpo inválido (`message` vazia ou acima de 4000 caracteres) |
| 500 | falha do provedor de LLM ou do banco — a mensagem do erro vem em `error` |

`maxDuration` é 120s: o agente pode encadear várias tools antes de responder.

---

## `GET /api/conversas`

Histórico do usuário, da conversa com mensagem mais recente para a mais antiga
(no máximo 50). É o que alimenta o painel "Conversas" do chat.

```jsonc
// 200
[
  {
    "id": "uuid",
    "title": "Qual produto é registrado para antracnose…",  // a 1ª pergunta
    "criadaEm": "2026-08-23T16:39:34.918Z",
    "ultimaEm": "2026-08-23T16:59:58Z",   // ISO em UTC, já formatado no SQL
    "mensagens": 4
  }
]
```

A conversa só existe depois de uma resposta completa: pergunta que falhou no
provedor não vira entrada no histórico.

---

## `GET /api/conversas/{id}` · `DELETE /api/conversas/{id}`

```jsonc
// GET 200
{
  "id": "uuid",
  "title": "…",
  "propertyId": "uuid | null",
  "mensagens": [
    { "role": "user", "content": "…" },
    { "role": "assistant", "content": "…", "sources": [ … ] }
  ]
}
```

`DELETE` responde `{ "ok": true }` e leva junto as mensagens, por cascata no
banco. As duas rotas conferem o dono: conversa de outro usuário responde 404,
não o conteúdo.

| Status | Quando |
| --- | --- |
| 400 | id que não é uuid |
| 404 | conversa inexistente ou de outro usuário |

---

## `GET /api/llm` · `PUT /api/llm` · `DELETE /api/llm`

Provedor e modelo em uso, e a troca pelo painel do chat. Ver
[08-openrouter.md](08-openrouter.md) e a seção "Trocando de modelo" do README.

```jsonc
// GET 200
{
  "atual": { "provider": "openrouter", "model": "openai/gpt-4o", "origem": "painel" },
  "provedores": [
    {
      "id": "openrouter",
      "rotulo": "OpenRouter",
      "envChave": "OPENROUTER_API_KEY",
      "temChave": true,              // a chave existe no .env
      "modeloPadrao": "openai/gpt-4o",
      "modelos": [ { "id": "…", "rotulo": "…", "nota": "grátis" } ]
    }
  ]
}
```

`PUT` recebe `{ "provider", "model" }` — `model` vazio usa o padrão do
provedor — e grava na tabela `configuracoes`, que tem precedência sobre o
`.env`. `DELETE` apaga essa escolha e devolve o controle ao `.env`. Os dois
respondem o mesmo corpo do `GET`.

`origem` diz quem está mandando: `"painel"` ou `"env"`. Chave de API não entra
nem sai por aqui.

---

## `GET /api/propriedades` · `POST /api/propriedades`

```jsonc
// POST — 201
{ "name": "Sítio", "latitude": -22.9, "longitude": -47.06 }
```

Latitude e longitude são validadas por faixa. `GET` devolve o array das
propriedades do usuário demo do MVP (organização única, sem autenticação).

---

## `GET /api/agrofit`

Busca estruturada na **cópia local** da base Agrofit — sem LLM e sem chamar a
Embrapa. Exige `npm run agrofit:sync` feito ao menos uma vez.

| Parâmetro | Efeito |
| --- | --- |
| `q` | nome do produto ou nº de registro |
| `cultura` | casa em `agrofit_indicacoes` |
| `praga` | nome comum ou científico, na **mesma** indicação da cultura |
| `ingrediente`, `titular`, `classe` | texto, `ILIKE` |
| `bio=1` | só produtos biológicos |
| `organico=1` | só aprovados para agricultura orgânica |
| `pagina` | 1-based (padrão 1) |
| `tamanho` | padrão 25, máximo 100 |

```jsonc
// 200
{
  "total": 5, "pagina": 1, "tamanho": 25, "paginas": 1,
  "temAlvos": true,       // só há coluna de alvos quando veio filtro de cultura
  "itens": [ { "registration": "7723", "product_name": "Alvofix", … } ]
}
```

Cultura e praga casam **na mesma indicação de uso**. Cruzá-las em colunas
agregadas acharia produto registrado para a praga em *outra* cultura.

### `GET /api/agrofit/vocabulario`

`{ culturas, classes, ingredientes, titulares, pragas }` — listas canônicas do
MAPA para autocompletar os filtros. A busca compara o nome exato: "pitaia" não
acha **Pitaya**, e o usuário leria o vazio como "não há produto".

### `GET /api/agrofit/culturas?registro=7723`

`{ registro, culturas: [{ cultura, alvos }] }`. Sob demanda: um produto pode
cobrir mais de cem culturas, e embutir isso na listagem infla tudo para atender
ao punhado de linhas que o usuário abre.

---

## `GET /api/bioinsumos`

Produtos biológicos e inoculantes na **cópia local** da base Bioinsumos — sem
chamar a Embrapa em tempo de request. Exige `npm run bioinsumos:sync` feito ao
menos uma vez.

`aba=produtos` (padrão):

| Parâmetro | Efeito |
| --- | --- |
| `q` | marca comercial ou nº de registro |
| `cultura` | **soma os registrados para "Todas as culturas"** — ver abaixo |
| `praga` | nome comum ou científico, na mesma indicação da cultura |
| `ingrediente`, `titular`, `classe` | substring, sem acento |
| `organico=1` | só aprovados para uso orgânico |

`aba=inoculantes`:

| Parâmetro | Efeito |
| --- | --- |
| `q` | registro do produto ou razão social |
| `cultura`, `especie`, `tipo` | substring, sem acento |
| `uf` | sigla exata |

`pagina` e `tamanho` funcionam como no Agrofit.

```jsonc
// 200 — aba=produtos&cultura=Pitaya
{
  "aba": "produtos",
  "total": 795, "pagina": 1, "tamanho": 25, "paginas": 32,
  "atualizadoEm": "2026-01-19",
  "temAlvos": true,
  "viaTodasAsCulturas": 795,   // quantos casaram só pelo registro genérico
  "baseVazia": false,          // true = a coleta nunca rodou (≠ "não há registro")
  "itens": [ { "numero_registro": "2798", "nome": "Able", "via_todas_as_culturas": true, … } ]
}
```

**O detalhe que a API da Embrapa não resolve:** `cultura=Pitaya` lá devolve
zero, porque 795 dos 834 produtos estão cadastrados como "Todas as culturas".
Esta rota soma os dois e marca cada linha genérica em `via_todas_as_culturas`,
com o total em `viaTodasAsCulturas` — quem consulta precisa saber que o produto
não foi registrado nominalmente para a cultura dele.

Como não há chamada externa, a rota não precisa de credencial: só do banco de
pé e da coleta feita. Falha de banco responde **500**.

### `GET /api/bioinsumos/vocabulario`

`{ culturas, pragas, ingredientes, titulares, classes, especies, ufs, tipos, versao }`.
As quatro primeiras vêm das coleções de vocabulário que a coleta gravou; as
demais são derivadas dos registros, porque a API não as expõe.

### `GET /api/bioinsumos/culturas?registro=2798`

`{ registro, culturas: [{ cultura, alvos }] }`; **404** se o registro não
existir na base carregada.

---

## Testar pela linha de comando

```bash
curl "http://localhost:3000/api/agrofit?cultura=Pitaya&praga=antracnose"
curl "http://localhost:3000/api/bioinsumos?aba=produtos&cultura=Pitaya"
curl "http://localhost:3000/api/bioinsumos?aba=inoculantes&uf=SP"
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Quando faço a poda de formação?"}'

# histórico e configuração de LLM
curl http://localhost:3000/api/conversas
curl http://localhost:3000/api/conversas/<uuid>
curl http://localhost:3000/api/llm
curl -X PUT http://localhost:3000/api/llm \
  -H "Content-Type: application/json" \
  -d '{"provider":"nvidia","model":"nvidia/nemotron-3-super-120b-a12b"}'
```

Para checar a API da Embrapa **sem** passar pela aplicação:
`npm run bioinsumos:test`.

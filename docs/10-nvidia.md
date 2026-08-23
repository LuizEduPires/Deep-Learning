# Cadastrar a chave da NVIDIA

A NVIDIA hospeda uma centena de modelos abertos — Nemotron, Llama, GPT-OSS,
Kimi — e serve todos por uma API compatível com a da OpenAI. No projeto ela é
um dos quatro valores possíveis de `LLM_PROVIDER`, ao lado de `anthropic`,
`openai` e `openrouter`.

Entrou como caminho de **demonstração**: a chave é gratuita, sai em dois
minutos e não pede cartão. Como a cota é por conta e independente da do
OpenRouter, ela também serve de plano B quando a outra acaba no meio de uma
apresentação — e trocar, pelo painel do chat, não exige reiniciar nada.

## 1. Gerar a chave

1. Entre em https://build.nvidia.com e faça login (o cadastro no NVIDIA
   Developer Program é gratuito).
2. Abra qualquer modelo do catálogo — por exemplo
   https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b — e clique em
   **Get API Key**.
3. Copie a chave. Ela começa com `nvapi-`. **Ela só aparece uma vez**; se
   fechar a janela sem copiar, gere outra.

Não é preciso cadastrar cartão. O que a conta ganha é uma cota gratuita de
requisições, renovada periodicamente; a NVIDIA não publica o número exato por
modelo, e o teto aparece na sua própria conta.

## 2. Colar no `.env`

O arquivo é o `.env` da **raiz da pasta principal do projeto**, a mesma de onde
você roda `npm run dev`. Cada worktree em `.claude/worktrees/` tem o seu
próprio `.env`, e o app não lê o do worktree.

```bash
NVIDIA_API_KEY=nvapi-cole-a-sua-chave-aqui
```

Sem aspas, sem espaço em volta do `=`. Depois **reinicie o servidor**: mudança
de `.env` não entra por HMR.

Começando do zero — outra máquina, notebook de apresentação — use o `.env`
mínimo pronto, que tem só banco e NVIDIA:

```bash
cp .env.nvidia.example .env
```

A chave é o único passo que exige o `.env`. Provedor e modelo se escolhem no
painel do chat — o botão com o nome do modelo, no alto à direita —, e o painel
só mostra a NVIDIA como disponível depois que `NVIDIA_API_KEY` existir.

## 3. Escolher o modelo

O painel traz uma lista curada dos modelos que suportam **tool calling**, que é
o que o agente precisa para consultar Agrofit, Bioinsumos, clima e a base de
conhecimento. Sem ferramenta, o modelo responde de memória — exatamente o que
este produto evita.

| Modelo | Quando usar |
|---|---|
| `nvidia/nemotron-3-super-120b-a12b` | padrão: equilíbrio entre qualidade e tempo de resposta |
| `nvidia/nemotron-3-ultra-550b-a55b` | resposta mais bem escrita, mais lenta |
| `nvidia/nemotron-3-nano-30b-a3b` | o mais rápido, para demonstrar o fluxo |
| `openai/gpt-oss-120b`, `moonshotai/kimi-k2.6`, `meta/llama-3.1-70b-instruct` | alternativas com tool calling |

"Outro modelo…" no painel aceita qualquer id. O catálogo inteiro está em
https://build.nvidia.com e a lista viva de ids, sem precisar de chave, em:

```bash
curl -s https://integrate.api.nvidia.com/v1/models | python -c "import json,sys; [print(m['id']) for m in json.load(sys.stdin)['data']]"
```

Essa lista **não** diz quais suportam ferramenta — confira no card do modelo em
build.nvidia.com antes de usar um id que não está na tabela acima. E confira
também a data de descontinuação: o `meta/llama-3.3-70b-instruct`, por exemplo,
sai do ar em 25/08/2026, e por isso ficou fora da lista do painel.

## 4. Validar

```bash
npm run llm:test
```

O script confirma as duas coisas que fazem o chat funcionar — a chave autentica
e o modelo chama ferramenta:

```
Provedor: nvidia | Modelo: nvidia/nemotron-3-super-120b-a12b
  ferramenta chamada com: { cidade: 'Petrolina' }
OK — autenticou e usou tool calling.
```

O `llm:test` usa o que está valendo: se você trocou pelo painel, é o do painel;
senão, o do `.env`.

## Erros comuns

| Mensagem | Causa | O que fazer |
|---|---|---|
| `403 Authorization failed` | Chave errada, revogada, ausente ou com espaço/aspas na linha do `.env` — a NVIDIA responde 403, não 401. Também aparece quando a conta não tem acesso àquele modelo. | Reescreva a linha do `.env`; se persistir com a chave certa, tente outro modelo no painel. |
| `404` | Id do modelo errado ou descontinuado. | Confira na lista viva do passo 3. |
| `429` | Cota gratuita da conta esgotada. | Aguarde a renovação ou troque de provedor no painel. |
| O chat responde sem citar fonte | O modelo não suporta tool calling. | Troque por um da tabela do passo 3. |

Falhas de provedor chegam ao chat traduzidas por `src/server/llm/erros.ts`, com
o nome do provedor e do modelo que estavam valendo na hora.

## Onde isso está no código

- `src/server/llm/nvidia.ts` — monta o cliente com `baseURL` e chave.
- `src/server/llm/openai.ts` — o laço de tool calling, compartilhado: NVIDIA,
  OpenRouter e OpenAI falam o mesmo dialeto Chat Completions.
- `src/server/llm/catalogo.ts` — a lista curada que o painel mostra.
- `src/server/llm/index.ts` — o `switch` do provedor que está valendo.

## Uma limitação

Como o OpenRouter, a NVIDIA não substitui os embeddings: a busca vetorial do
RAG depende de `OPENAI_API_KEY` com saldo próprio. Sem ela, a busca na base de
conhecimento cai para full-text e continua funcionando.

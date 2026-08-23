# Cadastrar a chave do OpenRouter

O OpenRouter é um roteador: uma única chave e uma única fatura dão acesso a
modelos da OpenAI, Anthropic, Google, Meta e outros. No projeto ele é um dos
quatro valores possíveis de `LLM_PROVIDER`, ao lado de `anthropic`, `openai` e
`nvidia` (este último em [10-nvidia.md](10-nvidia.md), também com cota
gratuita).

## 1. Gerar a chave

1. Entre em https://openrouter.ai e faça login (Google, GitHub ou e-mail).
2. Abra https://openrouter.ai/settings/keys.
3. Clique em **Create Key**, dê um nome que identifique a origem — por exemplo
   `ia-pitaya-local` — e confirme.
4. Copie a chave. Ela começa com `sk-or-v1-` seguida de 64 caracteres
   hexadecimais, 73 no total. **Ela só aparece uma vez**; se fechar a janela
   sem copiar, apague e gere outra.

Não é preciso cadastrar cartão para usar os modelos gratuitos.

## 2. Colar no `.env`

A chave vai no arquivo `.env` da **raiz da pasta principal do projeto**, a
mesma de onde você roda `npm run dev`. Cada worktree em `.claude/worktrees/`
tem o seu próprio `.env`, e o app não lê o do worktree.

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-cole-a-sua-chave-aqui
LLM_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
```

Sem aspas, sem espaço antes ou depois do `=`. O `.env` é ignorado pelo git, e
deve continuar assim: a chave nunca vai para o repositório.

Dois campos opcionais identificam o app nos rankings do OpenRouter e não mudam
o funcionamento:

```bash
OPENROUTER_SITE_NAME=IA Pitaya
OPENROUTER_SITE_URL=
```

> **O painel do chat tem precedência sobre estas linhas.** Se você já trocou
> de modelo pelo botão com o nome do modelo, no alto do chat, a escolha ficou
> gravada na tabela `configuracoes` e o `.env` deixou de mandar. Para voltar a
> mandar por aqui, clique em "Usar o do .env" no painel.

## 3. Escolher o modelo

O jeito mais rápido é pelo painel do chat: o botão com o nome do modelo lista
os modelos do OpenRouter direto do catálogo deles, gratuitos primeiro, já
filtrados pelos que suportam tool calling. A troca vale na pergunta seguinte,
sem reiniciar o servidor. O resto desta seção vale para quem prefere o `.env`.

`LLM_MODEL` no OpenRouter leva prefixo de provedor — `openai/gpt-4o`,
`anthropic/claude-sonnet-4.5`, `nvidia/nemotron-3.5-lightning:free`. O catálogo
completo está em https://openrouter.ai/models.

Duas exigências ao trocar:

- **O modelo precisa suportar tool calling.** O agente depende disso para
  consultar Agrofit, Bioinsumos, clima e a base de conhecimento. Sem isso ele
  responde de memória, que é justamente o que este produto evita.
- **Modelos com `:free` no fim não consomem crédito.** Os demais consomem, e
  sem saldo a chamada falha com HTTP 402.

Para listar os modelos gratuitos que suportam ferramentas (o endpoint é
público, não precisa de chave):

```bash
curl -s https://openrouter.ai/api/v1/models | python -c "import json,sys; [print(m['id']) for m in json.load(sys.stdin)['data'] if m['id'].endswith(':free') and 'tools' in (m.get('supported_parameters') or [])]"
```

## 4. Validar

```bash
npm run llm:test
```

O script confirma as duas coisas que fazem o chat funcionar — a chave autentica
e o modelo chama ferramenta:

```
Provedor: openrouter | Modelo: nvidia/nemotron-3-ultra-550b-a55b:free
  ferramenta chamada com: { cidade: 'Petrolina' }
OK — autenticou e usou tool calling.
```

Depois reinicie o servidor, porque mudança de `.env` não entra por HMR (troca
feita pelo painel do chat não precisa reiniciar nada):

```bash
npm run dev
```

## 5. Conferir o saldo

```bash
curl -s https://openrouter.ai/api/v1/credits -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

Retorna `total_credits` e `total_usage`. Com `total_credits: 0` apenas os
modelos `:free` respondem.

## Erros comuns

| Mensagem | Causa | O que fazer |
|---|---|---|
| `401 User not found` | A chave não pertence a nenhuma conta: foi revogada, ou a conta foi apagada. Não é falta de saldo. | Confira se ela aparece em https://openrouter.ai/settings/keys e gere outra. |
| `401` logo após colar | Espaço, quebra de linha ou aspas na linha do `.env`. | Reescreva a linha sem aspas e sem espaço em volta do `=`. |
| `402` | Modelo pago com saldo zerado. | Use um modelo `:free` ou adicione crédito. |
| `429 Rate limit exceeded: free-models-per-day` | Cota diária de modelos gratuitos da **conta** esgotada — com saldo zero são poucas chamadas por dia, e valem para todos os `:free` somados. | Espere a virada do dia (00h UTC / 21h de Brasília), adicione crédito para ampliar a cota, ou troque de provedor no painel. Trocar de modelo `:free` não adianta. |
| `404` | Nome do modelo errado. | Confira o prefixo de provedor em https://openrouter.ai/models. |
| `LLM_PROVIDER inválido` | Valor fora de `anthropic`, `openai`, `openrouter`. | Corrija a grafia no `.env`. |
| Mudei o `.env` e nada mudou | O painel do chat gravou uma escolha, que tem precedência. | Clique em "Usar o do .env" no painel, ou troque por lá mesmo. |
| O chat responde sem citar fonte | O modelo escolhido não suporta tool calling. | Troque por um da lista do passo 3. |
| `504 Upstream idle timeout exceeded` | O provedor por trás do modelo demorou mais que o limite do OpenRouter. Comum em modelo gratuito sob carga. | Repita ou troque `LLM_MODEL`. O OpenRouter devolve esse erro com HTTP 200 e corpo `{error}`, sem `choices`; `llm/openai.ts` detecta e traduz. |

Falhas de provedor chegam ao chat traduzidas por `src/server/llm/erros.ts` — a
mensagem já diz se o caso é chave recusada, saldo, modelo inexistente ou
limite de requisições, em vez do JSON cru da resposta HTTP.

## Onde isso está no código

- `src/server/llm/openrouter.ts` — monta o cliente com `baseURL`, chave e headers.
- `src/server/llm/openai.ts` — o laço de tool calling, compartilhado, porque o
  OpenRouter fala o mesmo dialeto Chat Completions da OpenAI.
- `src/server/llm/index.ts` — o `switch`, lido da configuração que está valendo.
- `src/server/llm/config.ts` — painel (tabela `configuracoes`) na frente do `.env`.
- `src/server/llm/modelos-openrouter.ts` — a lista de modelos que o painel mostra.
- `src/app/api/llm/route.ts` e `src/frontend/config-llm.tsx` — o painel em si.
- `scripts/llm-test.ts` — o teste de fumaça do passo 4.

## Uma limitação

O OpenRouter não serve embeddings. A busca vetorial do RAG depende de
`OPENAI_API_KEY` com saldo próprio; sem ela, a busca na base de conhecimento
cai para full-text e continua funcionando.

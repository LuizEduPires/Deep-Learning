# Como rodar — passo a passo

Runbook para subir o projeto do zero numa máquina que foi desligada. Escrito
depois da primeira carga completa da base Agrofit, com os tropeços que
apareceram de verdade.

---

## O caminho curto

Máquina ligada, Docker Desktop aberto, dois comandos:

```bash
npm run db:up
```

```bash
npm run dev
```

Abra **http://localhost:3000/agrofit**. Pronto — a base já está carregada.

O resto deste documento é para quando algo sair do esperado, ou quando você
quiser atualizar os dados.

---

## 1. Pré-requisitos

| O quê | Como conferir |
| --- | --- |
| Docker Desktop **aberto** | `docker ps` responde sem erro |
| Node 24+ | `node --version` |
| Dependências instaladas | existe a pasta `node_modules` |

Se `docker ps` reclamar de `dockerDesktopLinuxEngine`, o Docker Desktop não está
aberto. Abra pelo menu Iniciar e espere a baleia ficar verde — o banco não sobe
sem ele.

Se faltar `node_modules`:

```bash
npm install
```

---

## 2. Subir o banco

```bash
npm run db:up
```

Confira que o container está de pé:

```bash
docker ps --filter name=pitaya-db
```

**Seus dados continuam lá.** O Postgres grava no volume `iapitaya_pitaya-pgdata`,
que sobrevive a desligar a máquina, reiniciar o Docker e `npm run db:down`.

> A única coisa que apaga tudo é `npm run db:down -- -v`. O `-v` remove o
> volume. Se rodar isso, será preciso refazer a migração e a coleta inteira
> (~7 min). Não use esse comando por hábito.

---

## 3. Migrações

Só é necessário depois de mexer em `banco/migracoes/*.sql` ou num banco novo. É
idempotente — rodar à toa não quebra nada:

```bash
npm run db:migrate
```

---

## 4. Subir a aplicação

```bash
npm run dev
```

| Página | O que é | Precisa de chave? |
| --- | --- | --- |
| http://localhost:3000/agrofit | Busca na base Agrofit | **Não** |
| http://localhost:3000 | Chat da pitaya | **Sim** — ver seção 7 |

---

## 5. Atualizar os dados do Agrofit e do Bioinsumos

As páginas `/agrofit` e `/bioinsumos` leem cópias locais, então cada uma depende
de uma coleta feita ao menos uma vez. A do Bioinsumos é rápida:

```bash
npm run bioinsumos:sync    # ~40s, 834 produtos + 1.239 inoculantes
```

Sem ela, a página `/bioinsumos` avisa que a base está vazia — e é isso mesmo que
deve fazer: mostrar "nenhum resultado" ali daria a entender que não existe
bioinsumo registrado para a cultura consultada.

A do Agrofit é mais longa. Não é preciso no dia a dia: a base local já tem as 18
coleções. O MAPA publica atualizações, então vale re-sincronizar de tempos em
tempos.

```bash
npm run agrofit:sync
```

Leva ~7 minutos e é idempotente — pode rodar quantas vezes quiser. O gargalo são
os 292 mil inserts de indicações de uso, não a API.

Para conferir se veio dado novo antes de gastar os 7 minutos:

```bash
npm run agrofit:sync -- --colecao versao
```

```bash
docker exec pitaya-db psql -U pitaya -d pitaya -c "SELECT payload FROM agrofit_itens WHERE colecao='versao';"
```

O campo `data_ultima_atualizacao` diz de quando é o acervo servido pela API.

> **Atenção:** na última verificação esse campo apontava para **2026-01-19**,
> sete meses atrás, enquanto o portal de Dados Abertos anuncia atualização
> diária. Antes de tratar a base como corrente para registro novo de produto,
> confirme com `cnptia.agrofit@embrapa.br`.

### Renormalizar sem baixar de novo

Se o mapeamento mudar — um sentinela novo descoberto nos dados, um campo que
passa a importar — não precisa rebaixar nada. O payload cru está em
`agrofit_itens`:

```bash
npm run agrofit:sync -- --do-cache
```

Segundos em vez de 7 minutos.

### Coleções isoladas

```bash
npm run agrofit:sync -- --listar
```

```bash
npm run agrofit:sync -- --colecao culturas,pragas
```

---

## 6. Ver o banco

### Adminer — o caminho que funciona sem ajuste

```bash
npm run db:adminer
```

Abra **http://localhost:8081**. O formulário já vem preenchido; só falta a senha:

| Campo | Valor |
| --- | --- |
| Sistema | PostgreSQL |
| Servidor | `db` |
| Usuário | `pitaya` |
| Senha | `pitaya` |
| Base | `pitaya` |

São as credenciais do `banco/docker-compose.yml` — banco local de desenvolvimento, sem
dado sensível. O Adminer é servido do próprio `localhost`, então nenhum bloqueio
de navegador atrapalha.

### Drizzle Studio — mais bonito, mas exige liberar uma permissão

```bash
npm run db:studio
```

Abre em https://local.drizzle.studio. **Atenção:** essa é uma página HTTPS
externa que precisa alcançar o `localhost:4983` da sua máquina, e o Chrome
recente bloqueia isso por padrão — a tela fica presa em *"Connecting to the
Drizzle Kit on localhost:4983"*.

Para liberar: clique no ícone à esquerda da URL (**Informações do site**) e
ative **Acesso à rede local**. Depois recarregue.

No Brave, desligue o Brave Shields para o site. No Safari, é preciso `mkcert`.
Se não quiser mexer nisso, use o Adminer acima — faz o mesmo trabalho.

Guia detalhado, com diagnóstico: [03-drizzle-studio.md](03-drizzle-studio.md).

O Studio precisa continuar rodando no terminal enquanto você o usa; fechar o
terminal derruba a conexão.

### Terminal, sem instalar cliente

```bash
docker exec -it pitaya-db psql -U pitaya -d pitaya
```

Dentro do psql: `\dt` lista tabelas, `\d agrofit_products` descreve uma, `\q` sai.

Consulta rápida de sanidade — deve devolver 18 linhas, todas sem erro:

```bash
docker exec pitaya-db psql -U pitaya -d pitaya -c "SELECT colecao, registros_gravados, ultimo_erro FROM agrofit_colecoes ORDER BY registros_gravados DESC;"
```

---

## 7. Ligar o chat: a chave de LLM

As páginas `/agrofit` e `/bioinsumos` não dependem de LLM — leem a cópia local
no Postgres e funcionam sem chave nenhuma. O chat da página inicial precisa de
**uma** chave, de um dos quatro provedores.

Duas têm cota gratuita, e são o caminho para demonstrar sem custo:

```bash
# NVIDIA — chave gratuita, sem cartão (ver 10-nvidia.md)
NVIDIA_API_KEY=nvapi-...

# OpenRouter — modelos com sufixo :free (ver 08-openrouter.md)
OPENROUTER_API_KEY=sk-or-...
```

As outras duas cobram por uso:

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

Começando do zero, `.env.nvidia.example` já tem o mínimo para rodar só com a
NVIDIA: `cp .env.nvidia.example .env` e cole a chave.

Depois de mexer no `.env`, **reinicie o `npm run dev`** — variável de ambiente
não entra por HMR. Daí em diante, trocar de provedor ou de modelo é clique no
painel do chat (botão com o nome do modelo, no alto à direita), e aí não
precisa reiniciar nada: a escolha vai para a tabela `configuracoes` e vale na
pergunta seguinte. O botão "Usar o do .env" desfaz.

Para conferir que a chave autentica e que o modelo sabe chamar ferramenta — as
duas coisas de que o agente depende:

```bash
npm run llm:test
```

---

## 8. Quando der errado

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `dockerDesktopLinuxEngine ... não pode encontrar` | Docker Desktop fechado | Abrir o Docker Desktop e esperar iniciar |
| `ECONNREFUSED ... 5432` | Banco não subiu | `npm run db:up`, depois `docker ps` |
| `Port 3000 is in use` | Um `npm run dev` já rodando | Fechar o outro terminal, ou `npm run dev -- -p 3001` |
| Página em branco / erro de sintaxe estranho | Bundle velho no navegador | Recarregar com **Ctrl+Shift+R** |
| Drizzle Studio preso em "Connecting to..." | Chrome bloqueia acesso à rede local | Liberar em Informações do site, ou usar o Adminer (seção 6) |
| `Sem credencial da AgroAPI` | `.env` sem as chaves | Conferir `AGROAPI_CONSUMER_KEY` e `AGROAPI_CONSUMER_SECRET` |
| `Falha ao obter token AgroAPI (401)` | Credencial revogada ou errada | Gerar novo par em agroapi.cnptia.embrapa.br |
| Busca não acha uma cultura | Grafia diferente da do MAPA | Escolher da lista do campo — é "Pitaya", não "pitaia" |
| Coleta parou no meio | Queda de rede | Rodar de novo; é idempotente e retoma tudo |
| Chat responde "a conta está sem saldo" ou "cota diária acabou" | Provedor sem crédito ou cota gratuita esgotada | Trocar de provedor no painel do chat; ver 08-openrouter.md e 10-nvidia.md |
| Mudei `LLM_PROVIDER` no `.env` e nada mudou | O painel gravou uma escolha, que tem precedência | "Usar o do .env" no painel, ou trocar por lá mesmo |

Se uma coleção específica falhar, o erro fica registrado:

```bash
docker exec pitaya-db psql -U pitaya -d pitaya -c "SELECT colecao, ultimo_erro FROM agrofit_colecoes WHERE ultimo_erro IS NOT NULL;"
```

---

## 9. Encerrando o dia

Nada é obrigatório — pode simplesmente fechar tudo. Se quiser liberar memória:

```bash
npm run db:down
```

`stop` preserva o volume. No dia seguinte, `npm run db:up` traz tudo de
volta com os dados intactos.

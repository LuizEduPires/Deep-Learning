# Drizzle Studio — como botar para rodar

Guia focado em `https://local.drizzle.studio`. Se der errado, quase sempre é o
navegador bloqueando, não o servidor caído — a seção de diagnóstico separa os
dois casos em 10 segundos.

---

## Como isso funciona (importante para entender a falha)

Não é um site normal. São **duas peças**:

| Peça | Onde roda | O quê |
| --- | --- | --- |
| `drizzle-kit studio` | sua máquina, porta **4983** | servidor que fala com o Postgres |
| `local.drizzle.studio` | servidor da Drizzle, **HTTPS público** | a interface que você vê |

A página pública faz requisições para `http://localhost:4983` **do seu
navegador**. Nada do seu banco sai da sua máquina — mas é uma origem HTTPS
externa acessando a sua rede local, e é exatamente esse padrão que os
navegadores passaram a bloquear.

Por isso o servidor pode estar perfeito e a tela ficar presa mesmo assim.

---

## Passo 1 — subir o servidor

```bash
npm run db:studio
```

Saída esperada:

```
Reading config file 'banco/drizzle.config.ts'
Using 'pg' driver for database querying
Drizzle Studio is up and running on https://local.drizzle.studio
```

**Deixe esse terminal aberto.** Fechar derruba o servidor e a interface para de
funcionar na hora.

O banco precisa estar de pé antes (`npm run db:up`).

---

## Passo 2 — abrir a interface

Abra **https://local.drizzle.studio** no Chrome ou Edge.

Se as tabelas aparecerem, acabou. Se ficar em *"Connecting to the Drizzle Kit on
localhost:4983"*, siga o passo 3.

---

## Passo 3 — liberar o acesso à rede local (Chrome/Edge)

O Chrome recente bloqueia página pública alcançando `localhost` por padrão.

1. Clique no ícone à **esquerda da barra de endereço** (cadeado ou sliders) —
   abre **Informações do site** / *Site information*.
2. Procure **Acesso à rede local** / *Local network access*.
3. Ligue a chave.
4. Recarregue com **Ctrl + Shift + R**.

Se a opção não aparecer nessa lista, tente:

```
chrome://settings/content
```

e procure por rede local / *local network*. Em versões que ainda não têm essa
permissão, o bloqueio costuma ter outra causa — veja o diagnóstico abaixo.

### Brave

Desligue o **Brave Shields** para o site (ícone do leão na barra de endereço).

### Safari

Bloqueia `localhost` de origem externa e não tem chave para liberar. É preciso
gerar certificado local:

```bash
mkcert -install
```

Depois reinicie o Studio. Na prática, no Safari não vale o esforço — use o
Adminer.

---

## Diagnóstico: é o servidor ou o navegador?

Rode isto **enquanto** o `npm run db:studio` está aberto:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4983
```

| Resposta | Significado | O que fazer |
| --- | --- | --- |
| `404` | **Servidor OK.** É o navegador bloqueando | Passo 3 |
| `000` | Servidor não está rodando | Passo 1 |

O `404` na raiz é o normal: aquela porta serve a API do Studio, não uma página.
Não é erro.

---

## Outros problemas

| Sintoma | Causa | Solução |
| --- | --- | --- |
| `Sem config path` / erro ao ler config | Rodou fora da pasta do projeto | `cd` para a raiz do projeto |
| `ECONNREFUSED 5432` | Postgres desligado | `npm run db:up` |
| `Port 4983 is already in use` | Um Studio já aberto | Fechar o outro terminal, ou usar outra porta |
| Tela carrega mas sem tabelas | Config apontando para outro banco | Conferir `DATABASE_URL` no `.env` |
| Studio morre sozinho | Terminal foi fechado | Precisa ficar aberto enquanto usa |

Porta alternativa, se a 4983 estiver ocupada:

```bash
npx drizzle-kit studio --config=banco/drizzle.config.ts --port 4984
```

Flags úteis: `--port`, `--host`, `--config`, `--verbose` (imprime todo SQL que o
Studio executa — bom para entender o que ele está fazendo).

---

## Se não quiser lidar com o bloqueio

O **Adminer** faz o mesmo trabalho e é servido do próprio `localhost`, então não
existe origem cruzada nem permissão para liberar:

```bash
npm run db:adminer
```

Abra **http://localhost:8081**:

| Campo | Valor |
| --- | --- |
| Sistema | PostgreSQL |
| Servidor | `db` |
| Usuário | `pitaya` |
| Senha | `pitaya` |
| Base | `pitaya` |

Menos bonito, zero configuração. Para só olhar dados, resolve.

---

## Aviso sobre escrita

O Studio permite **editar e apagar linhas** direto na interface, sem confirmação
em duas etapas. Na base Agrofit isso é reversível — `npm run agrofit:sync`
reconstrói tudo — mas em `users`, `properties`, `conversations` e `messages`
não há de onde restaurar.

E não use `drizzle-kit push`: ele altera o schema do banco direto, sem deixar
migração registrada em `banco/migracoes/*.sql`. As migrações aqui são escritas à mão e
aplicadas por `npm run db:migrate`.

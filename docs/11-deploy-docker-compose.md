# Deploy com Docker Compose

Na raiz do repositório, copie um dos modelos de configuração e preencha
`POSTGRES_PASSWORD` com uma senha hexadecimal forte e a chave do provedor de
LLM escolhido. `DATABASE_URL` do arquivo continua voltada para o uso local;
o Compose a substitui pela conexão interna com o serviço `db`.

```bash
cp .env.example .env
openssl rand -hex 24
# Cole o resultado em POSTGRES_PASSWORD no .env; configure também a chave de LLM.
docker compose up -d --build
```

Abra `http://localhost:3000`. O Compose inicia PostgreSQL com pgvector, aplica
as migrações, carrega `data/conhecimento/*.md` quando o conteúdo muda e só então
inicia o servidor. Confira com `docker compose ps` e
`docker compose logs -f init app gateway egress-proxy`. A rota `/api/health`
verifica a conexão com o banco. Os dados ficam no volume `pitaya-pgdata`;
`docker compose down` não o remove. O banco e o app não publicam portas no host.

A rede Docker `pitaya` usa `internal: true` e modo de gateway `isolated` (Docker
Engine **28+**). Banco, app e inicializador só entram em redes internas. O
`gateway` publica a porta 3000 no host e encaminha pedidos ao app por
outra rede interna; o `egress-proxy` é o único caminho dos processos Node para
APIs externas. Ele aceita apenas HTTPS para os domínios em
`deploy/egress/allowed-domains.txt` e bloqueia destinos privados. Os dois
proxies têm redes de borda separadas e não estão na rede do banco. As redes de
borda ainda têm conectividade com o host; para isolamento absoluto também
desses proxies, é preciso política de firewall no servidor ou gateways externos.
Confira a rede criada com:

```bash
docker network inspect pitaya --format '{{.Internal}} {{index .Options "com.docker.network.bridge.gateway_mode_ipv4"}}'
# Esperado: true isolated
```

## Acesso pela rede local para testes

O gateway publica **HTTP** em `0.0.0.0:3000` por padrão, acessível pelo IP
do host, por exemplo `http://192.168.1.10:3000`. Contêineres em outras redes
Docker acessam a porta publicada por `http://host.docker.internal:3000` no
Docker Desktop. No Linux, adicione ao serviço cliente no Compose:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

`localhost` dentro desse contêiner aponta para ele próprio. Se quiser limitar
o bind a uma interface específica, ajuste `APP_BIND_ADDRESS` no `.env`; para o
endereço `host.docker.internal` funcionar, mantenha o bind em `0.0.0.0`. A
mesma porta não serve HTTP e HTTPS nesta configuração Nginx. O banco, o app e
o proxy de saída continuam sem portas publicadas no host.

Para testar **HTTPS** ao mesmo tempo, use o serviço opcional `gateway-tls` na
porta `APP_HTTPS_PORT` (3443 por padrão). Gere um certificado de teste para o
IP real do servidor antes de subir o serviço:

```bash
SERVER_IP=192.168.1.10 # substitua pelo IP LAN do servidor
mkdir -p deploy/ingress/certs
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 30 \
  -keyout deploy/ingress/certs/key.pem \
  -out deploy/ingress/certs/cert.pem \
  -subj "/CN=${SERVER_IP}" \
  -addext "subjectAltName=IP:${SERVER_IP},DNS:localhost,DNS:host.docker.internal,IP:127.0.0.1"
chmod 600 deploy/ingress/certs/key.pem
# No .env: mantenha APP_BIND_ADDRESS=0.0.0.0 para acesso de outros contêineres.
docker compose -f compose.yml -f compose.https.yml up -d --build
```

Teste `http://IP_DO_SERVIDOR:3000` e `https://IP_DO_SERVIDOR:3443`; de
outro contêiner, use `host.docker.internal` no lugar de `IP_DO_SERVIDOR`. O
certificado gerado é autoassinado; o navegador mostrará um aviso de confiança.
Para recursos do navegador que exigem conexão segura, talvez seja necessário
confiar no certificado no dispositivo de teste. Para testar a rota de saúde sem
confiar nele:

```bash
curl -k https://IP_DO_SERVIDOR:3443/api/health
```

Restrinja as portas 3000 e 3443 à rede de teste no firewall do servidor: o app
não tem autenticação própria. Fora de `localhost`, recursos do navegador como
ditado por voz exigem HTTPS. Certificados confiáveis devem ser instalados em
um proxy reverso externo para acesso público.

Para acesso externo, coloque um proxy reverso com HTTPS e controle de acesso na
frente do `gateway`; o app ainda não tem autenticação própria. Se esse proxy
estiver em outra máquina, configure `APP_BIND_ADDRESS` e `APP_PORT` no `.env` e
restrinja o acesso à porta. O domínio público em `OPENAI_BASE_URL` entra
automaticamente na lista do proxy de saída. Para outras URLs personalizadas ou para importar CSV de
outro domínio, adicione o host a `deploy/egress/allowed-domains.txt` e reconstrua
a imagem. Somente conexões HTTPS na porta 443 são aceitas.

Para atualizar após mudar o código ou os arquivos de conhecimento, rode
`docker compose up -d --build` novamente. Para recarregar o conhecimento mesmo
sem mudança dos arquivos, use `docker compose run --rm init npm run db:seed`.
As bases locais Agrofit e Bioinsumos começam vazias em um banco novo; com as
credenciais AgroAPI configuradas, carregue-as conforme necessário:

```bash
docker compose run --rm init npm run agrofit:sync
docker compose run --rm init npm run bioinsumos:sync
```

O `banco/docker-compose.yml` continua sendo o banco de desenvolvimento e usa
outro volume. Para backup do volume de deploy, use
`docker compose exec -T db pg_dump -U pitaya pitaya > pitaya.sql`.

## Verificação de acesso com Cloudflare Turnstile

O projeto usa o [widget oficial da Cloudflare](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/):
ele adiciona o token ao formulário de entrada; o servidor valida o token no
[Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
antes de liberar páginas e APIs. Após a validação, o navegador recebe um cookie
assinado, válido por 12 horas. A rota `/api/health` e os arquivos estáticos
continuam acessíveis para o healthcheck e para carregar a tela de verificação.

A função **não interfere no site quando uma ou ambas as chaves estão vazias**. Para
ativá-la, crie um widget Turnstile e preencha no `.env`:

```dotenv
TURNSTILE_SITE_KEY=chave-publica-do-widget
TURNSTILE_SECRET_KEY=chave-secreta-do-widget
TURNSTILE_SESSION_SECRET=
TURNSTILE_HOSTNAME=pitaya.exemplo.com
```

Gere `TURNSTILE_SESSION_SECRET` com o comando abaixo e cole a saída no
`.env`:

```bash
openssl rand -hex 32
```

O hostname é o nome DNS cadastrado no widget, sem `https://` ou porta.
`TURNSTILE_HOSTNAME` também define o host dos redirecionamentos. O esquema
HTTP/HTTPS vem dos cabeçalhos encaminhados pelo gateway. Para testar em IP ou
em uma porta local, deixe `TURNSTILE_HOSTNAME` vazio: nesse caso, os
redirecionamentos usam o host e a porta da requisição pública.

Depois, recrie o app com `docker compose up -d --build` e reinicie o gateway
com `docker compose restart gateway` para carregar a configuração de proxy.
Se usar `compose.https.yml`, reinicie também o serviço TLS com
`docker compose -f compose.yml -f compose.https.yml restart gateway-tls`.

Se faltar uma das chaves do widget, a verificação ficará desativada. Com
ambas preenchidas, `TURNSTILE_SESSION_SECRET` também é obrigatório; se faltar,
a tela mostrará erro de configuração e o conteúdo ficará bloqueado.

Para um widget real, a Cloudflare exige um hostname autorizado; o acesso
apenas por IP LAN não atende a [configuração de hostname](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/).
Para testar temporariamente em IP ou `localhost`, use as
[chaves de teste oficiais](https://developers.cloudflare.com/turnstile/troubleshooting/testing/):

```dotenv
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
TURNSTILE_HOSTNAME=
```

Configure também `TURNSTILE_SESSION_SECRET` para esse teste. Essas chaves não
fornecem proteção real. Com chaves reais, o app valida também o
`hostname` e a `action` retornados pelo Siteverify. As chaves oficiais de teste
dispensam essas duas conferências para funcionar em IP local. O proxy de saída
já permite `challenges.cloudflare.com` para essa verificação. O navegador de
quem visita a página também precisa alcançar esse domínio para carregar o
widget.

O Turnstile filtra acesso automatizado; ele não identifica usuários nem
substitui autenticação quando o conteúdo exigir acesso restrito.


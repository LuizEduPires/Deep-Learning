/**
 * Credencial da AgroAPI (Embrapa — gateway WSO2), compartilhada por todas as
 * APIs do portal: Agrofit, Bioinsumos, ClimAPI, Responde Agro.
 *
 * A mesma aplicação assina várias APIs e o token vale para todas elas, então
 * autenticação mora aqui e não em cada cliente — dois caches de token com a
 * mesma credencial só dobrariam as chamadas a /token.
 *
 * Duas formas de credencial, nesta ordem:
 *   1. AGROAPI_CONSUMER_KEY + AGROAPI_CONSUMER_SECRET — o par que o portal
 *      entrega ao assinar a API. O token é obtido e renovado sozinho.
 *   2. AGROAPI_TOKEN — um bearer já pronto, colado do portal. Expira em ~1h e
 *      não há como renovar; serve para teste rápido.
 */

const BASE_PADRAO = "https://api.cnptia.embrapa.br";

/** Raiz do gateway, sem barra final. Cada API acrescenta o próprio prefixo. */
export function raizAgroApi(): string {
  return (process.env.AGROAPI_BASE_URL ?? BASE_PADRAO).replace(/\/+$/, "");
}

function urlToken(): string {
  return process.env.AGROAPI_TOKEN_URL?.trim() || `${raizAgroApi()}/token`;
}

let cache: { token: string; expiraEm: number } | null = null;

/** Só há renovação automática quando temos o par consumer key/secret. */
export function temClientCredentials(): boolean {
  return Boolean(
    process.env.AGROAPI_CONSUMER_KEY?.trim() &&
      process.env.AGROAPI_CONSUMER_SECRET?.trim(),
  );
}

export function temCredencial(): boolean {
  return temClientCredentials() || Boolean(process.env.AGROAPI_TOKEN?.trim());
}

/** Descarta o token em cache — use ao receber 401 antes de tentar de novo. */
export function invalidarToken(): void {
  cache = null;
}

export async function obterToken(forcarRenovacao = false): Promise<string> {
  if (!forcarRenovacao && cache && Date.now() < cache.expiraEm) return cache.token;

  if (temClientCredentials()) {
    const key = process.env.AGROAPI_CONSUMER_KEY!.trim();
    const secret = process.env.AGROAPI_CONSUMER_SECRET!.trim();
    const basic = Buffer.from(`${key}:${secret}`).toString("base64");

    const res = await fetch(urlToken(), {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      throw new Error(
        `Falha ao obter token AgroAPI (${res.status}): ${corpo.slice(0, 300)}`,
      );
    }

    const dados = (await res.json()) as { access_token: string; expires_in?: number };
    const validade = (dados.expires_in ?? 3600) * 1000;
    // Margem de 60s: um token que vence no meio de uma página vira 401.
    cache = { token: dados.access_token, expiraEm: Date.now() + validade - 60_000 };
    return cache.token;
  }

  const estatico = process.env.AGROAPI_TOKEN?.trim();
  if (estatico) return estatico;

  throw new Error(
    "Sem credencial da AgroAPI. Defina AGROAPI_CONSUMER_KEY e " +
      "AGROAPI_CONSUMER_SECRET (recomendado) ou AGROAPI_TOKEN no .env. " +
      "Cadastro gratuito em https://www.agroapi.cnptia.embrapa.br",
  );
}

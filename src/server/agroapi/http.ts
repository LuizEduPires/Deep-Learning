/**
 * GET paginado no gateway da AgroAPI.
 *
 * Toda coleção do portal é paginada por `page` (1-based). O tamanho da página
 * é decidido pelo servidor e o total vem nos headers X-Records-Count /
 * X-Pages / X-Page-Size — não há `size` para pedir páginas maiores.
 *
 * O prefixo da API ("agrofit/v1", "bioinsumos/v2") entra em cada chamada: o
 * contrato é o mesmo, só muda o caminho.
 */

import { invalidarToken, obterToken, raizAgroApi, temClientCredentials } from "./token";

export interface Pagina<T> {
  itens: T[];
  pagina: number;
  totalPaginas: number;
  totalRegistros: number;
  tamanhoPagina: number;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Uma página de uma coleção. Repete em 429 e 5xx com espera crescente, e
 * renova o token uma vez em 401 — uma coleta inteira leva mais de uma hora e o
 * token vence antes do fim.
 */
export async function buscarPagina<T>(
  api: string,
  caminho: string,
  params: Record<string, string | number> = {},
  tentativas = 5,
): Promise<Pagina<T>> {
  const url = new URL(`${raizAgroApi()}/${api}${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  let ultimoErro = "";
  let renovou = false;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const token = await obterToken(renovou);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(60000),
    });

    if (res.ok) {
      const itens = (await res.json()) as T[];
      const inteiro = (h: string, padrao: number) => {
        const v = Number(res.headers.get(h));
        return Number.isFinite(v) && v > 0 ? v : padrao;
      };
      return {
        itens: Array.isArray(itens) ? itens : [],
        pagina: Number(params.page ?? 1),
        totalPaginas: inteiro("X-Pages", 1),
        totalRegistros: inteiro("X-Records-Count", itens?.length ?? 0),
        tamanhoPagina: inteiro("X-Page-Size", itens?.length ?? 0),
      };
    }

    const corpo = await res.text().catch(() => "");
    ultimoErro = `${res.status} ${res.statusText} ${corpo.slice(0, 200)}`;

    if (res.status === 401 && !renovou && temClientCredentials()) {
      renovou = true;
      invalidarToken();
      continue;
    }

    // 4xx que não seja 401/429 é erro de requisição: repetir não resolve.
    if (res.status < 500 && res.status !== 429) break;

    const retryAfter = Number(res.headers.get("Retry-After"));
    const espera =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(2 ** tentativa * 500, 30_000);
    await dormir(espera);
  }

  throw new Error(`GET ${url.pathname}${url.search} falhou: ${ultimoErro}`);
}

/**
 * Percorre uma coleção inteira, página a página. `pausaMs` espaça as chamadas
 * — o plano gratuito dá 100 mil requisições/mês e não convém torrar cota nem
 * apanhar 429 em sequência.
 */
export async function* paginar<T>(
  api: string,
  caminho: string,
  opcoes: {
    params?: Record<string, string | number>;
    pausaMs?: number;
    aoIniciar?: (total: number, paginas: number) => void;
  } = {},
): AsyncGenerator<Pagina<T>> {
  const { params = {}, pausaMs = 150, aoIniciar } = opcoes;

  const primeira = await buscarPagina<T>(api, caminho, { ...params, page: 1 });
  aoIniciar?.(primeira.totalRegistros, primeira.totalPaginas);
  yield primeira;

  for (let page = 2; page <= primeira.totalPaginas; page++) {
    if (pausaMs > 0) await dormir(pausaMs);
    yield await buscarPagina<T>(api, caminho, { ...params, page });
  }
}

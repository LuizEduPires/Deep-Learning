/**
 * Teste de fumaça da API Bioinsumos (AgroAPI/Embrapa — gateway WSO2).
 *
 *   npm run bioinsumos:test
 *
 * Confere, em ordem: a credencial (token via consumer key/secret), o /health,
 * a /versao, cada coleção listável, a paginação, os filtros de /search/* e a
 * busca por chave. Sai com código 1 se qualquer verificação falhar — serve
 * para rodar antes de escrever código que dependa da API.
 *
 * A Bioinsumos vive em /bioinsumos/v2 e é a mesma base do Agrofit recortada
 * em duas categorias: produtos biológicos (controle de pragas) e inoculantes.
 * Só a v2 está assinável hoje; a v1 responde 403 (Resource forbidden).
 */

const BASE_PADRAO = "https://api.cnptia.embrapa.br";

function raiz(): string {
  return (process.env.AGROAPI_BASE_URL ?? BASE_PADRAO).replace(/\/+$/, "");
}

const base = () => `${raiz()}/bioinsumos/v2`;

// ---------------------------------------------------------------- credencial

/** Mesma ordem de preferência do cliente Agrofit: par key/secret, depois bearer. */
async function obterToken(): Promise<string> {
  const key = process.env.AGROAPI_CONSUMER_KEY?.trim();
  const secret = process.env.AGROAPI_CONSUMER_SECRET?.trim();

  if (key && secret) {
    const url = process.env.AGROAPI_TOKEN_URL?.trim() || `${raiz()}/token`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      throw new Error(`token (${res.status}): ${corpo.slice(0, 300)}`);
    }
    const dados = (await res.json()) as { access_token: string; expires_in?: number };
    console.log(`  token obtido pelo par key/secret (validade ${dados.expires_in ?? "?"}s)`);
    return dados.access_token;
  }

  const estatico = process.env.AGROAPI_TOKEN?.trim();
  if (estatico) {
    console.log("  usando AGROAPI_TOKEN (bearer fixo — expira em ~1h)");
    return estatico;
  }

  throw new Error(
    "Sem credencial. Defina AGROAPI_CONSUMER_KEY e AGROAPI_CONSUMER_SECRET no .env " +
      "e assine a API Bioinsumos em https://www.agroapi.cnptia.embrapa.br/store",
  );
}

// -------------------------------------------------------------------- fetch

interface Resposta {
  status: number;
  itens: unknown[];
  total: number;
  paginas: number;
  tamanhoPagina: number;
  corpo: string;
}

let TOKEN = "";

async function get(
  caminho: string,
  params: Record<string, string | number> = {},
): Promise<Resposta> {
  const url = new URL(`${base()}${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
    signal: AbortSignal.timeout(60000),
  });

  const texto = await res.text();
  let itens: unknown[] = [];
  try {
    const json = JSON.parse(texto);
    itens = Array.isArray(json) ? json : [json];
  } catch {
    // /health devolve 204 sem corpo; erro do gateway devolve XML.
  }
  const inteiro = (h: string) => Number(res.headers.get(h)) || 0;
  return {
    status: res.status,
    itens,
    total: inteiro("X-Records-Count"),
    paginas: inteiro("X-Pages"),
    tamanhoPagina: inteiro("X-Page-Size"),
    corpo: texto.replace(/\s+/g, " ").slice(0, 200),
  };
}

// -------------------------------------------------------------------- placar

let falhas = 0;

function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}

/** As coleções listáveis. /health e /versao ficam de fora (formato próprio). */
const COLECOES = [
  "/produtos-biologicos",
  "/inoculantes",
  "/pragas",
  "/pragas-nomes-comuns",
  "/pragas-nomes-cientificos",
  "/culturas",
  "/ingredientes-ativos",
  "/marcas-comerciais",
  "/titulares-registros",
  "/formulacoes",
  "/modos-acoes",
  "/tecnicas-aplicacoes",
];

/**
 * Filtros de /search/*. O casamento é por substring nos campos de texto livre
 * (ingrediente_ativo, titular_registro) e exato no vocabulário controlado
 * (cultura) — "Todas" não acha "Todas as culturas".
 */
const BUSCAS: Array<[string, Record<string, string>]> = [
  ["/search/produtos-biologicos", { cultura: "Soja" }],
  ["/search/produtos-biologicos", { praga_nome_comum: "Mosca-branca" }],
  ["/search/produtos-biologicos", { praga_nome_cientifico: "Bemisia tabaci" }],
  ["/search/produtos-biologicos", { ingrediente_ativo: "Bacillus" }],
  ["/search/produtos-biologicos", { marca_comercial: "Dipel" }],
  ["/search/produtos-biologicos", { titular_registro: "Sumitomo" }],
  ["/search/produtos-biologicos", { cultura: "Soja", praga_nome_comum: "Percevejo" }],
  ["/search/inoculantes", { cultura: "Soja" }],
  ["/search/inoculantes", { uf: "SP" }],
  ["/search/inoculantes", { especie: "Bradyrhizobium" }],
];

async function main() {
  console.log(`\nAPI Bioinsumos — ${base()}\n`);

  console.log("credencial");
  TOKEN = await obterToken();

  console.log("\nserviço");
  const health = await get("/health");
  checar("/health", health.status === 204 || health.status === 200, `HTTP ${health.status}`);

  const versao = await get("/versao");
  const v = versao.itens[0] as Record<string, unknown> | undefined;
  checar("/versao", versao.status === 200 && Boolean(v), `HTTP ${versao.status}`);
  if (v) {
    console.log(
      `       produtos biológicos: ${v.total_produtos_biologicos} ` +
        `(atualizado em ${v.data_ultima_atualizacao_produtos_biologicos})\n` +
        `       inoculantes:         ${v.total_inoculantes} ` +
        `(atualizado em ${v.data_ultima_atualizacao_inoculantes})`,
    );
  }

  console.log("\ncoleções");
  for (const caminho of COLECOES) {
    const r = await get(caminho);
    checar(
      caminho,
      r.status === 200 && r.itens.length > 0,
      r.status === 200
        ? `${r.total} registros / ${r.paginas} página(s) de ${r.tamanhoPagina}`
        : r.corpo,
    );
  }

  console.log("\npaginação");
  // Página 2 tem de trazer registros diferentes da 1 — se o `page` for
  // ignorado, a coleta inteira viraria a primeira página repetida.
  const p1 = await get("/produtos-biologicos", { page: 1 });
  const p2 = await get("/produtos-biologicos", { page: 2 });
  const chave = (x: unknown) => (x as { numero_registro?: string }).numero_registro;
  const distintas =
    p1.itens.length > 0 && p2.itens.length > 0 && chave(p1.itens[0]) !== chave(p2.itens[0]);
  checar("page=1 difere de page=2", distintas, `${chave(p1.itens[0])} vs ${chave(p2.itens[0])}`);
  checar(
    "X-Pages coerente",
    p1.paginas === Math.ceil(p1.total / (p1.tamanhoPagina || 1)),
    `${p1.total} / ${p1.tamanhoPagina} = ${p1.paginas}`,
  );

  console.log("\nfiltros (/search/*)");
  const semFiltro = await get("/search/produtos-biologicos");
  for (const [caminho, params] of BUSCAS) {
    const r = await get(caminho, params);
    const q = Object.entries(params)
      .map(([k, val]) => `${k}=${val}`)
      .join("&");
    // Filtro que devolve a coleção inteira é filtro ignorado, não filtro que casa tudo.
    const filtrou = r.status === 200 && r.total > 0 && r.total < semFiltro.total;
    checar(`${caminho}?${q}`, filtrou, `${r.total} registros`);
  }
  // Parâmetro desconhecido é silenciosamente ignorado pelo gateway: registre o
  // fato para que ninguém confie num filtro com nome errado.
  const invalido = await get("/search/produtos-biologicos", { xpto: "1" });
  checar(
    "parâmetro desconhecido é ignorado (não filtra)",
    invalido.total === semFiltro.total,
    `${invalido.total} registros — nome de filtro errado passa batido`,
  );

  console.log("\nbusca por chave");
  const umProduto = p1.itens[0] as { numero_registro?: string };
  const porRegistro = await get(`/produtos-biologicos/${umProduto.numero_registro}`);
  checar(
    `/produtos-biologicos/${umProduto.numero_registro}`,
    porRegistro.status === 200 && porRegistro.itens.length === 1,
    `${porRegistro.itens.length} registro(s)`,
  );

  const inoc = (await get("/inoculantes", { page: 1 })).itens[0] as {
    registro_produto?: string;
  };
  const porProduto = await get(`/inoculantes/${inoc.registro_produto}`);
  checar(
    `/inoculantes/${inoc.registro_produto}`,
    porProduto.status === 200 && porProduto.itens.length >= 1,
    `${porProduto.itens.length} registro(s)`,
  );

  console.log("\npitaya");
  // A cultura existe no vocabulário mas não tem bioinsumo registrado só para
  // ela: o que serve à pitaya está sob "Todas as culturas". Filtrar apenas por
  // cultura=Pitaya devolve zero e dá a impressão errada de que não há nada.
  const temPitaya = (await get("/culturas")).itens.some(
    (c) => (c as { nome?: string }).nome === "Pitaya",
  );
  checar("Pitaya no vocabulário /culturas", temPitaya);
  const pitaya = await get("/search/produtos-biologicos", { cultura: "Pitaya" });
  const todas = await get("/search/produtos-biologicos", { cultura: "Todas as culturas" });
  console.log(
    `       cultura=Pitaya: ${pitaya.total} · cultura="Todas as culturas": ${todas.total}\n` +
      `       -> a consulta para pitaya precisa somar as duas.`,
  );

  console.log(
    falhas === 0
      ? "\nTodas as verificações passaram.\n"
      : `\n${falhas} verificação(ões) falharam.\n`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(`\nErro: ${erro instanceof Error ? erro.message : erro}\n`);
  process.exit(1);
});

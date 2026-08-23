/**
 * Baixa a base Agrofit inteira da API (AgroAPI/Embrapa) para o Postgres local.
 *
 *   npm run agrofit:sync                          # todas as coleções
 *   npm run agrofit:sync -- --listar              # só mostra o que existe
 *   npm run agrofit:sync -- --colecao produtos-formulados,culturas
 *   npm run agrofit:sync -- --pausa 300           # ms entre requisições
 *   npm run agrofit:sync -- --do-cache            # renormaliza sem chamar a API
 *
 * O payload cru de cada item vai para agrofit_itens (nada se perde). Produtos
 * formulados são, além disso, normalizados em agrofit_products e
 * agrofit_indicacoes — as tabelas que a tool do agente consulta.
 *
 * Cada coleção é independente: se uma falhar, o erro fica registrado em
 * agrofit_colecoes e as outras continuam. Rodar de novo é idempotente.
 */
import { Pool, type PoolClient } from "pg";
import {
  COLECOES,
  paginar,
  temCredencial,
  juntar,
  hashCurto,
  nomesComuns,
  nomeLimpo,
  type Colecao,
  type ProdutoFormulado,
} from "../src/server/agrofit/api";

// ------------------------------------------------------------------- opções

function opcoes() {
  const args = process.argv.slice(2);
  const valor = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const filtro = valor("--colecao")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    listar: args.includes("--listar"),
    doCache: args.includes("--do-cache"),
    pausaMs: Number(valor("--pausa") ?? 150),
    colecoes: filtro?.length
      ? COLECOES.filter((c) => filtro.includes(c.nome))
      : COLECOES,
    desconhecidas:
      filtro?.filter((f) => !COLECOES.some((c) => c.nome === f)) ?? [],
  };
}

// ------------------------------------------------------------------ gravação

/**
 * Grava uma página de itens crus. Reexecução sobrescreve o payload anterior.
 *
 * `usadas` acumula as chaves já vistas nesta coleta. A API repete a chave
 * natural em registros que são de fato distintos — a mesma espécie com outra
 * lista de culturas, por exemplo — e um INSERT com a chave repetida derruba a
 * página inteira ("ON CONFLICT DO UPDATE cannot affect row a second time").
 * O desempate é o hash do payload: determinístico, então a reexecução cai na
 * mesma chave. Repetição de payload idêntico é descartada.
 */
async function gravarItens(
  cliente: PoolClient,
  colecao: Colecao,
  itens: Record<string, unknown>[],
  usadas: Set<string>,
): Promise<number> {
  const paraGravar: { chave: string; item: Record<string, unknown> }[] = [];
  for (const item of itens) {
    const natural = colecao.chave(item);
    const chave = usadas.has(natural) ? `${natural}#${hashCurto(item)}` : natural;
    if (usadas.has(chave)) continue;
    usadas.add(chave);
    paraGravar.push({ chave, item });
  }
  if (paraGravar.length === 0) return 0;

  const valores: unknown[] = [];
  const linhas = paraGravar.map(({ chave, item }, i) => {
    valores.push(colecao.nome, chave, JSON.stringify(item));
    return `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3}::jsonb, now())`;
  });

  const { rowCount } = await cliente.query(
    `INSERT INTO agrofit_itens (colecao, chave, payload, sincronizado_em)
     VALUES ${linhas.join(", ")}
     ON CONFLICT (colecao, chave) DO UPDATE SET
       payload = EXCLUDED.payload,
       sincronizado_em = now()`,
    valores,
  );
  return rowCount ?? 0;
}

/**
 * Normaliza um produto formulado. `crops` e `pests` continuam existindo como
 * texto agregado porque a tool antiga e os índices trigram dependem deles,
 * mas a consulta precisa passa a ser agrofit_indicacoes.
 */
async function normalizarProduto(cliente: PoolClient, p: ProdutoFormulado) {
  const registro = p.numero_registro?.trim();
  if (!registro) return false;

  const indicacoes = p.indicacao_uso ?? [];
  const culturas = [...new Set(indicacoes.map((i) => i.cultura).filter(Boolean))];
  const pragas = [
    ...new Set(
      indicacoes.flatMap((i) => [
        ...nomesComuns(i.praga_nome_comum),
        nomeLimpo(i.praga_nome_cientifico),
      ]),
    ),
  ].filter(Boolean);

  await cliente.query(
    `INSERT INTO agrofit_products
       (registration, product_name, active_ingredient, product_class, crops,
        pests, holder, toxicological_class, environmental_class, formulacao,
        modo_acao, tecnica_aplicacao, produto_biologico, agricultura_organica,
        inflamavel, corrosivo, url_agrofit, fonte, raw, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'api',$18::jsonb, now())
     ON CONFLICT (registration) DO UPDATE SET
       product_name = EXCLUDED.product_name,
       active_ingredient = EXCLUDED.active_ingredient,
       product_class = EXCLUDED.product_class,
       crops = EXCLUDED.crops,
       pests = EXCLUDED.pests,
       holder = EXCLUDED.holder,
       toxicological_class = EXCLUDED.toxicological_class,
       environmental_class = EXCLUDED.environmental_class,
       formulacao = EXCLUDED.formulacao,
       modo_acao = EXCLUDED.modo_acao,
       tecnica_aplicacao = EXCLUDED.tecnica_aplicacao,
       produto_biologico = EXCLUDED.produto_biologico,
       agricultura_organica = EXCLUDED.agricultura_organica,
       inflamavel = EXCLUDED.inflamavel,
       corrosivo = EXCLUDED.corrosivo,
       url_agrofit = EXCLUDED.url_agrofit,
       fonte = 'api',
       raw = EXCLUDED.raw,
       updated_at = now()`,
    [
      registro,
      juntar(p.marca_comercial) || registro,
      juntar(p.ingrediente_ativo) || null,
      juntar(p.classe_categoria_agronomica) || null,
      culturas.join(" | ") || null,
      pragas.join(" | ") || null,
      p.titular_registro ?? null,
      p.classificacao_toxicologica ?? null,
      p.classificacao_ambiental ?? null,
      p.formulacao ?? null,
      juntar(p.modo_acao) || null,
      juntar(p.tecnica_aplicacao) || null,
      p.produto_biologico ?? null,
      p.produto_agricultura_organica ?? null,
      p.inflamavel ?? null,
      p.corrosivo ?? null,
      p.url_agrofit ?? null,
      JSON.stringify(p),
    ],
  );

  // Apagar antes de inserir: uma indicação retirada pelo Mapa tem que sumir
  // daqui também — ON CONFLICT sozinho deixaria a linha velha para trás.
  await cliente.query("DELETE FROM agrofit_indicacoes WHERE registration = $1", [
    registro,
  ]);

  for (const ind of indicacoes) {
    const cultura = ind.cultura?.trim();
    if (!cultura) continue;
    // Sem nome comum a linha ainda vale: o nome científico é pesquisável.
    const comuns = nomesComuns(ind.praga_nome_comum);
    const nomes = comuns.length > 0 ? comuns : [""];
    for (const comum of nomes) {
      await cliente.query(
        `INSERT INTO agrofit_indicacoes
           (registration, cultura, praga_nome_cientifico, praga_nome_comum)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [registro, cultura, nomeLimpo(ind.praga_nome_cientifico), comum],
      );
    }
  }

  return true;
}

/**
 * Reconstrói agrofit_products e agrofit_indicacoes a partir do payload cru já
 * gravado, sem tocar na API. É o retorno concreto de guardar o cru: quando o
 * mapeamento muda — um sentinela novo descoberto nos dados, um campo que passa
 * a importar — corrigir custa segundos em vez de rebaixar 4.252 produtos.
 */
async function renormalizarDoCache(pool: Pool) {
  const cliente = await pool.connect();
  const LOTE = 200;
  let processados = 0;

  try {
    const { rows: contagem } = await cliente.query<{ n: string }>(
      "SELECT count(*) AS n FROM agrofit_itens WHERE colecao = 'produtos-formulados'",
    );
    const total = Number(contagem[0].n);
    if (total === 0) {
      throw new Error(
        "Não há produtos formulados no cache. Rode a coleta primeiro: npm run agrofit:sync",
      );
    }
    console.log(`\n▸ renormalizando ${total} produto(s) do cache local`);

    for (let offset = 0; offset < total; offset += LOTE) {
      const { rows } = await cliente.query<{ payload: ProdutoFormulado }>(
        `SELECT payload FROM agrofit_itens
          WHERE colecao = 'produtos-formulados'
          ORDER BY chave LIMIT $1 OFFSET $2`,
        [LOTE, offset],
      );

      await cliente.query("BEGIN");
      for (const r of rows) {
        if (await normalizarProduto(cliente, r.payload)) processados++;
      }
      await cliente.query("COMMIT");
      console.log(`  ${Math.min(offset + LOTE, total)}/${total}`);
    }

    console.log(`  ✓ ${processados} produto(s) renormalizado(s)`);
  } catch (err) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
}

// -------------------------------------------------------------------- coleta

async function sincronizar(pool: Pool, colecao: Colecao, pausaMs: number) {
  const cliente = await pool.connect();
  const usadas = new Set<string>();
  let gravados = 0;
  let normalizados = 0;
  let totalApi: number | null = null;
  let paginas: number | null = null;

  try {
    process.stdout.write(`\n▸ ${colecao.nome}\n`);

    for await (const pagina of paginar<Record<string, unknown>>(colecao.caminho, {
      pausaMs,
      aoIniciar: (total, nPaginas) => {
        totalApi = total;
        paginas = nPaginas;
        console.log(
          `  ${total} registro(s) em ${nPaginas} página(s) de ${
            total && nPaginas ? Math.ceil(total / nPaginas) : "?"
          }`,
        );
      },
    })) {
      await cliente.query("BEGIN");
      const nesta = await gravarItens(cliente, colecao, pagina.itens, usadas);

      let normalizadosNesta = 0;
      if (colecao.nome === "produtos-formulados") {
        for (const item of pagina.itens) {
          if (await normalizarProduto(cliente, item as ProdutoFormulado)) {
            normalizadosNesta++;
          }
        }
      }
      await cliente.query("COMMIT");

      // Só depois do COMMIT: contar antes faria o relatório mentir sobre uma
      // página que o ROLLBACK desfez.
      gravados += nesta;
      normalizados += normalizadosNesta;

      if (pagina.pagina % 10 === 0 || pagina.pagina === pagina.totalPaginas) {
        console.log(
          `  página ${pagina.pagina}/${pagina.totalPaginas} — ${gravados} item(ns)`,
        );
      }
    }

    await cliente.query(
      `INSERT INTO agrofit_colecoes
         (colecao, registros_api, registros_gravados, paginas, ultimo_erro, sincronizado_em)
       VALUES ($1,$2,$3,$4,NULL,now())
       ON CONFLICT (colecao) DO UPDATE SET
         registros_api = EXCLUDED.registros_api,
         registros_gravados = EXCLUDED.registros_gravados,
         paginas = EXCLUDED.paginas,
         ultimo_erro = NULL,
         sincronizado_em = now()`,
      [colecao.nome, totalApi, gravados, paginas],
    );

    const aviso =
      totalApi != null && gravados < totalApi
        ? `  ⚠ a API declarou ${totalApi} e chegaram ${gravados} — pode haver chave repetida na coleção`
        : "";
    console.log(
      `  ✓ ${gravados} item(ns)` +
        (normalizados ? `, ${normalizados} produto(s) normalizado(s)` : "") +
        (aviso ? `\n${aviso}` : ""),
    );

    return { ok: true as const, gravados, normalizados };
  } catch (err) {
    await cliente.query("ROLLBACK").catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${msg}`);
    await cliente
      .query(
        `INSERT INTO agrofit_colecoes
           (colecao, registros_gravados, ultimo_erro, sincronizado_em)
         VALUES ($1,$2,$3,now())
         ON CONFLICT (colecao) DO UPDATE SET
           registros_gravados = EXCLUDED.registros_gravados,
           ultimo_erro = EXCLUDED.ultimo_erro,
           sincronizado_em = now()`,
        [colecao.nome, gravados, msg.slice(0, 500)],
      )
      .catch(() => {});
    return { ok: false as const, gravados, normalizados, erro: msg };
  } finally {
    cliente.release();
  }
}

// ---------------------------------------------------------------------- main

async function main() {
  const opts = opcoes();

  if (opts.desconhecidas.length > 0) {
    throw new Error(
      `Coleção desconhecida: ${opts.desconhecidas.join(", ")}.\n` +
        `Disponíveis: ${COLECOES.map((c) => c.nome).join(", ")}`,
    );
  }

  if (opts.listar) {
    console.log("Coleções da API Agrofit:");
    for (const c of COLECOES) console.log(`  ${c.nome.padEnd(32)} GET ${c.caminho}`);
    return;
  }

  // Renormalização não fala com a API: roda antes da checagem de credencial.
  if (opts.doCache) {
    const pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ?? "postgres://pitaya:pitaya@localhost:5432/pitaya",
    });
    try {
      await renormalizarDoCache(pool);
      const { rows } = await pool.query<{ n: string }>(
        "SELECT count(*) AS n FROM agrofit_indicacoes WHERE cultura ILIKE '%pitaya%'",
      );
      console.log(`Indicações de uso para pitaya: ${rows[0].n}`);
    } finally {
      await pool.end();
    }
    return;
  }

  if (!temCredencial()) {
    throw new Error(
      "Sem credencial da AgroAPI.\n" +
        "  1. Cadastre-se em https://www.agroapi.cnptia.embrapa.br e assine a API AGROFIT\n" +
        "     (plano Gratuito100KPorMes: 100 mil requisições/mês).\n" +
        "  2. Copie a Consumer Key e a Consumer Secret da aplicação.\n" +
        "  3. No .env: AGROAPI_CONSUMER_KEY=... e AGROAPI_CONSUMER_SECRET=...\n\n" +
        "Sem credencial, use o dump dos Dados Abertos: npm run agrofit:import",
    );
  }

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://pitaya:pitaya@localhost:5432/pitaya",
  });

  const inicio = Date.now();
  const falhas: string[] = [];
  let total = 0;

  for (const colecao of opts.colecoes) {
    const r = await sincronizar(pool, colecao, opts.pausaMs);
    total += r.gravados;
    if (!r.ok) falhas.push(colecao.nome);
  }

  const minutos = ((Date.now() - inicio) / 60000).toFixed(1);
  console.log(
    `\n${total} item(ns) gravado(s) em ${opts.colecoes.length} coleção(ões), ${minutos} min.`,
  );

  const { rows } = await pool.query<{ n: string }>(
    "SELECT count(*) AS n FROM agrofit_indicacoes WHERE cultura ILIKE '%pitaya%'",
  );
  console.log(`Indicações de uso para pitaya: ${rows[0].n}`);
  if (rows[0].n === "0") {
    console.log(
      "  Zero é um resultado esperado — a pitaya tem pouquíssimo registro no Mapa.\n" +
        "  O agente informa a ausência em vez de sugerir produto de outra cultura.",
    );
  }

  if (falhas.length > 0) {
    console.error(`\nColeções com erro: ${falhas.join(", ")}`);
    console.error("Detalhe em: SELECT colecao, ultimo_erro FROM agrofit_colecoes;");
  }

  await pool.end();
  if (falhas.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`\nErro: ${err.message}`);
  process.exit(1);
});

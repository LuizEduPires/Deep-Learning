/**
 * Coleta a base Bioinsumos (AgroAPI/Embrapa) para o Postgres local.
 *
 *   npm run bioinsumos:sync                    # tudo
 *   npm run bioinsumos:sync -- --listar        # só mostra as coleções
 *   npm run bioinsumos:sync -- --colecao produtos-biologicos,inoculantes
 *   npm run bioinsumos:sync -- --pausa 300     # ms entre requisições
 *   npm run bioinsumos:sync -- --do-cache      # renormaliza sem chamar a API
 *
 * A base é pequena (~2 mil registros, 22 requisições), então a coleta inteira
 * leva menos de um minuto. Depois disso os dados ficam visíveis no Drizzle
 * Studio e consultáveis em SQL.
 *
 * Rodar de novo é idempotente: as chaves são determinísticas.
 */
import { Pool, type PoolClient } from "pg";
import {
  COLECOES,
  TODAS_AS_CULTURAS,
  paginarColecao,
  temCredencial,
  type Colecao,
  type Inoculante,
  type ProdutoBiologico,
} from "../src/server/bioinsumos/api";
import { juntar, nomeLimpo, nomesComuns } from "../src/server/agroapi/sentinelas";

// ------------------------------------------------------------------- opções

function opcoes() {
  const args = process.argv.slice(2);
  const valor = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const conhecidas = ["--listar", "--colecao", "--pausa", "--do-cache"];
  return {
    listar: args.includes("--listar"),
    doCache: args.includes("--do-cache"),
    colecoes: valor("--colecao")?.split(",").map((s) => s.trim()).filter(Boolean),
    pausaMs: Number(valor("--pausa") ?? 150),
    desconhecidas: args.filter(
      (a) => a.startsWith("--") && !conhecidas.includes(a),
    ),
  };
}

// ------------------------------------------------------------------ gravação

/**
 * Hash curto e determinístico do payload, para desempatar registros que
 * compartilham a chave natural. Reexecutar cai na mesma chave.
 */
function hashCurto(valor: unknown): string {
  const s = JSON.stringify(valor);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Grava a página no cru. `usadas` acumula as chaves já vistas nesta coleta:
 * um INSERT com a chave repetida derruba a página inteira ("ON CONFLICT DO
 * UPDATE cannot affect row a second time").
 */
async function gravarItens(
  cliente: PoolClient,
  colecao: Colecao,
  itens: Record<string, unknown>[],
  usadas: Set<string>,
): Promise<{ chave: string; item: Record<string, unknown> }[]> {
  const paraGravar: { chave: string; item: Record<string, unknown> }[] = [];
  for (const item of itens) {
    const natural = colecao.chave(item);
    const chave = usadas.has(natural) ? `${natural}#${hashCurto(item)}` : natural;
    if (usadas.has(chave)) continue;
    usadas.add(chave);
    paraGravar.push({ chave, item });
  }
  if (paraGravar.length === 0) return [];

  const valores: unknown[] = [];
  const linhas = paraGravar.map(({ chave, item }, i) => {
    valores.push(colecao.nome, chave, JSON.stringify(item));
    return `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3}::jsonb, now())`;
  });

  await cliente.query(
    `INSERT INTO bioinsumos_itens (colecao, chave, payload, sincronizado_em)
     VALUES ${linhas.join(", ")}
     ON CONFLICT (colecao, chave) DO UPDATE SET
       payload = EXCLUDED.payload,
       sincronizado_em = now()`,
    valores,
  );
  return paraGravar;
}

// --------------------------------------------------------------- normalizar

async function normalizarProduto(cliente: PoolClient, p: ProdutoBiologico) {
  const registro = p.numero_registro?.trim();
  if (!registro) return false;

  await cliente.query(
    `INSERT INTO bioinsumos_produtos
       (numero_registro, marca_comercial, titular_registro, classe_categoria,
        formulacao, ingrediente_ativo, modo_acao, tecnica_aplicacao,
        classificacao_toxicologica, classificacao_ambiental,
        agricultura_organica, inflamavel, corrosivo, url_agrofit,
        payload, sincronizado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,now())
     ON CONFLICT (numero_registro) DO UPDATE SET
       marca_comercial = EXCLUDED.marca_comercial,
       titular_registro = EXCLUDED.titular_registro,
       classe_categoria = EXCLUDED.classe_categoria,
       formulacao = EXCLUDED.formulacao,
       ingrediente_ativo = EXCLUDED.ingrediente_ativo,
       modo_acao = EXCLUDED.modo_acao,
       tecnica_aplicacao = EXCLUDED.tecnica_aplicacao,
       classificacao_toxicologica = EXCLUDED.classificacao_toxicologica,
       classificacao_ambiental = EXCLUDED.classificacao_ambiental,
       agricultura_organica = EXCLUDED.agricultura_organica,
       inflamavel = EXCLUDED.inflamavel,
       corrosivo = EXCLUDED.corrosivo,
       url_agrofit = EXCLUDED.url_agrofit,
       payload = EXCLUDED.payload,
       sincronizado_em = now()`,
    [
      registro,
      juntar(p.marca_comercial) || registro,
      p.titular_registro ?? null,
      juntar(p.classe_categoria_agronomica) || null,
      p.formulacao ?? null,
      juntar(p.ingrediente_ativo) || null,
      juntar(p.modo_acao) || null,
      juntar(p.tecnica_aplicacao) || null,
      p.classificacao_toxicologica ?? null,
      p.classificacao_ambiental ?? null,
      p.produto_agricultura_organica ?? null,
      p.inflamavel ?? null,
      p.corrosivo ?? null,
      p.url_agrofit ?? null,
      JSON.stringify(p),
    ],
  );

  // Apagar antes de reinserir: uma indicação removida na origem tem de sumir
  // daqui também — ON CONFLICT sozinho deixaria a linha velha para trás.
  await cliente.query("DELETE FROM bioinsumos_indicacoes WHERE numero_registro = $1", [
    registro,
  ]);

  for (const i of p.indicacao_uso ?? []) {
    const cultura = i.cultura?.trim();
    if (!cultura) continue;
    const cientifico = nomeLimpo(i.praga_nome_cientifico);
    const comuns = nomesComuns(i.praga_nome_comum);
    const todas = cultura.toLowerCase() === TODAS_AS_CULTURAS.toLowerCase();

    // Sem nome comum, grava a linha mesmo assim: cultura registrada sem alvo
    // específico continua sendo registro válido.
    for (const comum of comuns.length ? comuns : [""]) {
      await cliente.query(
        `INSERT INTO bioinsumos_indicacoes
           (numero_registro, cultura, praga_nome_cientifico, praga_nome_comum, todas_as_culturas)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [registro, cultura, cientifico, comum, todas],
      );
    }
  }
  return true;
}

/** A API entrega "2022-01-13"; qualquer coisa fora disso vira NULL. */
const dataOuNulo = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;

async function normalizarInoculante(
  cliente: PoolClient,
  chave: string,
  i: Inoculante,
) {
  const registro = i.registro_produto?.trim();
  if (!registro) return false;

  await cliente.query(
    `INSERT INTO bioinsumos_inoculantes
       (chave, registro_produto, razao_social, uf, atividade, tipo, especie,
        cultura, cultura_nome_cientifico, garantia, natureza_fisica,
        data_registro, payload, sincronizado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,now())
     ON CONFLICT (chave) DO UPDATE SET
       registro_produto = EXCLUDED.registro_produto,
       razao_social = EXCLUDED.razao_social,
       uf = EXCLUDED.uf,
       atividade = EXCLUDED.atividade,
       tipo = EXCLUDED.tipo,
       especie = EXCLUDED.especie,
       cultura = EXCLUDED.cultura,
       cultura_nome_cientifico = EXCLUDED.cultura_nome_cientifico,
       garantia = EXCLUDED.garantia,
       natureza_fisica = EXCLUDED.natureza_fisica,
       data_registro = EXCLUDED.data_registro,
       payload = EXCLUDED.payload,
       sincronizado_em = now()`,
    [
      chave,
      registro,
      i.razao_social ?? null,
      i.uf ?? null,
      i.atividade ?? null,
      i.tipo ?? null,
      juntar(i.especie) || null,
      i.cultura ?? null,
      i.cultura_nome_cientifico ?? null,
      i.garantia ?? null,
      i.natureza_fisica ?? null,
      dataOuNulo(i.data_registro),
      JSON.stringify(i),
    ],
  );
  return true;
}

/**
 * Reconstrói as tabelas normalizadas a partir do cru já gravado. Use quando o
 * mapeamento mudar — leva segundos em vez de rebaixar tudo.
 */
async function renormalizarDoCache(pool: Pool) {
  const cliente = await pool.connect();
  try {
    const { rows: produtos } = await cliente.query<{ payload: ProdutoBiologico }>(
      "SELECT payload FROM bioinsumos_itens WHERE colecao = 'produtos-biologicos'",
    );
    let nProdutos = 0;
    await cliente.query("BEGIN");
    for (const r of produtos) {
      if (await normalizarProduto(cliente, r.payload)) nProdutos++;
    }
    await cliente.query("COMMIT");

    const { rows: inoculantes } = await cliente.query<{
      chave: string;
      payload: Inoculante;
    }>("SELECT chave, payload FROM bioinsumos_itens WHERE colecao = 'inoculantes'");
    let nInoculantes = 0;
    await cliente.query("BEGIN");
    for (const r of inoculantes) {
      if (await normalizarInoculante(cliente, r.chave, r.payload)) nInoculantes++;
    }
    await cliente.query("COMMIT");

    console.log(
      `Renormalizado do cache: ${nProdutos} produto(s), ${nInoculantes} inoculante(s).`,
    );
  } catch (err) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
}

// ------------------------------------------------------------------ coleta

async function sincronizar(pool: Pool, colecao: Colecao, pausaMs: number) {
  const cliente = await pool.connect();
  const usadas = new Set<string>();
  let gravados = 0;
  let normalizados = 0;
  let totalApi: number | null = null;
  let paginas: number | null = null;

  try {
    process.stdout.write(`\n▸ ${colecao.nome}\n`);

    for await (const pagina of paginarColecao<Record<string, unknown>>(
      colecao.caminho,
      {
        pausaMs,
        aoIniciar: (total, nPaginas) => {
          totalApi = total;
          paginas = nPaginas;
          console.log(`  ${total} registro(s) em ${nPaginas} página(s)`);
        },
      },
    )) {
      await cliente.query("BEGIN");
      const gravadosNesta = await gravarItens(cliente, colecao, pagina.itens, usadas);

      let normalizadosNesta = 0;
      for (const { chave, item } of gravadosNesta) {
        if (colecao.nome === "produtos-biologicos") {
          if (await normalizarProduto(cliente, item as ProdutoBiologico)) {
            normalizadosNesta++;
          }
        } else if (colecao.nome === "inoculantes") {
          if (await normalizarInoculante(cliente, chave, item as Inoculante)) {
            normalizadosNesta++;
          }
        }
      }
      await cliente.query("COMMIT");

      // Só depois do COMMIT: contar antes faria o relatório mentir sobre uma
      // página que o ROLLBACK desfez.
      gravados += gravadosNesta.length;
      normalizados += normalizadosNesta;
    }

    await cliente.query(
      `INSERT INTO bioinsumos_colecoes
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
        ? `\n  ⚠ a API declarou ${totalApi} e chegaram ${gravados}`
        : "";
    console.log(
      `  ✓ ${gravados} item(ns)` +
        (normalizados ? `, ${normalizados} normalizado(s)` : "") +
        aviso,
    );
    return { ok: true as const, gravados };
  } catch (err) {
    await cliente.query("ROLLBACK").catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${msg}`);
    await cliente
      .query(
        `INSERT INTO bioinsumos_colecoes
           (colecao, registros_gravados, ultimo_erro, sincronizado_em)
         VALUES ($1,$2,$3,now())
         ON CONFLICT (colecao) DO UPDATE SET
           registros_gravados = EXCLUDED.registros_gravados,
           ultimo_erro = EXCLUDED.ultimo_erro,
           sincronizado_em = now()`,
        [colecao.nome, gravados, msg.slice(0, 500)],
      )
      .catch(() => {});
    return { ok: false as const, gravados, erro: msg };
  } finally {
    cliente.release();
  }
}

// -------------------------------------------------------------------- main

async function main() {
  const opts = opcoes();

  if (opts.desconhecidas.length > 0) {
    console.error(`Opção desconhecida: ${opts.desconhecidas.join(", ")}`);
    process.exit(1);
  }

  if (opts.listar) {
    console.log("Coleções da API Bioinsumos:");
    for (const c of COLECOES) {
      console.log(`  ${c.nome.padEnd(28)} GET ${c.caminho}`);
    }
    return;
  }

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://pitaya:pitaya@localhost:5432/pitaya",
  });

  if (opts.doCache) {
    await renormalizarDoCache(pool);
    await pool.end();
    return;
  }

  if (!temCredencial()) {
    console.error(
      "Sem credencial da AgroAPI. Defina AGROAPI_CONSUMER_KEY e " +
        "AGROAPI_CONSUMER_SECRET no .env e assine a API Bioinsumos em " +
        "https://www.agroapi.cnptia.embrapa.br/store",
    );
    process.exit(1);
  }

  const alvo = opts.colecoes
    ? COLECOES.filter((c) => opts.colecoes!.includes(c.nome))
    : COLECOES;

  if (alvo.length === 0) {
    console.error(
      `Nenhuma coleção casou com "${opts.colecoes?.join(", ")}". ` +
        "Use --listar para ver os nomes.",
    );
    process.exit(1);
  }

  const inicio = Date.now();
  const falhas: string[] = [];

  // Cada coleção é independente: se uma falhar, o erro fica registrado em
  // bioinsumos_colecoes.ultimo_erro e as demais continuam.
  for (const colecao of alvo) {
    const r = await sincronizar(pool, colecao, opts.pausaMs);
    if (!r.ok) falhas.push(colecao.nome);
  }

  const seg = Math.round((Date.now() - inicio) / 1000);
  console.log(
    `\nConcluído em ${seg}s.` +
      (falhas.length ? ` Falharam: ${falhas.join(", ")}.` : " Sem falhas."),
  );
  await pool.end();
  if (falhas.length) process.exit(1);
}

main().catch((err) => {
  console.error("Erro na coleta:", err instanceof Error ? err.message : err);
  process.exit(1);
});

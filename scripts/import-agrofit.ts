/**
 * Importa o dump dos Dados Abertos Agrofit (MAPA) para a tabela local
 * agrofit_products — é o plano B que mantém a consulta fitossanitária
 * funcionando quando a API está fora ou sem token.
 *
 *   AGROFIT_CSV_URL=... npm run agrofit:import
 *   npm run agrofit:import -- data/agrofit/produtos.csv
 */
import { createReadStream, existsSync } from "node:fs";
import { parse } from "csv-parse";
import { Pool } from "pg";
import { Readable } from "node:stream";

/**
 * Os Dados Abertos mudam de layout entre publicações; o mapeamento fica
 * isolado aqui e a linha original vai para `raw`.
 */
const COLUNAS: Record<string, string[]> = {
  registration: ["numero_registro", "registro", "nr_registro"],
  product_name: ["marca_comercial", "produto_formulado", "nome_comercial", "produto"],
  active_ingredient: ["ingrediente_ativo", "ingredientes_ativos", "principio_ativo"],
  product_class: ["classe", "classe_agronomica", "classificacao"],
  crops: ["cultura", "culturas"],
  pests: ["praga_nome_comum", "praga", "pragas", "alvo"],
  holder: ["titular_registro", "titular", "empresa"],
  toxicological_class: ["classificacao_toxicologica", "classe_toxicologica"],
  environmental_class: ["classificacao_ambiental", "classe_ambiental"],
};

function pegar(linha: Record<string, string>, campo: string): string | null {
  const chaves = Object.keys(linha);
  for (const candidato of COLUNAS[campo]) {
    const achou = chaves.find(
      (k) => k.toLowerCase().replace(/[\s-]/g, "_") === candidato,
    );
    if (achou && linha[achou]?.trim()) return linha[achou].trim();
  }
  return null;
}

async function abrirFonte(): Promise<NodeJS.ReadableStream> {
  const caminho = process.argv[2];
  if (caminho) {
    if (!existsSync(caminho)) throw new Error(`Arquivo não encontrado: ${caminho}`);
    console.log(`Lendo ${caminho}`);
    return createReadStream(caminho);
  }

  const url = process.env.AGROFIT_CSV_URL?.trim();
  if (!url) {
    throw new Error(
      "Informe o CSV: passe o caminho como argumento ou defina AGROFIT_CSV_URL no .env.\n" +
        "Baixe o dump de produtos formulados em https://dados.agricultura.gov.br (busque por Agrofit).",
    );
  }
  console.log(`Baixando ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download falhou: ${res.status}`);
  if (!res.body) throw new Error("Resposta sem corpo");
  return Readable.fromWeb(res.body as never);
}

async function main() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgres://pitaya:pitaya@localhost:5432/pitaya",
  });

  const fonte = await abrirFonte();
  const parser = fonte.pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      delimiter: [";", ","],
      bom: true,
    }),
  );

  let importados = 0;
  let ignorados = 0;

  for await (const linha of parser) {
    const nome = pegar(linha, "product_name");
    if (!nome) {
      ignorados++;
      continue;
    }

    await pool.query(
      `INSERT INTO agrofit_products
         (registration, product_name, active_ingredient, product_class, crops,
          pests, holder, toxicological_class, environmental_class, raw, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
       ON CONFLICT (registration) DO UPDATE SET
         product_name = EXCLUDED.product_name,
         active_ingredient = EXCLUDED.active_ingredient,
         product_class = EXCLUDED.product_class,
         crops = EXCLUDED.crops,
         pests = EXCLUDED.pests,
         holder = EXCLUDED.holder,
         toxicological_class = EXCLUDED.toxicological_class,
         environmental_class = EXCLUDED.environmental_class,
         raw = EXCLUDED.raw,
         updated_at = now()`,
      [
        pegar(linha, "registration"),
        nome,
        pegar(linha, "active_ingredient"),
        pegar(linha, "product_class"),
        pegar(linha, "crops"),
        pegar(linha, "pests"),
        pegar(linha, "holder"),
        pegar(linha, "toxicological_class"),
        pegar(linha, "environmental_class"),
        JSON.stringify(linha),
      ],
    );
    importados++;
    if (importados % 1000 === 0) console.log(`  ${importados} linhas...`);
  }

  const { rows } = await pool.query<{ n: string }>(
    "SELECT count(*) AS n FROM agrofit_products WHERE crops ILIKE '%pitaya%'",
  );

  console.log(`\n✓ ${importados} produtos importados (${ignorados} ignorados).`);
  console.log(`  Registros mencionando pitaya: ${rows[0].n}`);
  if (rows[0].n === "0") {
    console.log(
      "  Nenhum registro para pitaya — esperado: a cultura tem poucos registros no MAPA.\n" +
        "  O chat vai informar essa ausência em vez de sugerir produto de outra cultura.",
    );
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Erro na importação:", err.message);
  process.exit(1);
});

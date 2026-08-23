import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgres://pitaya:pitaya@localhost:5432/pitaya",
  });
  const dir = join(process.cwd(), "banco", "migracoes");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    console.log(`Aplicando ${file}...`);
    const sql = readFileSync(join(dir, file), "utf-8");
    await pool.query(sql);
  }
  console.log("Migrações aplicadas com sucesso.");
  await pool.end();
}

main().catch((err) => {
  console.error("Erro na migração:", err.message);
  process.exit(1);
});

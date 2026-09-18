/**
 * Ingestão da base própria de conhecimento, em lote.
 *
 * O dia a dia não precisa deste comando: o observador ligado junto com
 * `npm run dev` ingere sozinho o .md salvo em data/conhecimento. Este script
 * serve para semear do zero, reingerir tudo depois de repor crédito de
 * embeddings, ou rodar em máquina onde o dev server não está no ar.
 *
 *   npm run db:seed
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { pool } from "../src/server/db";
import { embeddingsDisponiveis } from "../src/server/embeddings";
import { arquivosDeConhecimento, ingerirTodos } from "../src/server/ingestao";

async function main() {
  const arquivos = arquivosDeConhecimento();
  if (arquivos.length === 0) {
    console.error("Nenhum .md em data/conhecimento");
    console.error("Crie a pasta e coloque arquivos .md com o conteúdo técnico.");
    process.exit(1);
  }

  // Em produção, a ingestão só roda quando o conteúdo da imagem mudou.
  // A marca é gravada depois do lote completo; uma falha permite nova tentativa.
  const hash = createHash("sha256");
  for (const arquivo of [...arquivos].sort()) {
    hash.update(basename(arquivo));
    hash.update("\0");
    hash.update(readFileSync(arquivo));
    hash.update("\0");
  }
  const sha256 = hash.digest("hex");
  if (process.argv.includes("--if-changed")) {
    const { rows } = await pool.query<{ sha256: string | null }>(
      "SELECT valor->>'sha256' AS sha256 FROM configuracoes WHERE chave = $1",
      ["knowledge_seed"],
    );
    if (rows[0]?.sha256 === sha256) {
      console.log("Base de conhecimento já corresponde aos arquivos da imagem.");
      await pool.end();
      return;
    }
  }

  console.log(
    embeddingsDisponiveis()
      ? "Embeddings habilitados (busca vetorial)."
      : "Embeddings desativados — gravando com busca full-text.",
  );

  await ingerirTodos(({ titulo, chunks }) =>
    console.log(`✓ ${titulo} — ${chunks} chunk(s)`),
  );

  await pool.query(
    `INSERT INTO configuracoes (chave, valor)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (chave) DO UPDATE
       SET valor = EXCLUDED.valor, atualizado_em = now()`,
    ["knowledge_seed", JSON.stringify({ sha256 })],
  );
  await pool.end();
  console.log("Ingestão concluída.");
}

main().catch((err) => {
  console.error("Erro na ingestão:", err.message);
  process.exit(1);
});

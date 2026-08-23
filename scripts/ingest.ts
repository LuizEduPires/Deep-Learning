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

  console.log(
    embeddingsDisponiveis()
      ? "Embeddings habilitados (busca vetorial)."
      : "Sem OPENAI_API_KEY — gravando sem embeddings (busca full-text).",
  );

  await ingerirTodos(({ titulo, chunks }) =>
    console.log(`✓ ${titulo} — ${chunks} chunk(s)`),
  );

  await pool.end();
  console.log("Ingestão concluída.");
}

main().catch((err) => {
  console.error("Erro na ingestão:", err.message);
  process.exit(1);
});

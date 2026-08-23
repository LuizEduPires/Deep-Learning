import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { pool } from "./db";
import { gerarEmbeddings } from "./embeddings";

/**
 * Ingestão da base própria de conhecimento.
 *
 * Vive aqui, e não dentro de scripts/, porque três chamadores precisam do mesmo
 * comportamento: o `npm run db:seed`, o observador de pasta que roda junto com
 * o dev server, e qualquer reingestão futura. Duplicar significaria divergir no
 * recorte dos trechos — e trecho recortado de outro jeito muda o que a busca
 * encontra.
 */

export const DIR_CONHECIMENTO = join(process.cwd(), "data", "conhecimento");

const TAMANHO_CHUNK = 1200;
const SOBREPOSICAO = 150;

export function chunk(texto: string): string[] {
  const limpo = texto.replace(/\r\n/g, "\n").trim();
  if (limpo.length <= TAMANHO_CHUNK) return [limpo];

  const partes: string[] = [];
  let i = 0;
  while (i < limpo.length) {
    let fim = Math.min(i + TAMANHO_CHUNK, limpo.length);
    // Prefere cortar em quebra de parágrafo para não partir uma ideia ao meio.
    if (fim < limpo.length) {
      const quebra = limpo.lastIndexOf("\n\n", fim);
      if (quebra > i + TAMANHO_CHUNK / 2) fim = quebra;
    }
    partes.push(limpo.slice(i, fim).trim());
    // Último trecho: sair aqui. Sem isso, `i` passaria a valer sempre
    // `length - SOBREPOSICAO` e o laço repetiria o mesmo trecho para sempre.
    if (fim >= limpo.length) break;
    // Math.max garante avanço mesmo se a sobreposição comer o passo inteiro.
    i = Math.max(fim - SOBREPOSICAO, i + 1);
  }
  return partes.filter((p) => p.length > 50);
}

export type ResultadoIngestao = { titulo: string; chunks: number };

/**
 * Reingestão é idempotente por título: remove o documento anterior de mesmo
 * título antes de gravar. Por título e não por arquivo — renomear o arquivo
 * sem mudar o título substitui, em vez de duplicar.
 */
export async function ingerirArquivo(
  caminho: string,
): Promise<ResultadoIngestao> {
  const bruto = readFileSync(caminho, "utf-8");

  // Convenções lidas do próprio texto: primeira linha "# Título" e "Fonte: ...".
  const tituloMatch = bruto.match(/^#\s+(.+)$/m);
  const fonteMatch = bruto.match(/^Fonte:\s*(.+)$/m);
  const titulo = tituloMatch?.[1]?.trim() ?? basename(caminho, ".md");
  const fonte = fonteMatch?.[1]?.trim() ?? basename(caminho);

  await pool.query("DELETE FROM documents WHERE title = $1", [titulo]);
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO documents (title, source) VALUES ($1, $2) RETURNING id",
    [titulo, fonte],
  );
  const documentId = rows[0].id;

  const partes = chunk(bruto);
  const embeddings = await gerarEmbeddings(partes);

  for (let i = 0; i < partes.length; i++) {
    const emb = embeddings[i];
    await pool.query(
      "INSERT INTO chunks (document_id, chunk_index, content, embedding) VALUES ($1, $2, $3, $4)",
      [documentId, i, partes[i], emb ? `[${emb.join(",")}]` : null],
    );
  }

  return { titulo, chunks: partes.length };
}

export function arquivosDeConhecimento(): string[] {
  if (!existsSync(DIR_CONHECIMENTO)) return [];
  return readdirSync(DIR_CONHECIMENTO)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(DIR_CONHECIMENTO, f));
}

export async function ingerirTodos(
  aoConcluirArquivo?: (r: ResultadoIngestao) => void,
): Promise<ResultadoIngestao[]> {
  const resultados: ResultadoIngestao[] = [];
  for (const caminho of arquivosDeConhecimento()) {
    const r = await ingerirArquivo(caminho);
    resultados.push(r);
    aoConcluirArquivo?.(r);
  }
  return resultados;
}

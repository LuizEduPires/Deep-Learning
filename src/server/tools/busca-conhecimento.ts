import { sql } from "drizzle-orm";
import { db } from "../db";
import { gerarEmbedding } from "../embeddings";
import type { ToolDef } from "../llm/types";

type Linha = {
  content: string;
  title: string;
  source: string | null;
  score: number;
};

/**
 * RAG sobre a base própria de conhecimento da pitaya — o coração do produto.
 * Busca vetorial (pgvector) quando há embeddings; full-text em português
 * como fallback, para que a base nunca fique inacessível.
 */
export const buscaConhecimento: ToolDef = {
  name: "busca_conhecimento",
  description:
    "Busca na base própria de conhecimento técnico sobre pitaya: fenologia, poda, condução, indução floral, " +
    "polinização, nutrição, irrigação, pragas e doenças, colheita e pós-colheita. " +
    "Use SEMPRE que a pergunta for sobre prática de manejo da cultura — esta é a fonte primária. " +
    "Cite o documento retornado na resposta.",
  parameters: {
    type: "object",
    properties: {
      pergunta: {
        type: "string",
        description:
          "A pergunta ou tema a buscar, em português, com os termos técnicos relevantes.",
      },
      limite: {
        type: "integer",
        description: "Quantos trechos retornar (1 a 10). Padrão 5.",
      },
    },
    required: ["pergunta"],
  },

  async run(input) {
    const pergunta = String(input.pergunta);
    const limite = Math.min(Math.max((input.limite as number) ?? 5, 1), 10);

    const embedding = await gerarEmbedding(pergunta);
    const linhas = embedding
      ? await buscaVetorial(embedding, limite)
      : await buscaFullText(pergunta, limite);

    if (linhas.length === 0) {
      return {
        text:
          `Nada encontrado na base própria sobre "${pergunta}". ` +
          `Diga ao usuário que este tema ainda não está coberto na base e, se disponível, ` +
          `use a ferramenta responde_agro para buscar conteúdo técnico da Embrapa.`,
        sources: [],
      };
    }

    const trechos = linhas
      .map(
        (l, i) =>
          `[${i + 1}] ${l.title}${l.source ? ` (${l.source})` : ""}\n${l.content}`,
      )
      .join("\n\n---\n\n");

    return {
      text:
        `Trechos da base própria de conhecimento sobre pitaya:\n\n${trechos}\n\n` +
        `Baseie a resposta nestes trechos e cite o documento de origem.`,
      sources: linhas.map((l) => ({
        tool: "busca_conhecimento",
        label: l.title,
        detail: l.source ?? undefined,
      })),
    };
  },
};

async function buscaVetorial(
  embedding: number[],
  limite: number,
): Promise<Linha[]> {
  const vetor = `[${embedding.join(",")}]`;
  const res = await db.execute<Linha>(sql`
    SELECT c.content, d.title, d.source,
           1 - (c.embedding <=> ${vetor}::vector) AS score
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vetor}::vector
    LIMIT ${limite}
  `);
  return res.rows ?? [];
}

async function buscaFullText(
  pergunta: string,
  limite: number,
): Promise<Linha[]> {
  const exatos = await buscaComTodosOsTermos(pergunta, limite);
  if (exatos.length > 0) return exatos;
  return buscaComQualquerTermo(pergunta, limite);
}

/** Precisão: todos os termos no mesmo trecho. É o que websearch_to_tsquery faz. */
async function buscaComTodosOsTermos(
  pergunta: string,
  limite: number,
): Promise<Linha[]> {
  const res = await db.execute<Linha>(sql`
    SELECT c.content, d.title, d.source,
           ts_rank(c.tsv, websearch_to_tsquery('portuguese', ${pergunta})) AS score
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.tsv @@ websearch_to_tsquery('portuguese', ${pergunta})
    ORDER BY score DESC
    LIMIT ${limite}
  `);
  return res.rows ?? [];
}

/**
 * Recall: qualquer termo serve, e o ts_rank ordena por quantos casaram.
 *
 * Existe porque o E do websearch_to_tsquery zera a busca em pergunta escrita
 * como gente fala. "Melhor época para plantar pitaya na Bahia" exige os cinco
 * termos no mesmo trecho de 1200 caracteres — e o documento que responde
 * exatamente isso ficava invisível, porque "Bahia" está num parágrafo e
 * "época de plantio" no título. Sem este fallback, o chat dizia que o tema não
 * estava coberto tendo o texto na base.
 */
async function buscaComQualquerTermo(
  pergunta: string,
  limite: number,
): Promise<Linha[]> {
  // Sanitiza antes de montar a tsquery: to_tsquery quebra com pontuação, e
  // termo curto ("na", "de", "o") só traz ruído.
  const termos = pergunta
    .normalize("NFD")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .split(/\s+/)
    .filter((termo) => termo.length >= 3);

  if (termos.length === 0) return [];
  const consulta = termos.join(" | ");

  const res = await db.execute<Linha>(sql`
    SELECT c.content, d.title, d.source,
           ts_rank(c.tsv, to_tsquery('portuguese', ${consulta})) AS score
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.tsv @@ to_tsquery('portuguese', ${consulta})
    ORDER BY score DESC
    LIMIT ${limite}
  `);
  return res.rows ?? [];
}

import { criarClienteOpenAI } from "./llm/openai-client";

const MODEL = process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small";
const DIMENSAO_BANCO = 1536;

/**
 * Embeddings são opcionais: sem chave, ou com EMBEDDINGS_ENABLED=false,
 * o RAG cai para busca full-text.
 * Isso mantém o produto funcional quando o usuário roda só com Anthropic.
 */
/**
 * Uma chave sem crédito falha igual em todas as chamadas seguintes. Sem esta
 * memória, cada arquivo ingerido paga uma ida à OpenAI só para receber o mesmo
 * 429 — são ~2 segundos por arquivo, treze deles numa semeadura completa, e um
 * atraso visível a cada salvamento com o observador ligado.
 */
let desistiuNestaSessao = false;

/** Só motivo permanente desliga. Rede instável e pico de tráfego não. */
function ehFalhaPermanente(err: unknown): boolean {
  const status =
    typeof err === "object" && err !== null && "status" in err
      ? Number((err as { status: unknown }).status)
      : undefined;
  if (status === 401 || status === 402 || status === 403) return true;
  const texto = err instanceof Error ? err.message : String(err);
  return /credit|quota|billing|no credits/i.test(texto);
}

function registrarFalha(err: unknown, onde: string) {
  const motivo = err instanceof Error ? err.message : String(err);
  if (ehFalhaPermanente(err)) {
    desistiuNestaSessao = true;
    console.warn(
      `Embeddings desligados nesta execução (${motivo}). Seguindo com full-text.`,
    );
    return;
  }
  console.warn(`${onde} (${motivo}). Seguindo com full-text.`);
}

export function embeddingsDisponiveis(): boolean {
  if (desistiuNestaSessao) return false;
  return (
    process.env.EMBEDDINGS_ENABLED?.trim().toLowerCase() !== "false" &&
    Boolean(process.env.OPENAI_API_KEY?.trim())
  );
}

export async function gerarEmbedding(texto: string): Promise<number[] | null> {
  if (!embeddingsDisponiveis()) return null;
  try {
    const client = criarClienteOpenAI();
    const res = await client.embeddings.create({
      model: MODEL,
      input: texto,
    });
    const embedding = res.data[0]?.embedding;
    if (embedding?.length !== DIMENSAO_BANCO) {
      desistiuNestaSessao = true;
      console.warn(
        `Embedding com ${embedding?.length ?? 0} dimensões; o banco exige ${DIMENSAO_BANCO}. Seguindo com full-text.`,
      );
      return null;
    }
    return embedding;
  } catch (err) {
    // Caminho de consulta: falhar aqui derrubaria a busca inteira, quando o
    // full-text ainda responde. Ver comentário em gerarEmbeddings.
    registrarFalha(err, "Embedding da consulta indisponível");
    return null;
  }
}

/**
 * Chave presente não garante chamada bem-sucedida: a conta pode estar sem
 * crédito ou no limite de taxa. Como o embedding é opcional — a busca cai
 * para full-text — a falha não pode derrubar a ingestão no meio e deixar a
 * base pela metade.
 */
export async function gerarEmbeddings(
  textos: string[],
): Promise<(number[] | null)[]> {
  const semEmbedding = () => textos.map(() => null);
  if (!embeddingsDisponiveis()) return semEmbedding();

  try {
    const client = criarClienteOpenAI();
    const res = await client.embeddings.create({
      model: MODEL,
      input: textos,
    });
    if (
      res.data.length !== textos.length ||
      res.data.some((d) => d.embedding?.length !== DIMENSAO_BANCO)
    ) {
      desistiuNestaSessao = true;
      console.warn(
        `Embeddings incompatíveis: o banco exige ${DIMENSAO_BANCO} dimensões por texto. Seguindo com full-text.`,
      );
      return semEmbedding();
    }
    return res.data.map((d) => d.embedding);
  } catch (err) {
    registrarFalha(err, "Embeddings indisponíveis");
    return semEmbedding();
  }
}

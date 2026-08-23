import OpenAI from "openai";

const MODEL = process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small";

/**
 * Embeddings são opcionais: sem OPENAI_API_KEY o RAG cai para busca full-text.
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
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function gerarEmbedding(texto: string): Promise<number[] | null> {
  if (!embeddingsDisponiveis()) return null;
  try {
    const client = new OpenAI();
    const res = await client.embeddings.create({
      model: MODEL,
      input: texto,
    });
    return res.data[0].embedding;
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
    const client = new OpenAI();
    const res = await client.embeddings.create({
      model: MODEL,
      input: textos,
    });
    return res.data.map((d) => d.embedding);
  } catch (err) {
    registrarFalha(err, "Embeddings indisponíveis");
    return semEmbedding();
  }
}

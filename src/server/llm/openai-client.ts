import OpenAI from "openai";

/** URL base comum ao chat e aos embeddings; o SDK acrescenta cada caminho. */
export function criarClienteOpenAI(): OpenAI {
  const baseURL = process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, "");
  return new OpenAI(baseURL ? { baseURL } : {});
}

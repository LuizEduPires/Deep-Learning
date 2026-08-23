import OpenAI from "openai";
import { createOpenAiCompatibleProvider } from "./openai";
import type { LlmProvider } from "./types";

/**
 * Catálogo de modelos abertos hospedados pela NVIDIA (build.nvidia.com),
 * servido por uma API compatível com a da OpenAI — mesmo dialeto Chat
 * Completions, então reusa o laço de tool use de openai.ts.
 *
 * Entrou como caminho de demonstração: a chave é gratuita e sem cartão, e a
 * cota é por conta, separada da do OpenRouter. Quando a cota de um acaba no
 * meio de uma apresentação, o painel troca para o outro sem reiniciar nada.
 *
 * O modelo leva prefixo de organização: "nvidia/nemotron-3-super-120b-a12b",
 * "meta/llama-3.1-70b-instruct". A lista viva está em
 * https://integrate.api.nvidia.com/v1/models (pública, dispensa chave), mas
 * ela não diz quais suportam tool calling — confira no card do modelo em
 * build.nvidia.com, porque sem ferramenta o agente responde de memória.
 */
const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b";
const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";

export function createNvidiaProvider(model?: string): LlmProvider {
  const client = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: process.env.NVIDIA_BASE_URL?.trim() || DEFAULT_BASE_URL,
  });

  return createOpenAiCompatibleProvider({
    name: "nvidia",
    model: model || DEFAULT_MODEL,
    client,
  });
}

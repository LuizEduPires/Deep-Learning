import OpenAI from "openai";
import { createOpenAiCompatibleProvider } from "./openai";
import type { LlmProvider } from "./types";

/**
 * Roteador com vários provedores atrás de uma única chave e uma única fatura.
 * Útil aqui porque o chat cai inteiro quando o saldo de um provedor acaba —
 * com o OpenRouter, trocar de modelo é mudar LLM_MODEL no .env.
 *
 * O modelo vem com prefixo de provedor: "openai/gpt-4o",
 * "anthropic/claude-sonnet-4.5", "google/gemini-2.5-pro". Catálogo em
 * https://openrouter.ai/models — confira lá se o modelo escolhido suporta
 * tool calling, porque o agente depende disso para consultar Agrofit,
 * Bioinsumos e a base de conhecimento.
 */
const DEFAULT_MODEL = "openai/gpt-4o";
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

export function createOpenRouterProvider(model?: string): LlmProvider {
  /**
   * Headers opcionais do OpenRouter: identificam o app nos rankings e no
   * painel de uso deles. Sem eles a chamada funciona igual.
   */
  const defaultHeaders: Record<string, string> = {
    "X-Title": process.env.OPENROUTER_SITE_NAME?.trim() || "IA Pitaya",
  };
  const referer = process.env.OPENROUTER_SITE_URL?.trim();
  if (referer) defaultHeaders["HTTP-Referer"] = referer;

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL?.trim() || DEFAULT_BASE_URL,
    defaultHeaders,
  });

  return createOpenAiCompatibleProvider({
    name: "openrouter",
    model: model || DEFAULT_MODEL,
    client,
  });
}

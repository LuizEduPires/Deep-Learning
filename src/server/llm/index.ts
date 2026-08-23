import { createAnthropicProvider } from "./anthropic";
import { provedorDoCatalogo } from "./catalogo";
import { chaveConfigurada, lerConfigLlm } from "./config";
import { createNvidiaProvider } from "./nvidia";
import { createOpenAiProvider } from "./openai";
import { createOpenRouterProvider } from "./openrouter";
import type { LlmProvider } from "./types";

export * from "./types";
export * from "./catalogo";
export * from "./config";

/**
 * Monta o provedor que está valendo agora: o escolhido no painel do chat
 * (/api/llm), ou o do .env enquanto o painel não for usado.
 *
 * A chave de API vem sempre do .env — o painel troca provedor e modelo, nunca
 * segredo.
 */
export async function getProvider(): Promise<LlmProvider> {
  const { provider, model, origem } = await lerConfigLlm();

  if (!chaveConfigurada(provider)) {
    const env = provedorDoCatalogo(provider)!.envChave;
    const onde =
      origem === "painel"
        ? `O painel está com o provedor "${provider}"`
        : `LLM_PROVIDER=${provider}`;
    throw new Error(`${onde} mas ${env} não está definida no .env`);
  }

  switch (provider) {
    case "anthropic":
      return createAnthropicProvider(model);
    case "openai":
      return createOpenAiProvider(model);
    case "openrouter":
      return createOpenRouterProvider(model);
    case "nvidia":
      return createNvidiaProvider(model);
  }
}

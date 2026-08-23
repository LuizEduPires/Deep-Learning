/**
 * Traduz falha de provedor de LLM em mensagem que o usuário do chat entende.
 *
 * Os SDKs da Anthropic e da OpenAI (esta também usada pelo OpenRouter) jogam
 * o corpo da resposta HTTP dentro de `Error.message`. Sem tradução, quem está
 * no chat lê um JSON cru — foi o que aconteceu com o 400 de saldo da Anthropic
 * e com o 401 do OpenRouter. Os dois casos são de configuração, não de código,
 * e a mensagem precisa dizer isso.
 */

/** Duck typing: APIError dos dois SDKs expõe `status`. */
function statusHttp(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null || !("status" in err)) return undefined;
  const status = Number((err as { status: unknown }).status);
  return Number.isFinite(status) ? status : undefined;
}

/**
 * Retorna null quando o erro não é do provedor — aí quem chamou decide o que
 * fazer, em vez de engolir uma falha de banco como se fosse de LLM.
 */
export function descreveFalhaDeLlm(
  err: unknown,
  /**
   * O que estava valendo na hora da chamada. Vem de lerConfigLlm(): desde o
   * painel de troca de LLM, o .env pode não ser mais a resposta certa, e
   * nomear o provedor errado na mensagem manda o usuário mexer no lugar errado.
   */
  atual?: { provider: string; model?: string },
): string | null {
  const status = statusHttp(err);
  if (status === undefined) return null;

  const bruto = err instanceof Error ? err.message : String(err);
  const provedor =
    atual?.provider ?? (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase();
  const modelo = atual?.model ?? process.env.LLM_MODEL?.trim();
  const onde = `Provedor: ${provedor}${modelo ? ` (${modelo})` : ""}.`;

  // Cota diária de modelos gratuitos do OpenRouter. Vem como 429 com um corpo
  // que fala em "credits", então tem que ser testada ANTES da regra de saldo,
  // senão o usuário é mandado repor crédito — e o limite é por conta e por dia,
  // não por modelo: trocar de :free no painel não resolve.
  if (status === 429 && /free-models-per-day|free model/i.test(bruto)) {
    return `${onde} A cota diária de modelos gratuitos do OpenRouter acabou. Ela é da conta inteira, não do modelo — trocar por outro ":free" no painel não adianta. Espere a virada do dia (00h UTC), adicione crédito no OpenRouter para liberar mais chamadas gratuitas por dia, ou troque de provedor no painel do chat.`;
  }

  // O saldo esgotado chega como 400 na Anthropic e como 402 no OpenRouter.
  if (status === 402 || /credit|balance|quota|insufficient/i.test(bruto)) {
    return `${onde} A conta está sem saldo para chamar o modelo. Reponha crédito no provedor ou troque de provedor no painel do chat.`;
  }

  switch (status) {
    case 401:
    case 403:
      return `${onde} A chave de API foi recusada. Confira a variável de ambiente da chave no .env (o painel troca provedor e modelo, mas a chave só sai de lá) — se ela foi revogada, gere outra no painel do provedor.`;
    case 404:
      return `${onde} Modelo não encontrado. Confira o modelo no painel do chat — no OpenRouter o id leva prefixo de provedor, como "openai/gpt-4o".`;
    case 429:
      return `${onde} Limite de requisições atingido. Aguarde alguns instantes e tente de novo.`;
    case 504:
      // "Upstream idle timeout exceeded" do OpenRouter: o provedor por trás do
      // modelo demorou demais. Acontece com modelo gratuito sob carga.
      return `${onde} O modelo demorou demais para responder e a conexão expirou. Modelos gratuitos ficam lentos sob carga — tente de novo ou troque de modelo no painel do chat.`;
    default:
      if (status >= 500) {
        return `${onde} O provedor está indisponível no momento (HTTP ${status}). Tente novamente em instantes.`;
      }
      return `${onde} A chamada ao modelo falhou (HTTP ${status}): ${bruto}`;
  }
}

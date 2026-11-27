import OpenAI from "openai";
import { criarClienteOpenAI } from "./openai-client";
import type {
  ChatRequest,
  ChatResponse,
  LlmProvider,
  Source,
  ToolDef,
} from "./types";

const DEFAULT_MODEL = "gpt-4o";

type CompatibleOptions = {
  /** Nome do provedor exposto em LlmProvider.name (telemetria, mensagens). */
  name: string;
  model: string;
  client: OpenAI;
};

/**
 * O laço de tool use no dialeto Chat Completions da OpenAI.
 *
 * Fica separado de createOpenAiProvider porque o OpenRouter fala o mesmo
 * dialeto: só muda baseURL, chave e headers. Duplicar o laço significaria
 * corrigir bug de tool use em dois lugares.
 */
export function createOpenAiCompatibleProvider({
  name,
  model,
  client,
}: CompatibleOptions): LlmProvider {
  return {
    name,
    model,

    async chat(req: ChatRequest): Promise<ChatResponse> {
      const byName = new Map<string, ToolDef>(
        req.tools.map((t) => [t.name, t]),
      );
      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = req.tools.map(
        (t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters as Record<string, unknown>,
          },
        }),
      );

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: req.system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content }) as const),
      ];

      const sources: Source[] = [];
      const maxIterations = req.maxIterations ?? 5;

      for (let i = 0; i < maxIterations; i++) {
        const completion = (await client.chat.completions.create({
          model,
          messages,
          tools,
        })) as OpenAI.Chat.Completions.ChatCompletion & {
          error?: { message?: string; code?: number };
        };

        const choice = completion.choices?.[0];
        if (!choice) {
          // O OpenRouter devolve falha de upstream como HTTP 200 com corpo
          // { error: { message, code } } e sem choices. Como o status é 200, o
          // SDK não lança, e sem esta checagem o laço estouraria em
          // `choices[0]` — o usuário via "Cannot read properties of undefined
          // (reading '0')" no lugar do motivo real. Reempacotar com `status`
          // deixa descreveFalhaDeLlm traduzir como qualquer outra falha HTTP.
          const falha = new Error(
            completion.error?.message ?? "O provedor respondeu sem nenhuma escolha.",
          ) as Error & { status?: number };
          falha.status = completion.error?.code ?? 502;
          throw falha;
        }

        const message = choice.message;
        const calls = message.tool_calls ?? [];

        if (calls.length === 0) {
          return { text: (message.content ?? "").trim(), sources };
        }

        messages.push(message);

        const toolResults = await Promise.all(
          calls.map(async (call) => {
            if (call.type !== "function") return undefined;
            const tool = byName.get(call.function.name);
            if (!tool) {
              return {
                call,
                content: `Ferramenta desconhecida: ${call.function.name}`,
                sources: [],
              };
            }
            try {
              const input = JSON.parse(call.function.arguments || "{}") as Record<
                string,
                unknown
              >;
              const out = await tool.run(input, req.ctx);
              return { call, content: out.text, sources: out.sources ?? [] };
            } catch (err) {
              return {
                call,
                content: `Falha ao consultar ${call.function.name}: ${
                  err instanceof Error ? err.message : String(err)
                }. Informe ao usuário que essa fonte está indisponível e siga com as demais.`,
                sources: [],
              };
            }
          }),
        );

        for (const result of toolResults) {
          if (!result) continue;
          sources.push(...result.sources);
          messages.push({
            role: "tool",
            tool_call_id: result.call.id,
            content: result.content,
          });
        }
      }

      return {
        text: "A consulta ficou longa demais e foi interrompida. Tente uma pergunta mais específica.",
        sources,
      };
    },
  };
}

export function createOpenAiProvider(model?: string): LlmProvider {
  return createOpenAiCompatibleProvider({
    name: "openai",
    model: model || DEFAULT_MODEL,
    client: criarClienteOpenAI(),
  });
}

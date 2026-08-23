import Anthropic from "@anthropic-ai/sdk";
import type {
  ChatRequest,
  ChatResponse,
  LlmProvider,
  Source,
  ToolDef,
} from "./types";

const DEFAULT_MODEL = "claude-opus-5";

export function createAnthropicProvider(model?: string): LlmProvider {
  const client = new Anthropic();
  const resolved = model || DEFAULT_MODEL;

  return {
    name: "anthropic",
    model: resolved,

    async chat(req: ChatRequest): Promise<ChatResponse> {
      const byName = new Map<string, ToolDef>(
        req.tools.map((t) => [t.name, t]),
      );
      const tools = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));

      const messages: Anthropic.MessageParam[] = req.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const sources: Source[] = [];
      const maxIterations = req.maxIterations ?? 8;

      for (let i = 0; i < maxIterations; i++) {
        const response = await client.messages.create({
          model: resolved,
          max_tokens: 16000,
          system: req.system,
          tools,
          messages,
        });

        if (response.stop_reason === "refusal") {
          return {
            text: "Não consigo responder a essa solicitação. Reformule a pergunta focando no manejo da pitaya.",
            sources,
          };
        }

        if (response.stop_reason === "pause_turn") {
          messages.push({ role: "assistant", content: response.content });
          continue;
        }

        const toolUses = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
        );

        if (toolUses.length === 0) {
          const text = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n")
            .trim();
          return { text, sources };
        }

        messages.push({ role: "assistant", content: response.content });

        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const use of toolUses) {
          const tool = byName.get(use.name);
          if (!tool) {
            results.push({
              type: "tool_result",
              tool_use_id: use.id,
              content: `Ferramenta desconhecida: ${use.name}`,
              is_error: true,
            });
            continue;
          }
          try {
            const out = await tool.run(
              use.input as Record<string, unknown>,
              req.ctx,
            );
            if (out.sources) sources.push(...out.sources);
            results.push({
              type: "tool_result",
              tool_use_id: use.id,
              content: out.text,
            });
          } catch (err) {
            results.push({
              type: "tool_result",
              tool_use_id: use.id,
              content: `Falha ao consultar ${use.name}: ${
                err instanceof Error ? err.message : String(err)
              }. Informe ao usuário que essa fonte está indisponível e siga com as demais.`,
              is_error: true,
            });
          }
        }

        messages.push({ role: "user", content: results });
      }

      return {
        text: "A consulta ficou longa demais e foi interrompida. Tente uma pergunta mais específica.",
        sources,
      };
    },
  };
}

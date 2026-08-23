/**
 * Contrato neutro de provedor. Nada abaixo de `src/server/llm/` conhece
 * Anthropic ou OpenAI — trocar de provedor é mudar LLM_PROVIDER no .env.
 */

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

/** Uma fonte citada na resposta (API, documento da base própria, etc.). */
export type Source = {
  tool: string;
  label: string;
  detail?: string;
};

export type ToolResult = {
  /** Texto que volta para o modelo. */
  text: string;
  /** Fontes a exibir na UI. */
  sources?: Source[];
};

export type ToolDef = {
  name: string;
  description: string;
  parameters: JsonSchema;
  run: (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
};

export type ToolContext = {
  /** Coordenadas da propriedade em contexto, quando houver. */
  property?: { name: string; latitude: number; longitude: number } | null;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  system: string;
  messages: ChatMessage[];
  tools: ToolDef[];
  ctx: ToolContext;
  maxIterations?: number;
};

export type ChatResponse = {
  text: string;
  sources: Source[];
};

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  chat(req: ChatRequest): Promise<ChatResponse>;
}

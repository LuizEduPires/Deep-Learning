import type { ToolDef } from "../llm/types";

/**
 * Fallback de conhecimento: busca no acervo técnico da Embrapa via
 * API Responde Agro. Só é registrada no agente quando há AGROAPI_TOKEN —
 * ver src/server/tools/index.ts.
 */
export const respondeAgro: ToolDef = {
  name: "responde_agro",
  description:
    "Busca informações técnicas no acervo da Embrapa (API Responde Agro). " +
    "Use APENAS quando busca_conhecimento não trouxer resultado para o tema perguntado, " +
    "ou quando a pergunta sair do escopo específico da pitaya para agronomia geral.",
  parameters: {
    type: "object",
    properties: {
      pergunta: {
        type: "string",
        description: "A pergunta técnica em português.",
      },
    },
    required: ["pergunta"],
  },

  async run(input) {
    const pergunta = String(input.pergunta);
    const token = process.env.AGROAPI_TOKEN?.trim();
    if (!token) {
      return {
        text: "API Responde Agro não configurada (AGROAPI_TOKEN ausente).",
      };
    }

    const base = process.env.AGROAPI_BASE_URL ?? "https://api.cnptia.embrapa.br";
    const url = new URL(`${base}/responde-agro/v1/busca`);
    url.searchParams.set("q", pergunta);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Responde Agro respondeu ${res.status}`);
    const data = await res.json();

    return {
      text:
        `Resultados do acervo técnico da Embrapa para "${pergunta}":\n` +
        JSON.stringify(data).slice(0, 6000),
      sources: [
        {
          tool: "responde_agro",
          label: "Responde Agro — Embrapa",
          detail: pergunta,
        },
      ],
    };
  },
};

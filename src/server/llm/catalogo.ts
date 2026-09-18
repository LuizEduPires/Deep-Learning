/**
 * Catálogo de provedores e modelos oferecidos no painel de troca de LLM.
 *
 * A lista é sugestão, não trava: o painel aceita digitar qualquer id. Provedor
 * lança modelo mais rápido do que este arquivo é atualizado, e um id fora da
 * lista tem que continuar funcionando.
 *
 * Os modelos padrão aqui repetem os DEFAULT_MODEL de anthropic.ts, openai.ts,
 * openrouter.ts e nvidia.ts de propósito: é o que o painel mostra como escolha quando o
 * modelo está vazio, e divergir mentiria para o usuário.
 */

export const PROVEDORES = [
  "anthropic",
  "openai",
  "openrouter",
  "nvidia",
] as const;
export type NomeProvedor = (typeof PROVEDORES)[number];

export type ModeloCatalogo = {
  id: string;
  rotulo: string;
  /** Nota curta ao lado do nome: "grátis", "mais barato", etc. */
  nota?: string;
};

export type ProvedorCatalogo = {
  id: NomeProvedor;
  rotulo: string;
  /** Variável de ambiente que guarda a chave desse provedor. */
  envChave: string;
  modeloPadrao: string;
  modelos: ModeloCatalogo[];
  ajuda: string;
};

export const CATALOGO: ProvedorCatalogo[] = [
  {
    id: "anthropic",
    rotulo: "Anthropic",
    envChave: "ANTHROPIC_API_KEY",
    modeloPadrao: "claude-opus-5",
    ajuda: "Chave em console.anthropic.com. Consome crédito da conta.",
    modelos: [
      { id: "claude-opus-5", rotulo: "Claude Opus 5", nota: "mais capaz" },
      { id: "claude-sonnet-5", rotulo: "Claude Sonnet 5", nota: "equilíbrio" },
      {
        id: "claude-haiku-4-5-20251001",
        rotulo: "Claude Haiku 4.5",
        nota: "mais rápido e barato",
      },
    ],
  },
  {
    id: "openai",
    rotulo: "OpenAI",
    envChave: "OPENAI_API_KEY",
    modeloPadrao: "gpt-4o",
    ajuda: "Chave da OpenAI ou do servidor compatível configurado.",
    modelos: [
      { id: "gpt-5", rotulo: "GPT-5" },
      { id: "gpt-5-mini", rotulo: "GPT-5 mini", nota: "mais barato" },
      { id: "gpt-4o", rotulo: "GPT-4o" },
      { id: "gpt-4o-mini", rotulo: "GPT-4o mini", nota: "mais barato" },
    ],
  },
  {
    id: "openrouter",
    rotulo: "OpenRouter",
    envChave: "OPENROUTER_API_KEY",
    modeloPadrao: "openai/gpt-4o",
    ajuda:
      "Uma chave para modelos de vários provedores, alguns gratuitos (:free). O painel lista só os que suportam ferramentas — sem isso o agente responde de memória. Ver docs/08-openrouter.md.",
    // Só o mínimo: a lista de verdade vem da API do OpenRouter em
    // modelos-openrouter.ts, e esta aqui é o plano B quando ela não responde.
    modelos: [
      { id: "openai/gpt-4o", rotulo: "openai/gpt-4o" },
      { id: "anthropic/claude-sonnet-4.5", rotulo: "anthropic/claude-sonnet-4.5" },
      {
        id: "nvidia/nemotron-3-ultra-550b-a55b:free",
        rotulo: "nvidia/nemotron-3-ultra-550b-a55b",
        nota: "grátis",
      },
    ],
  },
  {
    id: "nvidia",
    rotulo: "NVIDIA",
    envChave: "NVIDIA_API_KEY",
    modeloPadrao: "nvidia/nemotron-3-super-120b-a12b",
    ajuda:
      "Modelos abertos hospedados pela NVIDIA. Chave gratuita e sem cartão em build.nvidia.com, com cota própria — serve de plano B para demonstração quando a do OpenRouter acaba. Ver docs/10-nvidia.md.",
    // Curada, e não vinda da API: o /v1/models deles lista 100+ modelos sem
    // dizer quais suportam tool calling, e o agente depende disso.
    modelos: [
      {
        id: "nvidia/nemotron-3-super-120b-a12b",
        rotulo: "Nemotron 3 Super 120B",
        nota: "equilíbrio",
      },
      {
        id: "nvidia/nemotron-3-ultra-550b-a55b",
        rotulo: "Nemotron 3 Ultra 550B",
        nota: "mais capaz",
      },
      {
        id: "nvidia/nemotron-3-nano-30b-a3b",
        rotulo: "Nemotron 3 Nano 30B",
        nota: "mais rápido",
      },
      { id: "openai/gpt-oss-120b", rotulo: "GPT-OSS 120B" },
      { id: "moonshotai/kimi-k2.6", rotulo: "Kimi K2.6" },
      { id: "meta/llama-3.1-70b-instruct", rotulo: "Llama 3.1 70B" },
    ],
  },
];

export function provedorDoCatalogo(id: string): ProvedorCatalogo | undefined {
  return CATALOGO.find((p) => p.id === id);
}

export function ehProvedorValido(id: string): id is NomeProvedor {
  return (PROVEDORES as readonly string[]).includes(id);
}

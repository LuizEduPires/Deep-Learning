import { provedorDoCatalogo, type ModeloCatalogo } from "./catalogo";

/**
 * Lista de modelos do OpenRouter para o painel, vinda do catálogo deles.
 *
 * Lista fixa em código envelhece: o OpenRouter muda de modelo gratuito de um
 * mês para o outro, e o id que sumiu vira HTTP 404 na primeira pergunta. O
 * endpoint é público (não precisa de chave) e é o mesmo que docs/08-openrouter.md
 * manda consultar no curl.
 *
 * Só entram modelos com tool calling: o agente depende disso para consultar
 * Agrofit, Bioinsumos, clima e a base de conhecimento. Um modelo sem
 * ferramenta responde de memória, que é justamente o que este produto evita.
 */

const URL_MODELOS = "https://openrouter.ai/api/v1/models";
const TTL_MS = 10 * 60 * 1000;
const LIMITE = 80;

type ModeloDaApi = {
  id?: string;
  name?: string;
  supported_parameters?: string[];
};

let cache: { em: number; modelos: ModeloCatalogo[] } | null = null;

/** "openai/gpt-4o" -> "GPT-4o (openai)" fica pior de escanear que o id cru. */
function rotulo(m: ModeloDaApi): string {
  return m.name?.trim() || m.id!;
}

export async function listarModelosOpenRouter(): Promise<ModeloCatalogo[]> {
  if (cache && Date.now() - cache.em < TTL_MS) return cache.modelos;

  const reserva = provedorDoCatalogo("openrouter")!.modelos;

  try {
    const res = await fetch(URL_MODELOS, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { data } = (await res.json()) as { data?: ModeloDaApi[] };
    const comFerramenta = (data ?? []).filter(
      (m) => m.id && (m.supported_parameters ?? []).includes("tools"),
    );

    if (comFerramenta.length === 0) throw new Error("nenhum modelo com tools");

    const gratuitos = comFerramenta.filter((m) => m.id!.endsWith(":free"));
    const pagos = comFerramenta.filter((m) => !m.id!.endsWith(":free"));
    const ordena = (a: ModeloDaApi, b: ModeloDaApi) => a.id!.localeCompare(b.id!);

    // Gratuitos primeiro: é com eles que dá para usar o chat sem crédito.
    const modelos: ModeloCatalogo[] = [
      ...gratuitos.sort(ordena).map((m) => ({
        id: m.id!,
        rotulo: rotulo(m),
        nota: "grátis",
      })),
      ...pagos.sort(ordena).map((m) => ({ id: m.id!, rotulo: rotulo(m) })),
    ].slice(0, LIMITE);

    cache = { em: Date.now(), modelos };
    return modelos;
  } catch (err) {
    // Sem internet ou catálogo fora do ar: o painel abre com a lista de
    // reserva em vez de ficar sem opção nenhuma.
    console.warn(
      "Não consegui listar os modelos do OpenRouter; usando a lista de reserva:",
      err instanceof Error ? err.message : String(err),
    );
    return reserva;
  }
}

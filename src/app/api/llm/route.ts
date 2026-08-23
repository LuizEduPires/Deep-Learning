import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CATALOGO,
  PROVEDORES,
  chaveConfigurada,
  lerConfigLlm,
  limparConfigLlm,
  salvarConfigLlm,
} from "@/server/llm";
import { listarModelosOpenRouter } from "@/server/llm/modelos-openrouter";

export const runtime = "nodejs";

/** Adaptador HTTP do painel de LLM: delega para src/server/llm/config.ts. */

const Body = z.object({
  provider: z.enum(PROVEDORES),
  // Vazio significa "usa o modelo padrão do provedor".
  model: z.string().max(200).optional(),
});

/**
 * Catálogo + quais provedores têm chave no .env, para o painel avisar antes de
 * a troca virar erro na primeira pergunta. Os modelos do OpenRouter vêm da API
 * deles, que muda mais rápido do que qualquer lista em código.
 */
async function provedores() {
  const modelosOpenRouter = await listarModelosOpenRouter();

  return CATALOGO.map((p) => ({
    id: p.id,
    rotulo: p.rotulo,
    envChave: p.envChave,
    modeloPadrao: p.modeloPadrao,
    modelos: p.id === "openrouter" ? modelosOpenRouter : p.modelos,
    ajuda: p.ajuda,
    temChave: chaveConfigurada(p.id),
  }));
}

async function estado() {
  const [atual, lista] = await Promise.all([lerConfigLlm(), provedores()]);
  return { atual, provedores: lista };
}

export async function GET() {
  return NextResponse.json(await estado());
}

export async function PUT(request: Request) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json(
      {
        error: `Envie { provider, model? } — provider entre ${PROVEDORES.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  try {
    await salvarConfigLlm(parsed);
    return NextResponse.json(await estado());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao salvar configuração de LLM:", msg);
    return NextResponse.json(
      { error: `Não consegui salvar: ${msg}` },
      { status: 500 },
    );
  }
}

/** Volta para o provedor e o modelo do .env. */
export async function DELETE() {
  try {
    await limparConfigLlm();
    return NextResponse.json(await estado());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao restaurar configuração de LLM:", msg);
    return NextResponse.json(
      { error: `Não consegui restaurar: ${msg}` },
      { status: 500 },
    );
  }
}

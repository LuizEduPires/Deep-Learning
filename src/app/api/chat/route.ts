import { NextResponse } from "next/server";
import { z } from "zod";
import { responderNaConversa } from "@/server/conversas";
import { lerConfigLlm } from "@/server/llm/config";
import { descreveFalhaDeLlm } from "@/server/llm/erros";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Adaptador HTTP: valida a entrada e delega para src/server/conversas.ts. */

const Body = z.object({
  conversationId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida. Envie { message: string }." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await responderNaConversa(parsed));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro no chat:", msg);
    // Falha de provedor é de configuração: vale uma mensagem acionável em vez
    // do corpo cru da resposta HTTP.
    const atual = await lerConfigLlm().catch(() => undefined);
    const doProvedor = descreveFalhaDeLlm(err, atual);
    return NextResponse.json(
      { error: doProvedor ?? `Falha ao processar: ${msg}` },
      { status: 500 },
    );
  }
}

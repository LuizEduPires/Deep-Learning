import { NextResponse } from "next/server";
import { listarConversas } from "@/server/conversas";

export const runtime = "nodejs";

/** Adaptador HTTP do histórico: delega para src/server/conversas.ts. */

export async function GET() {
  try {
    return NextResponse.json(await listarConversas());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao listar conversas:", msg);
    return NextResponse.json(
      { error: `Não consegui carregar o histórico: ${msg}` },
      { status: 500 },
    );
  }
}

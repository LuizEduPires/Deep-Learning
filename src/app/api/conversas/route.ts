import { NextResponse, type NextRequest } from "next/server";
import { listarConversas } from "@/server/conversas";
import { usuarioAutenticado } from "@/server/auth";

export const runtime = "nodejs";

/** Adaptador HTTP do histórico: delega para src/server/conversas.ts. */

export async function GET(request: NextRequest) {
  const user = await usuarioAutenticado(request);
  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }
  try {
    return NextResponse.json(await listarConversas(user.id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao listar conversas:", msg);
    return NextResponse.json(
      { error: `Não consegui carregar o histórico: ${msg}` },
      { status: 500 },
    );
  }
}

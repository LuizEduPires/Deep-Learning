import { NextResponse } from "next/server";
import { z } from "zod";
import { atualizarNome, usuarioDaRequisicao } from "@/server/auth";
import { respostaSemLogin } from "@/server/auth-http";

export const runtime = "nodejs";

/** Usuário da sessão atual — 401 quando não há login. */
export async function GET() {
  const usuario = await usuarioDaRequisicao();
  if (!usuario) {
    return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  }
  return NextResponse.json(usuario, { headers: { "Cache-Control": "no-store" } });
}

const Body = z.object({ name: z.string().trim().min(1).max(120) });

/** Troca o nome do usuário logado. */
export async function PATCH(request: Request) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Informe um nome de até 120 caracteres." }, { status: 400 });
  }

  try {
    return NextResponse.json(await atualizarNome(parsed.name));
  } catch (err) {
    const semLogin = respostaSemLogin(err);
    if (semLogin) return semLogin;
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao atualizar nome:", msg);
    return NextResponse.json({ error: "Não consegui salvar o nome agora." }, { status: 500 });
  }
}

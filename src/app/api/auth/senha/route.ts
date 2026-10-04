import { NextResponse } from "next/server";
import { z } from "zod";
import { ErroDeCredencial, trocarSenha } from "@/server/auth";
import { respostaSemLogin } from "@/server/auth-http";

export const runtime = "nodejs";

const Body = z.object({
  senhaAtual: z.string().min(1).max(200),
  novaSenha: z.string().min(8).max(200),
});

/** Troca a senha do usuário logado; derruba as sessões dos outros aparelhos. */
export async function POST(request: Request) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Informe a senha atual e uma nova senha de pelo menos 8 caracteres." },
      { status: 400 },
    );
  }

  try {
    await trocarSenha(parsed);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const semLogin = respostaSemLogin(err);
    if (semLogin) return semLogin;
    if (err instanceof ErroDeCredencial) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao trocar senha:", msg);
    return NextResponse.json({ error: "Não consegui trocar a senha agora." }, { status: 500 });
  }
}

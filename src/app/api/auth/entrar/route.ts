import { NextResponse } from "next/server";
import { z } from "zod";
import { ErroDeCredencial, entrar } from "@/server/auth";
import { cookieDeSessao } from "@/server/auth-http";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().trim().min(1).max(254),
  senha: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }

  try {
    const { usuario, token } = await entrar(parsed);
    return cookieDeSessao(NextResponse.json(usuario), request, token);
  } catch (err) {
    if (err instanceof ErroDeCredencial) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro no login:", msg);
    return NextResponse.json({ error: "Não consegui entrar agora." }, { status: 500 });
  }
}

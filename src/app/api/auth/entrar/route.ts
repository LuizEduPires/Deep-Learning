import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { loginSchema } from "@/auth/validacao";
import { ErroDeCredencial, entrar } from "@/server/auth";
import { cookieDeSessao } from "@/server/auth-http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = loginSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Informe e-mail e senha válidos." },
        { status: 400 },
      );
    }
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

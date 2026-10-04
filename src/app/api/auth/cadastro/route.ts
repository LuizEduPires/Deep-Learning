import { NextResponse } from "next/server";
import { z } from "zod";
import { ErroDeCredencial, cadastrar } from "@/server/auth";
import { cookieDeSessao } from "@/server/auth-http";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  senha: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Informe nome, um e-mail válido e uma senha de pelo menos 8 caracteres." },
      { status: 400 },
    );
  }

  try {
    const { usuario, token } = await cadastrar(parsed);
    return cookieDeSessao(NextResponse.json(usuario, { status: 201 }), request, token);
  } catch (err) {
    if (err instanceof ErroDeCredencial) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro no cadastro:", msg);
    return NextResponse.json({ error: "Não consegui criar a conta agora." }, { status: 500 });
  }
}

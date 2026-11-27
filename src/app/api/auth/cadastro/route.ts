import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { cadastroSchema } from "@/auth/validacao";
import { ErroDeCredencial, cadastrar } from "@/server/auth";
import { cookieDeSessao } from "@/server/auth-http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = cadastroSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Confira os dados informados." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Informe nome, e-mail, senha e confirmação válidos." },
      { status: 400 },
    );
  }

  try {
    const { usuario, token } = await cadastrar({
      name: parsed.name,
      email: parsed.email,
      senha: parsed.senha,
    });
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

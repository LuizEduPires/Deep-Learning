import { NextResponse } from "next/server";
import { z } from "zod";
import {
  atualizarPropriedade,
  criarPropriedade,
  listarPropriedades,
} from "@/server/propriedades";
import { respostaSemLogin } from "@/server/auth-http";

export const runtime = "nodejs";

/** Adaptador HTTP: valida a entrada e delega para src/server/propriedades.ts. */

const Body = z.object({
  name: z.string().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const BodyComId = Body.extend({ id: z.string().uuid() });

/** Sem sessão vira 401; o resto segue como erro do servidor. */
async function comLogin(fazer: () => Promise<Response>) {
  try {
    return await fazer();
  } catch (err) {
    const semLogin = respostaSemLogin(err);
    if (semLogin) return semLogin;
    throw err;
  }
}

export async function GET() {
  return comLogin(async () => NextResponse.json(await listarPropriedades()));
}

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Envie { name, latitude, longitude } válidos." },
      { status: 400 },
    );
  }

  return comLogin(async () =>
    NextResponse.json(await criarPropriedade(parsed), { status: 201 }),
  );
}

export async function PUT(request: Request) {
  let parsed;
  try {
    parsed = BodyComId.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Envie { id, name, latitude, longitude } válidos." },
      { status: 400 },
    );
  }

  const { id, ...dados } = parsed;
  return comLogin(async () => {
    const atualizada = await atualizarPropriedade(id, dados);
    if (!atualizada) {
      return NextResponse.json(
        { error: "Propriedade não encontrada." },
        { status: 404 },
      );
    }
    return NextResponse.json(atualizada);
  });
}

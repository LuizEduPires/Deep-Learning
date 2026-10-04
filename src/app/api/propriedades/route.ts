import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  atualizarPropriedade,
  criarPropriedade,
  listarPropriedades,
} from "@/server/propriedades";
import { usuarioAutenticado } from "@/server/auth";

export const runtime = "nodejs";

/** Adaptador HTTP: valida a entrada e delega para src/server/propriedades.ts. */

const Body = z.object({
  name: z.string().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const BodyComId = Body.extend({ id: z.string().uuid() });

export async function GET(request: NextRequest) {
  const user = await usuarioAutenticado(request);
  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }
  return NextResponse.json(await listarPropriedades(user.id));
}

export async function POST(request: NextRequest) {
  const user = await usuarioAutenticado(request);
  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Envie { name, latitude, longitude } válidos." },
      { status: 400 },
    );
  }

  return NextResponse.json(await criarPropriedade(user.id, parsed), { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await usuarioAutenticado(request);
  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }
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
  const atualizada = await atualizarPropriedade(user.id, id, dados);
  if (!atualizada) {
    return NextResponse.json(
      { error: "Propriedade não encontrada." },
      { status: 404 },
    );
  }
  return NextResponse.json(atualizada);
}

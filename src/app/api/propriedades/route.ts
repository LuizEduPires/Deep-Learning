import { NextResponse } from "next/server";
import { z } from "zod";
import { criarPropriedade, listarPropriedades } from "@/server/propriedades";

export const runtime = "nodejs";

/** Adaptador HTTP: valida a entrada e delega para src/server/propriedades.ts. */

const Body = z.object({
  name: z.string().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function GET() {
  return NextResponse.json(await listarPropriedades());
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

  return NextResponse.json(await criarPropriedade(parsed), { status: 201 });
}

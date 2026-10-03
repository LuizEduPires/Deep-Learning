import { NextResponse } from "next/server";
import { z } from "zod";
import { buscarClima } from "@/server/clima";

export const runtime = "nodejs";

/** Adaptador HTTP: valida as coordenadas e delega para src/server/clima.ts. */

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = Query.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Informe lat e lon válidos." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await buscarClima(parsed.data.lat, parsed.data.lon));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao buscar clima:", msg);
    return NextResponse.json(
      { error: `Não consegui buscar a previsão: ${msg}` },
      { status: 502 },
    );
  }
}

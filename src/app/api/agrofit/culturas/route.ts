import { NextResponse } from "next/server";
import { culturasDoProduto } from "@/server/agrofit/busca";

export const runtime = "nodejs";

/** Adaptador HTTP: delega para src/server/agrofit/busca.ts. */
export async function GET(request: Request) {
  const registro = new URL(request.url).searchParams.get("registro")?.trim();
  if (!registro) {
    return NextResponse.json({ error: "Informe ?registro=" }, { status: 400 });
  }

  try {
    return NextResponse.json({ registro, culturas: await culturasDoProduto(registro) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro nas culturas do produto:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { culturasDoProduto } from "@/server/bioinsumos/busca";

export const runtime = "nodejs";

/** Adaptador HTTP: delega para src/server/bioinsumos/busca.ts. */
export async function GET(request: Request) {
  const registro = new URL(request.url).searchParams.get("registro")?.trim();
  if (!registro) {
    return NextResponse.json({ error: "Informe ?registro=" }, { status: 400 });
  }

  try {
    const culturas = await culturasDoProduto(registro);
    if (!culturas) {
      return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ registro, culturas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro nas culturas do bioinsumo:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

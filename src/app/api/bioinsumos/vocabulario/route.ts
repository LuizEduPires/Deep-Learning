import { NextResponse } from "next/server";
import { vocabulario } from "@/server/bioinsumos/busca";

export const runtime = "nodejs";

/** Adaptador HTTP: delega para src/server/bioinsumos/busca.ts. */
export async function GET() {
  try {
    return NextResponse.json(await vocabulario());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro no vocabulário Bioinsumos:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

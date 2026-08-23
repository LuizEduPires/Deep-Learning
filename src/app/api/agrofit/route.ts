import { NextResponse } from "next/server";
import { buscarProdutos } from "@/server/agrofit/busca";

export const runtime = "nodejs";

/** Adaptador HTTP: lê os parâmetros e delega para src/server/agrofit/busca.ts. */

const TAMANHO_PADRAO = 25;
const TAMANHO_MAX = 100;

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const texto = (n: string) => p.get(n)?.trim() || null;

  const pagina = Math.max(1, Number(p.get("pagina") ?? 1) || 1);
  const tamanho = Math.min(
    TAMANHO_MAX,
    Math.max(1, Number(p.get("tamanho") ?? TAMANHO_PADRAO) || TAMANHO_PADRAO),
  );

  try {
    const dados = await buscarProdutos(
      {
        texto: texto("q"),
        cultura: texto("cultura"),
        praga: texto("praga"),
        ingrediente: texto("ingrediente"),
        titular: texto("titular"),
        classe: texto("classe"),
        biologico: p.get("bio") === "1",
        organico: p.get("organico") === "1",
      },
      pagina,
      tamanho,
    );
    return NextResponse.json(dados);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro na busca Agrofit:", msg);
    return NextResponse.json({ error: `Falha na consulta: ${msg}` }, { status: 500 });
  }
}

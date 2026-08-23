import { NextResponse } from "next/server";
import { buscarInoculantes, buscarProdutos } from "@/server/bioinsumos/busca";

export const runtime = "nodejs";

/**
 * Adaptador HTTP da busca de bioinsumos — a lógica está em
 * src/server/bioinsumos/busca.ts, que lê a cópia local no Postgres. Duas abas,
 * dois formatos: `produtos` (controle de pragas) e `inoculantes`.
 */

const TAMANHO_PADRAO = 25;
const TAMANHO_MAX = 100;

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const aba = p.get("aba") === "inoculantes" ? "inoculantes" : "produtos";
  const texto = (n: string) => p.get(n)?.trim() || undefined;

  const pagina = Math.max(1, Number(p.get("pagina") ?? 1) || 1);
  const tamanho = Math.min(
    TAMANHO_MAX,
    Math.max(1, Number(p.get("tamanho") ?? TAMANHO_PADRAO) || TAMANHO_PADRAO),
  );

  try {
    const dados =
      aba === "inoculantes"
        ? await buscarInoculantes(
            {
              q: texto("q"),
              cultura: texto("cultura"),
              especie: texto("especie"),
              uf: texto("uf"),
              tipo: texto("tipo"),
            },
            pagina,
            tamanho,
          )
        : await buscarProdutos(
            {
              q: texto("q"),
              cultura: texto("cultura"),
              praga: texto("praga"),
              ingrediente: texto("ingrediente"),
              titular: texto("titular"),
              classe: texto("classe"),
              organico: p.get("organico") === "1",
            },
            pagina,
            tamanho,
          );

    return NextResponse.json(dados);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro na busca Bioinsumos:", msg);
    return NextResponse.json({ error: `Falha na consulta: ${msg}` }, { status: 500 });
  }
}

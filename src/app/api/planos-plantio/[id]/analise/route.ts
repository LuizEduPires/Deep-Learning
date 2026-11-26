import { NextResponse } from "next/server";
import { z } from "zod";
import { usuarioDaRequisicao } from "@/server/auth";
import { analisarPlanoPlantio } from "@/server/planos-plantio";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await usuarioDaRequisicao();
  if (!usuario) {
    return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  }

  const { id } = await params;
  const valido = z.uuid().safeParse(id);
  if (!valido.success) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  try {
    const analise = await analisarPlanoPlantio(usuario.id, valido.data);
    if (!analise) {
      return NextResponse.json({ error: "Plano de plantio não encontrado." }, { status: 404 });
    }
    return NextResponse.json(analise, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Erro ao analisar plano de plantio:", err);
    return NextResponse.json(
      { error: "Não consegui atualizar a análise agora. Tente novamente mais tarde." },
      { status: 502 },
    );
  }
}

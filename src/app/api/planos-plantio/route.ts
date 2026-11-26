import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { entradaPlanoPlantioSchema } from "@/plantio/validacao";
import { usuarioDaRequisicao } from "@/server/auth";
import {
  criarPlanoPlantio,
  listarPlanosPlantio,
  PropriedadePlanoNaoEncontrada,
} from "@/server/planos-plantio";

export const runtime = "nodejs";

export async function GET() {
  const usuario = await usuarioDaRequisicao();
  if (!usuario) {
    return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  }

  try {
    return NextResponse.json(await listarPlanosPlantio(usuario.id));
  } catch (err) {
    console.error("Erro ao listar planos de plantio:", err);
    return NextResponse.json({ error: "Não consegui carregar os planos de plantio." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const usuario = await usuarioDaRequisicao();
  if (!usuario) {
    return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  }

  let dados;
  try {
    dados = entradaPlanoPlantioSchema.parse(await request.json());
  } catch (err) {
    const mensagem =
      err instanceof ZodError
        ? err.issues[0]?.message ?? "Confira os dados do plano."
        : "Envie os dados do plano em JSON válido.";
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }

  try {
    return NextResponse.json(await criarPlanoPlantio(usuario.id, dados), { status: 201 });
  } catch (err) {
    if (err instanceof PropriedadePlanoNaoEncontrada) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("Erro ao criar plano de plantio:", err);
    return NextResponse.json({ error: "Não consegui salvar o plano de plantio." }, { status: 500 });
  }
}

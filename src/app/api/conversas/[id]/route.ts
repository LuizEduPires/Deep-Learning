import { NextResponse } from "next/server";
import { z } from "zod";
import { abrirConversa, apagarConversa } from "@/server/conversas";

export const runtime = "nodejs";

/** Adaptador HTTP de uma conversa: delega para src/server/conversas.ts. */

const Id = z.string().uuid();

async function idValido(params: Promise<{ id: string }>) {
  const { id } = await params;
  return Id.safeParse(id);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = await idValido(params);
  if (!id.success) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  try {
    const conversa = await abrirConversa(id.data);
    if (!conversa) {
      return NextResponse.json(
        { error: "Conversa não encontrada." },
        { status: 404 },
      );
    }
    return NextResponse.json(conversa);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao abrir conversa:", msg);
    return NextResponse.json(
      { error: `Não consegui abrir a conversa: ${msg}` },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = await idValido(params);
  if (!id.success) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  try {
    const apagou = await apagarConversa(id.data);
    if (!apagou) {
      return NextResponse.json(
        { error: "Conversa não encontrada." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao apagar conversa:", msg);
    return NextResponse.json(
      { error: `Não consegui apagar a conversa: ${msg}` },
      { status: 500 },
    );
  }
}

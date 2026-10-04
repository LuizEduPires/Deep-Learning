import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encerrarSessao } from "@/server/auth";
import { cookieDeSessao } from "@/server/auth-http";
import { SESSAO_COOKIE } from "@/server/sessao";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const jar = await cookies();
  await encerrarSessao(jar.get(SESSAO_COOKIE)?.value);
  return cookieDeSessao(NextResponse.json({ ok: true }), request, null);
}

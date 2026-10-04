import { NextResponse } from "next/server";
import { ErroNaoAutenticado } from "./auth";
import { SESSAO_COOKIE, SESSAO_SEGUNDOS } from "./sessao";
import { turnstilePublicUrl } from "./turnstile";

/** Grava (ou apaga, com token null) o cookie de sessão na resposta. */
export function cookieDeSessao(response: NextResponse, request: Request, token: string | null) {
  response.cookies.set({
    name: SESSAO_COOKIE,
    value: token ?? "",
    httpOnly: true,
    secure: turnstilePublicUrl(request, "/").protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: token ? SESSAO_SEGUNDOS : 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** 401 para quem chegou sem sessão válida; null para os demais erros. */
export function respostaSemLogin(err: unknown) {
  if (!(err instanceof ErroNaoAutenticado)) return null;
  return NextResponse.json({ error: err.message }, { status: 401 });
}

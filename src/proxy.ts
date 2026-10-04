import { NextResponse, type NextRequest } from "next/server";
import { SESSAO_COOKIE, formatoDeToken, rotaPublica } from "./server/sessao";
import {
  TURNSTILE_COOKIE_NAME,
  safeReturnPath,
  turnstileRequired,
  turnstilePublicUrl,
  validTurnstileSession,
} from "./server/turnstile";

export function proxy(request: NextRequest) {
  const turnstile = verificarTurnstile(request);
  if (turnstile) return turnstile;
  return exigirLogin(request);
}

/** Resposta de bloqueio do Turnstile, ou null quando a requisição pode seguir. */
function verificarTurnstile(request: NextRequest) {
  if (!turnstileRequired()) return null;

  const path = request.nextUrl.pathname;
  if (path === "/api/health" || path === "/api/turnstile/verify") {
    return NextResponse.next();
  }

  const verified = validTurnstileSession(
    request.cookies.get(TURNSTILE_COOKIE_NAME)?.value,
  );
  if (path === "/verificar") {
    if (!verified) return NextResponse.next();
    return NextResponse.redirect(
      turnstilePublicUrl(
        request,
        safeReturnPath(request.nextUrl.searchParams.get("next")),
      ),
    );
  }
  if (verified) return null;

  if (path.startsWith("/api/") || (request.method !== "GET" && request.method !== "HEAD")) {
    return NextResponse.json(
      { error: "Verificação Turnstile necessária." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const target = turnstilePublicUrl(request, "/verificar");
  target.searchParams.set(
    "next",
    safeReturnPath(request.nextUrl.pathname + request.nextUrl.search),
  );
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * Sem cookie de sessão, página vai para /entrar e API recebe 401. Aqui só se
 * confere o formato do cookie — a validade de verdade (existe, não venceu) é
 * checada no servidor por usuarioAtual(), que é quem tem acesso ao banco.
 */
function exigirLogin(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (rotaPublica(path)) return NextResponse.next();
  if (formatoDeToken(request.cookies.get(SESSAO_COOKIE)?.value)) return NextResponse.next();

  if (path.startsWith("/api/") || (request.method !== "GET" && request.method !== "HEAD")) {
    return NextResponse.json(
      { error: "Faça login para continuar." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const target = turnstilePublicUrl(request, "/entrar");
  target.searchParams.set(
    "next",
    safeReturnPath(request.nextUrl.pathname + request.nextUrl.search),
  );
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)"],
};

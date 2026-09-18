import { NextResponse, type NextRequest } from "next/server";
import {
  TURNSTILE_COOKIE_NAME,
  safeReturnPath,
  turnstileRequired,
  turnstilePublicUrl,
  validTurnstileSession,
} from "./server/turnstile";

export function proxy(request: NextRequest) {
  if (!turnstileRequired()) return NextResponse.next();

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
  if (verified) return NextResponse.next();

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

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)"],
};

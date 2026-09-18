import { NextResponse } from "next/server";
import {
  TURNSTILE_ACTION,
  TURNSTILE_COOKIE_NAME,
  TURNSTILE_SESSION_SECONDS,
  createTurnstileSession,
  safeReturnPath,
  turnstileConfigured,
  turnstileRequired,
  turnstilePublicUrl,
} from "@/server/turnstile";

type SiteverifyResult = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

const CLOUDFLARE_TEST_SECRETS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

function rejected(request: Request, next: unknown) {
  const url = turnstilePublicUrl(request, "/verificar");
  url.searchParams.set("erro", "1");
  url.searchParams.set("next", safeReturnPath(next));
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: Request) {
  if (!turnstileRequired()) {
    return NextResponse.redirect(turnstilePublicUrl(request, "/"), 303);
  }
  if (!turnstileConfigured()) return rejected(request, "/");

  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return rejected(request, "/");
  }

  const next = data.get("next");
  const token = data.get("cf-turnstile-response");
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return rejected(request, next);
  }

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return rejected(request, next);

  try {
    const body = new URLSearchParams({ secret, response: token });
    const verify = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!verify.ok) throw new Error("Siteverify indisponível");
    const result = (await verify.json()) as SiteverifyResult;
    const expectedHostname = turnstilePublicUrl(request, "/")
      .hostname.toLowerCase();
    const testSecret = CLOUDFLARE_TEST_SECRETS.has(secret);
    if (
      result.success !== true ||
      (!testSecret &&
        (result.action !== TURNSTILE_ACTION ||
          result.hostname?.toLowerCase() !== expectedHostname))
    ) {
      console.warn("Turnstile rejeitado:", result["error-codes"] ?? []);
      return rejected(request, next);
    }
  } catch {
    console.warn("Não foi possível validar o Turnstile.");
    return rejected(request, next);
  }

  const response = NextResponse.redirect(
    turnstilePublicUrl(request, safeReturnPath(next)),
    303,
  );
  response.cookies.set({
    name: TURNSTILE_COOKIE_NAME,
    value: createTurnstileSession(),
    httpOnly: true,
    secure: turnstilePublicUrl(request, "/").protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: TURNSTILE_SESSION_SECONDS,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

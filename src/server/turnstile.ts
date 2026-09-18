import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TURNSTILE_COOKIE_NAME = "pitaya_turnstile";
export const TURNSTILE_ACTION = "pitaya_entry";
export const TURNSTILE_SESSION_SECONDS = 12 * 60 * 60;

export function turnstileRequired(): boolean {
  return Boolean(
    process.env.TURNSTILE_SITE_KEY?.trim() &&
      process.env.TURNSTILE_SECRET_KEY?.trim(),
  );
}

export function turnstileConfigured(): boolean {
  const secret = process.env.TURNSTILE_SESSION_SECRET?.trim();
  return Boolean(
    process.env.TURNSTILE_SITE_KEY?.trim() &&
      process.env.TURNSTILE_SECRET_KEY?.trim() &&
      secret &&
      Buffer.byteLength(secret, "utf8") >= 32,
  );
}

function sign(payload: string): Buffer | null {
  const secret = process.env.TURNSTILE_SESSION_SECRET?.trim();
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32 || !turnstileSecret) {
    return null;
  }
  return createHmac("sha256", secret)
    .update("turnstile-v1")
    .update("\0")
    .update(turnstileSecret)
    .update("\0")
    .update(payload)
    .digest();
}

export function createTurnstileSession(): string {
  const expires = Math.floor(Date.now() / 1000) + TURNSTILE_SESSION_SECONDS;
  const nonce = randomBytes(16).toString("base64url");
  const payload = String(expires) + "." + nonce;
  const signature = sign(payload);
  if (!signature) throw new Error("TURNSTILE_SESSION_SECRET não configurado.");
  return payload + "." + signature.toString("base64url");
}

export function validTurnstileSession(value: string | undefined): boolean {
  if (!value || value.length > 128) return false;
  const match = /^([0-9]{10,11})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match) return false;

  const expires = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + TURNSTILE_SESSION_SECONDS) {
    return false;
  }

  const expected = sign(match[1] + "." + match[2]);
  if (!expected) return false;
  const actual = Buffer.from(match[3], "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }

  try {
    const target = new URL(value, "http://pitaya.invalid");
    if (
      target.origin !== "http://pitaya.invalid" ||
      target.pathname.startsWith("/verificar") ||
      target.pathname.startsWith("/api/turnstile/")
    ) {
      return "/";
    }
    return target.pathname + target.search;
  } catch {
    return "/";
  }
}

function firstHeaderValue(value: string | null): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

function authorityUrl(
  value: string | undefined,
  protocol: "http" | "https",
): URL | undefined {
  if (!value || /[\/\\@?#\s]/.test(value)) return undefined;
  try {
    const url = new URL(`${protocol}://${value}`);
    return url.hostname ? url : undefined;
  } catch {
    return undefined;
  }
}

export function turnstilePublicUrl(request: Request, path: string): URL {
  const internalUrl = new URL(request.url);
  const forwardedProto = firstHeaderValue(
    request.headers.get("x-forwarded-proto"),
  )?.toLowerCase();
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : internalUrl.protocol === "https:"
        ? "https"
        : "http";
  const incoming =
    authorityUrl(firstHeaderValue(request.headers.get("x-forwarded-host")), protocol) ??
    authorityUrl(firstHeaderValue(request.headers.get("host")), protocol) ??
    internalUrl;

  const configuredHostname = process.env.TURNSTILE_HOSTNAME?.trim().toLowerCase();
  if (!configuredHostname) return new URL(path, `${protocol}://${incoming.host}`);

  const validHostname = configuredHostname.split(".").every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
  );
  if (!validHostname) {
    throw new Error("TURNSTILE_HOSTNAME deve conter apenas o hostname.");
  }

  return new URL(path, `${protocol}://${configuredHostname}`);
}

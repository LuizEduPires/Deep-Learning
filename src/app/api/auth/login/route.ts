import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE,
  loginUser,
} from "@/server/auth";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Envie { email, password } válidos." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const authenticated = await loginUser(parsed.email, parsed.password);
    if (!authenticated) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    const response = NextResponse.json({ user: authenticated.user });
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: authenticated.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_SESSION_MAX_AGE,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    console.error("Erro ao autenticar usuário:", err);
    return NextResponse.json(
      { error: "Não foi possível autenticar." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

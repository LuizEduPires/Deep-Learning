import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE,
  registerUser,
} from "@/server/auth";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_SESSION_MAX_AGE,
  });
}

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Envie { name, email, password } válidos; a senha deve ter ao menos 12 caracteres." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { user, token } = await registerUser(parsed);
    const response = NextResponse.json({ user }, { status: 201 });
    setSessionCookie(response, token);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "23505"
    ) {
      return NextResponse.json(
        { error: "Já existe uma conta com este e-mail." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Erro ao criar conta:", err);
    return NextResponse.json(
      { error: "Não foi possível criar a conta." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

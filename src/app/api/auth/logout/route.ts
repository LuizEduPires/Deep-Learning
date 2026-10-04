import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, revokeSession } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  try {
    await revokeSession(token);
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (err) {
    console.error("Erro ao encerrar sessão:", err);
    return NextResponse.json(
      { error: "Não foi possível encerrar a sessão." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

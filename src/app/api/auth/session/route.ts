import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, getUserFromSession } from "@/server/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession(
      request.cookies.get(AUTH_COOKIE_NAME)?.value,
    );
    if (!user) {
      return NextResponse.json(
        { error: "Autenticação necessária." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { user },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("Erro ao consultar sessão:", err);
    return NextResponse.json(
      { error: "Não foi possível consultar a sessão." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

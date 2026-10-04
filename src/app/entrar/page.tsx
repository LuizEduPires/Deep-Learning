import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Entrar from "@/frontend/entrar";
import { usuarioDaRequisicao } from "@/server/auth";
import { safeReturnPath } from "@/server/turnstile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrar — Dr. Pitaya",
};

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const proximo = safeReturnPath(next);
  const destino = proximo.startsWith("/entrar") ? "/" : proximo;

  if (await usuarioDaRequisicao()) redirect(destino);

  return <Entrar proximo={destino} />;
}

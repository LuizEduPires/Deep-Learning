import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Entrar from "@/frontend/entrar";
import { usuarioDaRequisicao } from "@/server/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrar — Dr. Pitaya",
};

export default async function PaginaEntrar() {
  if (await usuarioDaRequisicao()) redirect("/");

  return <Entrar />;
}

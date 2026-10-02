import type { Metadata } from "next";
import Historico from "@/frontend/historico";

export const metadata: Metadata = {
  title: "Conversas — Dr. Pitaya",
};

export default function PaginaConversas() {
  return <Historico />;
}

import type { Metadata } from "next";
import Fazenda from "@/frontend/fazenda";

export const metadata: Metadata = {
  title: "Propriedade — Dr. Pitaya",
};

export default function PaginaFazenda() {
  return <Fazenda />;
}

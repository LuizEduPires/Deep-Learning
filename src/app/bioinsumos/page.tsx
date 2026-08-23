import type { Metadata } from "next";
import BuscaBioinsumos from "@/frontend/bioinsumos/busca";

export const metadata: Metadata = {
  title: "Bioinsumos — IA Pitaya",
  description:
    "Consulta estruturada aos produtos biológicos e inoculantes registrados no MAPA, pela API Bioinsumos da Embrapa.",
};

export default function PaginaBioinsumos() {
  return <BuscaBioinsumos />;
}

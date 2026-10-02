import type { Metadata } from "next";
import BuscaAgrofit from "@/frontend/agrofit/busca";

export const metadata: Metadata = {
  title: "Agrofit — Dr. Pitaya",
  description:
    "Consulta estruturada aos produtos fitossanitários registrados no MAPA, a partir da cópia local da API Agrofit.",
};

export default function PaginaAgrofit() {
  return <BuscaAgrofit />;
}

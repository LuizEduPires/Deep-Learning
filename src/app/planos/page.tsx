import type { Metadata } from "next";
import PlanosPlantio from "@/frontend/planos-plantio";

export const metadata: Metadata = {
  title: "Planos de plantio — Dr. Pitaya",
};

export default function PaginaPlanos() {
  return <PlanosPlantio />;
}

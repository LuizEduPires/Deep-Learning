import type { Metadata } from "next";
import { Suspense } from "react";
import BuscaProdutos from "@/frontend/produtos/busca";

export const metadata: Metadata = {
  title: "Produtos — Dr. Pitaya",
  description:
    "Defensivos, biológicos e inoculantes registrados no MAPA, consultados na cópia local das bases Agrofit e Bioinsumos.",
};

/**
 * A tela única de produtos mora em /agrofit, o endereço que a navegação já
 * usa; /bioinsumos redireciona para cá.
 */
export default function PaginaProdutos() {
  // A busca lê ?bio= e ?tipo= da URL, o que pede um limite de Suspense.
  return (
    <Suspense>
      <BuscaProdutos />
    </Suspense>
  );
}

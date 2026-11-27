import { redirect } from "next/navigation";

/**
 * Bioinsumos virou parte da tela única de produtos: os biológicos são os
 * mesmos do Agrofit. O endereço antigo continua valendo, já com o filtro.
 */
export default function PaginaBioinsumos() {
  redirect("/agrofit?bio=1");
}

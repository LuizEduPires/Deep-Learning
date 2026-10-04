import type { Metadata } from "next";
import Conta from "@/frontend/conta";

export const metadata: Metadata = {
  title: "Conta — Dr. Pitaya",
};

export default function PaginaConta() {
  return <Conta />;
}

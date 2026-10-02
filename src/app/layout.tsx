import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import Casca from "@/frontend/navegacao";
import "./globals.css";

const titulo = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--fonte-titulo",
  display: "swap",
});

const texto = Figtree({
  subsets: ["latin"],
  variable: "--fonte-texto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dr. Pitaya — assistente de manejo",
  description:
    "Chat de IA para manejo da pitaya, com clima, Agrofit e base técnica própria.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#111813" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${texto.variable}`}>
      <body>
        <Casca>{children}</Casca>
      </body>
    </html>
  );
}

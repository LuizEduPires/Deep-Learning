import type { Metadata } from "next";
import { Suspense } from "react";
import Chat from "@/frontend/chat";

export const metadata: Metadata = {
  title: "Conversa — Dr. Pitaya",
};

export default function PaginaChat() {
  // O chat lê ?id= e ?q= da URL, o que pede um limite de Suspense.
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}

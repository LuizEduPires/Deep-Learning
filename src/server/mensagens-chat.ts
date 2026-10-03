import { textoComAnalise } from "./classificador-folha";
import type { LeafInference } from "../shared/classificador-folha";
import type { ChatMessage } from "./llm/types";

export type MensagemSalvaParaChat = {
  role: string;
  content: string;
  leafInference?: LeafInference | null;
};

/** Reanexa a análise textual que corresponde a cada pergunta histórica. */
export function montarMensagensDoChat(
  historico: MensagemSalvaParaChat[],
  pergunta: string,
  analiseAtual?: LeafInference,
): ChatMessage[] {
  return [
    ...historico.map((mensagem) => ({
      role: mensagem.role as ChatMessage["role"],
      content: textoComAnalise(mensagem.content, mensagem.leafInference),
    })),
    { role: "user", content: textoComAnalise(pergunta, analiseAtual) },
  ];
}

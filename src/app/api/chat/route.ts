import { NextResponse, type NextRequest } from "next/server";
import {
  responderNaConversa,
  RecursoConversaNaoEncontrado,
} from "@/server/conversas";
import { lerCorpoChat, ErroEntradaChat } from "@/server/chat-http";
import { ErroClassificadorFolha } from "@/server/classificador-folha";
import { lerConfigLlm } from "@/server/llm/config";
import { descreveFalhaDeLlm } from "@/server/llm/erros";
import { usuarioAutenticado } from "@/server/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Adaptador HTTP: valida a entrada e delega para src/server/conversas.ts. */

export async function POST(request: NextRequest) {
  const user = await usuarioAutenticado(request);
  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }
  let parsed;
  try {
    parsed = await lerCorpoChat(request);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof ErroEntradaChat
            ? err.message
            : "Requisição inválida. Envie { message: string }.",
      },
      { status: err instanceof ErroEntradaChat ? err.status : 400 },
    );
  }

  try {
    return NextResponse.json(await responderNaConversa(parsed, user.id));
  } catch (err) {
    if (err instanceof RecursoConversaNaoEncontrado) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ErroClassificadorFolha) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro no chat:", msg);
    // Falha de provedor é de configuração: vale uma mensagem acionável em vez
    // do corpo cru da resposta HTTP.
    const atual = await lerConfigLlm().catch(() => undefined);
    const doProvedor = descreveFalhaDeLlm(err, atual);
    return NextResponse.json(
      { error: doProvedor ?? `Falha ao processar: ${msg}` },
      { status: 500 },
    );
  }
}

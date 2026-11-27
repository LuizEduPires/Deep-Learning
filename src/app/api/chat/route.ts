import { NextResponse } from "next/server";
import { ErroNaoAutenticado } from "@/server/auth";
import { ErroConversaNaoEncontrada, responderNaConversa } from "@/server/conversas";
import { lerCorpoChat, ErroEntradaChat } from "@/server/chat-http";
import { ErroClassificadorFolha } from "@/server/classificador-folha";
import { lerConfigLlm } from "@/server/llm/config";
import { descreveFalhaDeLlm } from "@/server/llm/erros";
import { TIPO_FLUXO_CHAT, type EventoChat } from "@/shared/etapas-chat";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Adaptador HTTP: valida a entrada e delega para src/server/conversas.ts.
 *
 * Duas formas de resposta. Por padrão, um JSON só, no fim. Com
 * `Accept: application/x-ndjson`, uma linha JSON por evento: as etapas do
 * agente conforme acontecem (o chat mostra "consultando o Agrofit…") e, por
 * último, `fim` com a resposta ou `erro`.
 */

export async function POST(request: Request) {
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

  if (request.headers.get("accept")?.includes(TIPO_FLUXO_CHAT)) {
    return responderEmFluxo(parsed);
  }

  try {
    return NextResponse.json(await responderNaConversa(parsed));
  } catch (err) {
    const { error, status } = await descreverErro(err);
    return NextResponse.json({ error }, { status });
  }
}

function responderEmFluxo(parsed: Awaited<ReturnType<typeof lerCorpoChat>>) {
  const codificador = new TextEncoder();
  const corpo = new ReadableStream<Uint8Array>({
    async start(controle) {
      const enviar = (evento: EventoChat) =>
        controle.enqueue(codificador.encode(`${JSON.stringify(evento)}\n`));
      try {
        const resposta = await responderNaConversa(parsed, (etapa) =>
          enviar({ tipo: "etapa", ...etapa }),
        );
        enviar({ tipo: "fim", resposta });
      } catch (err) {
        enviar({ tipo: "erro", ...(await descreverErro(err)) });
      } finally {
        controle.close();
      }
    },
  });

  return new Response(corpo, {
    headers: {
      "Content-Type": `${TIPO_FLUXO_CHAT}; charset=utf-8`,
      "Cache-Control": "no-store",
      // Sem isto, proxies como o nginx seguram as linhas até o fim e as
      // etapas chegam todas juntas com a resposta.
      "X-Accel-Buffering": "no",
    },
  });
}

/** Mensagem e status HTTP de uma falha ao responder. */
async function descreverErro(err: unknown): Promise<{ error: string; status: number }> {
  if (err instanceof ErroNaoAutenticado) return { error: err.message, status: 401 };
  if (err instanceof ErroConversaNaoEncontrada) return { error: err.message, status: 404 };
  if (err instanceof ErroClassificadorFolha) return { error: err.message, status: err.status };

  const msg = err instanceof Error ? err.message : String(err);
  console.error("Erro no chat:", msg);
  // Falha de provedor é de configuração: vale uma mensagem acionável em vez
  // do corpo cru da resposta HTTP.
  const atual = await lerConfigLlm().catch(() => undefined);
  const doProvedor = descreveFalhaDeLlm(err, atual);
  return { error: doProvedor ?? `Falha ao processar: ${msg}`, status: 500 };
}

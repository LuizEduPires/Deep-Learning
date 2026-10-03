import { z } from "zod";
import {
  MAX_FOLHA_BYTES,
  validarImagemFolha,
  type FotoDeFolha,
} from "./classificador-folha";
import {
  MAX_CORPO_CHAT_BYTES,
  PERGUNTA_PADRAO_FOLHA,
} from "../shared/classificador-folha";

const camposTexto = z.object({
  conversationId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
});

export type CorpoChat = z.infer<typeof camposTexto> & {
  foto?: FotoDeFolha;
};

export class ErroEntradaChat extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413,
  ) {
    super(message);
    this.name = "ErroEntradaChat";
  }
}

/** Mede o stream completo antes de dar os bytes ao parser multipart do Node. */
async function lerCorpoLimitado(request: Request): Promise<Uint8Array> {
  const declarado = request.headers.get("content-length");
  if (declarado && /^\d+$/.test(declarado) && Number(declarado) > MAX_CORPO_CHAT_BYTES) {
    throw new ErroEntradaChat("O envio excede o limite de 21 MiB.", 413);
  }

  if (!request.body) throw new ErroEntradaChat("O corpo da requisição está vazio.", 400);
  const reader = request.body.getReader();
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > MAX_CORPO_CHAT_BYTES) {
        await reader.cancel();
        throw new ErroEntradaChat("O envio excede o limite de 21 MiB.", 413);
      }
      partes.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const corpo = new Uint8Array(tamanho);
  let offset = 0;
  for (const parte of partes) {
    corpo.set(parte, offset);
    offset += parte.byteLength;
  }
  return corpo;
}

export async function lerCorpoChat(request: Request): Promise<CorpoChat> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType === "application/json") {
    try {
      const bytes = await lerCorpoLimitado(request);
      const dados: unknown = JSON.parse(new TextDecoder().decode(bytes));
      return camposTexto.parse(dados);
    } catch (erro) {
      if (erro instanceof ErroEntradaChat) throw erro;
      throw new ErroEntradaChat("Requisição inválida. Envie { message: string }.", 400);
    }
  }

  if (contentType !== "multipart/form-data") {
    throw new ErroEntradaChat(
      "Requisição inválida. Envie JSON ou um formulário multipart com uma imagem.",
      400,
    );
  }

  let formulario: FormData;
  try {
    const corpo = await lerCorpoLimitado(request);
    const copia = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: corpo.buffer as ArrayBuffer,
    });
    formulario = await copia.formData();
  } catch (erro) {
    if (erro instanceof ErroEntradaChat) throw erro;
    throw new ErroEntradaChat("Formulário de imagem inválido. Confira o arquivo e tente novamente.", 400);
  }

  for (const campo of ["message", "conversationId", "propertyId"]) {
    if (formulario.getAll(campo).length > 1) {
      throw new ErroEntradaChat(`Envie apenas um campo ${campo}.`, 400);
    }
  }
  const imagens = formulario.getAll("image");
  if (imagens.length !== 1 || !(imagens[0] instanceof File)) {
    throw new ErroEntradaChat("Anexe exatamente uma imagem de folha.", 400);
  }

  const file = imagens[0];
  const erroImagem = validarImagemFolha(file);
  if (erroImagem) {
    const grande = file.size > MAX_FOLHA_BYTES;
    throw new ErroEntradaChat(erroImagem, grande ? 413 : 400);
  }

  const mensagem = formulario.get("message");
  const idConversa = formulario.get("conversationId");
  const idPropriedade = formulario.get("propertyId");
  if (
    (mensagem !== null && typeof mensagem !== "string") ||
    (idConversa !== null && typeof idConversa !== "string") ||
    (idPropriedade !== null && typeof idPropriedade !== "string")
  ) {
    throw new ErroEntradaChat("Envie texto válido junto com a imagem.", 400);
  }

  try {
    const campos = camposTexto.parse({
      message:
        typeof mensagem === "string" && mensagem.trim()
          ? mensagem
          : PERGUNTA_PADRAO_FOLHA,
      ...(typeof idConversa === "string" ? { conversationId: idConversa } : {}),
      ...(typeof idPropriedade === "string" ? { propertyId: idPropriedade } : {}),
    });
    return {
      ...campos,
      foto: {
        bytes: new Uint8Array(await file.arrayBuffer()),
        tipo: file.type.toLowerCase(),
        nomeArquivo: file.name,
      },
    };
  } catch (erro) {
    if (erro instanceof ErroEntradaChat) throw erro;
    throw new ErroEntradaChat("Requisição inválida. Confira a pergunta e os identificadores.", 400);
  }
}

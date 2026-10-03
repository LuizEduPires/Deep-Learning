import { z } from "zod";
import mapaClasses from "../../deploy/classificador-folha/classes_pt-BR.json";
import {
  MAX_FOLHA_BYTES,
  TIPOS_IMAGEM_FOLHA,
  type LeafInference,
} from "../shared/classificador-folha";

const nomesDasClasses = new Set<string>(mapaClasses.classes.map((item) => item.label));

const candidatoSchema = z.object({
  classe: z.string().refine((nome) => nomesDasClasses.has(nome)),
  probabilidade: z.number().min(0).max(1),
});

const predicaoSchema = z
  .object({
    modelo: z.literal(mapaClasses.model),
    classe: z.string().refine((nome) => nomesDasClasses.has(nome)),
    confianca: z.number().min(0).max(1),
    top_3: z.array(candidatoSchema).length(3),
  })
  .strict()
  .superRefine((resultado, ctx) => {
    const top = resultado.top_3;
    if (top[0].classe !== resultado.classe) {
      ctx.addIssue({ code: "custom", message: "A classe líder diverge de top_3." });
    }
    if (Math.abs(top[0].probabilidade - resultado.confianca) > 0.000001) {
      ctx.addIssue({ code: "custom", message: "A confiança diverge de top_3." });
    }
    if (new Set(top.map((item) => item.classe)).size !== 3) {
      ctx.addIssue({ code: "custom", message: "top_3 contém classes repetidas." });
    }
    if (top.some((item, index) => index > 0 && item.probabilidade > top[index - 1].probabilidade)) {
      ctx.addIssue({ code: "custom", message: "top_3 não está em ordem decrescente." });
    }
    if (top.reduce((soma, item) => soma + item.probabilidade, 0) > 1.000001) {
      ctx.addIssue({ code: "custom", message: "As pontuações de top_3 são incompatíveis." });
    }
  });

export type { LeafInference } from "../shared/classificador-folha";
export { MAX_FOLHA_BYTES } from "../shared/classificador-folha";

export type FotoDeFolha = {
  bytes: Uint8Array;
  tipo: string;
  nomeArquivo: string;
};

export class ErroClassificadorFolha extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "ErroClassificadorFolha";
  }
}

export function limparNomeArquivo(nome: string): string {
  const semCaminhoOuControle = nome
    .replace(/\\/g, "/")
    .split("/")
    .at(-1)!
    .replace(/[\u0000-\u001f\u007f]/g, "_")
    .trim()
    .slice(0, 180);
  return semCaminhoOuControle || "folha";
}

/** Confere limites e estrutura canônica antes de anexar dados ao histórico. */
export function validarPredicao(valor: unknown) {
  return predicaoSchema.safeParse(valor);
}

export function validarImagemFolha(file: File): string | null {
  if (!(TIPOS_IMAGEM_FOLHA as readonly string[]).includes(file.type.toLowerCase())) {
    return "Formato não aceito. Envie uma foto JPEG, PNG, WebP, BMP ou TIFF.";
  }
  if (file.size === 0) return "A foto está vazia. Escolha outra imagem.";
  if (file.size > MAX_FOLHA_BYTES) return "A foto excede o limite de 20 MiB.";
  return null;
}

/**
 * Insere somente informação textual validada; nenhum provedor de LLM recebe a
 * imagem nem o nome de arquivo, que pode conter texto fornecido pelo usuário.
 */
export function textoComAnalise(mensagem: string, analise?: LeafInference | null): string {
  if (!analise) return mensagem;

  const pontuacoes = analise.top_3
    .map(
      ({ classe, probabilidade }) =>
        `- ${classe}: ${(probabilidade * 100).toFixed(1)}%`,
    )
    .join("\n");

  return `${mensagem}\n\n[Resultado do classificador de cladódios de pitaya — não é diagnóstico]\n` +
    `Modelo: ${analise.modelo}\n` +
    `Classe mais provável: ${analise.classe} (${(analise.confianca * 100).toFixed(1)}%)\n` +
    `Pontuações do modelo entre as classes conhecidas:\n${pontuacoes}\n` +
    "As pontuações não são probabilidades calibradas de diagnóstico. Você recebeu o resultado textual, não a imagem. " +
    "Trate-o como hipótese: não afirme sintomas, gravidade nem diagnóstico confirmado e não infira que a planta está saudável. " +
    "Para orientar o manejo, consulte busca_conhecimento e as ferramentas disponíveis; peça uma foto adequada ou confirmação técnica se necessário.";
}

export async function classificarImagemFolha(foto: FotoDeFolha): Promise<LeafInference> {
  const destino = (
    process.env.CLASSIFICADOR_FOLHA_URL || "http://127.0.0.1:8080"
  ).replace(/\/+$/, "");
  const signal = AbortSignal.timeout(30_000);

  let resposta: Response;
  try {
    const corpo = new Uint8Array(foto.bytes.byteLength);
    corpo.set(foto.bytes);
    resposta = await fetch(`${destino}/classificar`, {
      method: "POST",
      headers: { "Content-Type": foto.tipo },
      body: corpo.buffer,
      cache: "no-store",
      signal,
    });
  } catch (erro) {
    if (signal.aborted) {
      throw new ErroClassificadorFolha(
        "A análise da foto demorou demais. Tente uma imagem menor ou envie novamente.",
        504,
      );
    }
    throw new ErroClassificadorFolha(
      "O serviço de análise de folhas está indisponível. Tente novamente mais tarde.",
      503,
    );
  }

  if (!resposta.ok) {
    const status = resposta.status;
    const mensagens = new Map([
      [413, "A foto excede o limite de 20 MiB."],
      [415, "Formato não aceito. Envie JPEG, PNG, WebP, BMP ou TIFF."],
      [422, "Não consegui ler a foto. Escolha uma imagem válida e tente novamente."],
    ]);
    if (status === 500) {
      throw new ErroClassificadorFolha(
        "O serviço não conseguiu analisar essa foto. Tente novamente mais tarde.",
        502,
      );
    }
    throw new ErroClassificadorFolha(
      mensagens.get(status) ?? "Falha ao analisar a foto. Tente novamente mais tarde.",
      status === 413 || status === 415 || status === 422 ? status : 502,
    );
  }

  let bruto: unknown;
  try {
    bruto = await resposta.json();
  } catch {
    if (signal.aborted) {
      throw new ErroClassificadorFolha(
        "A análise da foto demorou demais. Tente uma imagem menor ou envie novamente.",
        504,
      );
    }
    throw new ErroClassificadorFolha(
      "O serviço de análise respondeu em formato inválido. Tente novamente mais tarde.",
    );
  }
  const predicao = validarPredicao(bruto);
  if (!predicao.success) {
    throw new ErroClassificadorFolha(
      "O serviço de análise retornou um resultado inválido. Tente novamente mais tarde.",
    );
  }

  return {
    ...predicao.data,
    nomeArquivo: limparNomeArquivo(foto.nomeArquivo),
  };
}

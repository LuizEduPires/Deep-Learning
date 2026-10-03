export const MAX_FOLHA_BYTES = 20 * 1024 * 1024;
export const MAX_CORPO_CHAT_BYTES = 21 * 1024 * 1024;
export const PERGUNTA_PADRAO_FOLHA =
  "Analise esta folha de pitaya e explique o resultado.";

export const TIPOS_IMAGEM_FOLHA = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
] as const;

export type LeafCandidate = {
  classe: string;
  probabilidade: number;
};

export type LeafInference = {
  modelo: string;
  classe: string;
  confianca: number;
  top_3: LeafCandidate[];
  nomeArquivo: string;
};

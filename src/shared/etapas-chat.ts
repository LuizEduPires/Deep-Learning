/**
 * Etapas que o servidor anuncia enquanto o agente trabalha, para o chat
 * mostrar o que está acontecendo em vez de um "carregando" mudo.
 *
 * `ferramenta` carrega o nome da tool (busca_conhecimento, consulta_agrofit…):
 * o servidor não traduz nada, quem escolhe a frase é a tela.
 */
export type EtapaChat =
  | { etapa: "foto" }
  | { etapa: "pensando" }
  | { etapa: "ferramenta"; ferramenta: string }
  | { etapa: "escrevendo" };

/**
 * Uma linha do corpo NDJSON de POST /api/chat quando o cliente pede
 * `Accept: application/x-ndjson`. A última é sempre `fim` ou `erro`.
 */
export type EventoChat =
  | ({ tipo: "etapa" } & EtapaChat)
  | { tipo: "fim"; resposta: Record<string, unknown> }
  | { tipo: "erro"; error: string; status: number };

export const TIPO_FLUXO_CHAT = "application/x-ndjson";

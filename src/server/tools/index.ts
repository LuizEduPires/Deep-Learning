import type { ToolDef } from "../llm/types";
import { buscaConhecimento } from "./busca-conhecimento";
import { climaHistorico } from "./clima-historico";
import { consultaAgrofit } from "./consulta-agrofit";
import { previsaoTempo } from "./previsao-tempo";
import { respondeAgro } from "./responde-agro";

/**
 * Conjunto de tools do agente. Responde Agro entra só quando há token —
 * expor uma tool que sempre falha degrada as escolhas do modelo.
 */
export function getTools(): ToolDef[] {
  const tools: ToolDef[] = [
    buscaConhecimento,
    previsaoTempo,
    climaHistorico,
    consultaAgrofit,
  ];
  if (process.env.AGROAPI_TOKEN?.trim()) {
    tools.push(respondeAgro);
  }
  return tools;
}

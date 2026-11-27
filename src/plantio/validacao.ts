import { z } from "zod";

export const entradaPlanoPlantioSchema = z.object({
  propertyId: z.uuid(),
  cultivar: z.string().trim().min(1, "Informe o tipo ou cultivar.").max(120),
  plannedDate: z.iso.date("Informe uma data válida."),
  irrigationAvailable: z.boolean(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type EntradaPlanoPlantio = z.infer<typeof entradaPlanoPlantioSchema>;

export type PlanoParaAnalise = {
  cultivar: string;
  plannedDate: string;
  irrigationAvailable: boolean;
  notes: string | null;
};

export function montarPerguntaAnalise(plano: PlanoParaAnalise) {
  return [
    "Analise este plano de plantio de pitaya usando as ferramentas agronômicas disponíveis.",
    `Tipo ou cultivar informado: ${plano.cultivar}.`,
    `Data pretendida: ${plano.plannedDate}.`,
    `Irrigação disponível: ${plano.irrigationAvailable ? "sim" : "não"}.`,
    `Observações do produtor: ${plano.notes || "nenhuma"}.`,
    "Consulte a base de conhecimento sobre época de plantio e analise os dados de previsão meteorológica para os próximos 14 dias fornecidos abaixo.",
    "Compare as temperaturas mínima e máxima previstas com a recomendação encontrada nas fontes; se não houver uma faixa comprovada para esta cultivar, diga isso e não invente limites.",
    "Explique que a previsão cobre somente os próximos dias e não garante a melhor época anual. Considere chuva, risco de geada quando houver fonte, disponibilidade de irrigação e necessidade de solo úmido sem encharcamento.",
    "Cite as fontes consultadas e indique que a recomendação é orientativa, devendo ser confirmada com assistência técnica local.",
  ].join("\n");
}

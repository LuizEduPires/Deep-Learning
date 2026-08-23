import type { ToolDef } from "../llm/types";

/**
 * Previsão meteorológica via Open-Meteo (gratuita, sem chave).
 * Retorna os dados que importam para decisão de pulverização e irrigação.
 */
export const previsaoTempo: ToolDef = {
  name: "previsao_tempo",
  description:
    "Previsão meteorológica diária (até 14 dias) para a propriedade: chuva, temperatura, vento e umidade. " +
    "Use para responder sobre janela de pulverização, risco de chuva, necessidade de irrigação e risco de estresse térmico. " +
    "Se o usuário não informar coordenadas, usa as da propriedade cadastrada.",
  parameters: {
    type: "object",
    properties: {
      dias: {
        type: "integer",
        description: "Número de dias de previsão (1 a 14). Padrão 7.",
      },
      latitude: {
        type: "number",
        description: "Latitude. Omita para usar a da propriedade cadastrada.",
      },
      longitude: {
        type: "number",
        description: "Longitude. Omita para usar a da propriedade cadastrada.",
      },
    },
    required: [],
  },

  async run(input, ctx) {
    const lat = (input.latitude as number) ?? ctx.property?.latitude;
    const lon = (input.longitude as number) ?? ctx.property?.longitude;

    if (lat == null || lon == null) {
      return {
        text:
          "Nenhuma coordenada disponível. Peça ao usuário para cadastrar a propriedade " +
          "(nome + latitude/longitude) ou informar as coordenadas na pergunta.",
      };
    }

    const dias = Math.min(Math.max((input.dias as number) ?? 7, 1), 14);
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set(
      "daily",
      [
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_sum",
        "precipitation_probability_max",
        "wind_speed_10m_max",
        "relative_humidity_2m_mean",
        "et0_fao_evapotranspiration",
      ].join(","),
    );
    url.searchParams.set("timezone", "America/Sao_Paulo");
    url.searchParams.set("forecast_days", String(dias));

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      throw new Error(`Open-Meteo respondeu ${res.status}`);
    }
    const data = (await res.json()) as {
      daily: Record<string, (number | string)[]>;
    };
    const d = data.daily;

    const linhas = d.time.map((dia, i) => {
      const chuva = d.precipitation_sum[i];
      const prob = d.precipitation_probability_max[i];
      const vento = d.wind_speed_10m_max[i];
      const tmax = d.temperature_2m_max[i];
      const tmin = d.temperature_2m_min[i];
      const ur = d.relative_humidity_2m_mean[i];
      const eto = d.et0_fao_evapotranspiration[i];
      return `${dia}: chuva ${chuva} mm (prob. ${prob}%), vento máx ${vento} km/h, temp ${tmin}–${tmax} °C, UR média ${ur}%, ETo ${eto} mm`;
    });

    return {
      text:
        `Previsão para ${ctx.property?.name ?? `${lat}, ${lon}`} (lat ${lat}, lon ${lon}), próximos ${dias} dias:\n` +
        linhas.join("\n") +
        `\n\nReferência agronômica para pulverização: evitar vento acima de 10 km/h (deriva) ` +
        `e chuva nas 4 h seguintes (lavagem da calda); UR abaixo de 55% aumenta evaporação de gotas.`,
      sources: [
        {
          tool: "previsao_tempo",
          label: "Open-Meteo — previsão meteorológica",
          detail: `lat ${lat}, lon ${lon}, ${dias} dias`,
        },
      ],
    };
  },
};

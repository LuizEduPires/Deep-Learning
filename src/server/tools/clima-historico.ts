import type { ToolDef } from "../llm/types";

/**
 * Clima histórico. Usa a ClimAPI da Embrapa quando há AGROAPI_TOKEN;
 * sem token, cai para o histórico do Open-Meteo (mesma janela de dados).
 */
export const climaHistorico: ToolDef = {
  name: "clima_historico",
  description:
    "Dados climáticos históricos observados (chuva acumulada, temperatura, umidade) para um período passado na propriedade. " +
    "Use para avaliar acúmulo de chuva recente, risco de doença fúngica por molhamento prolongado, " +
    "balanço hídrico e condições que antecederam um problema relatado pelo produtor.",
  parameters: {
    type: "object",
    properties: {
      data_inicio: {
        type: "string",
        description: "Data inicial no formato AAAA-MM-DD.",
      },
      data_fim: {
        type: "string",
        description: "Data final no formato AAAA-MM-DD.",
      },
      latitude: { type: "number", description: "Latitude (opcional)." },
      longitude: { type: "number", description: "Longitude (opcional)." },
    },
    required: ["data_inicio", "data_fim"],
  },

  async run(input, ctx) {
    const lat = (input.latitude as number) ?? ctx.property?.latitude;
    const lon = (input.longitude as number) ?? ctx.property?.longitude;
    const inicio = String(input.data_inicio);
    const fim = String(input.data_fim);

    if (lat == null || lon == null) {
      return {
        text: "Nenhuma coordenada disponível. Peça ao usuário para cadastrar a propriedade.",
      };
    }

    const token = process.env.AGROAPI_TOKEN?.trim();
    if (token) {
      try {
        return await viaClimApi({ lat, lon, inicio, fim, token });
      } catch (err) {
        // Cai para o plano B em vez de derrubar a resposta inteira.
        console.warn(
          "ClimAPI indisponível, usando Open-Meteo:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    return viaOpenMeteo({ lat, lon, inicio, fim });
  },
};

async function viaClimApi(p: {
  lat: number;
  lon: number;
  inicio: string;
  fim: string;
  token: string;
}) {
  const base = process.env.AGROAPI_BASE_URL ?? "https://api.cnptia.embrapa.br";
  const url = new URL(`${base}/climapi/v1/ncep-gfs/prec`);
  url.searchParams.set("latitude", String(p.lat));
  url.searchParams.set("longitude", String(p.lon));
  url.searchParams.set("dataInicial", p.inicio);
  url.searchParams.set("dataFinal", p.fim);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${p.token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`ClimAPI respondeu ${res.status}`);
  const data = await res.json();

  return {
    text:
      `Dados da ClimAPI (Embrapa) para lat ${p.lat}, lon ${p.lon}, de ${p.inicio} a ${p.fim}:\n` +
      JSON.stringify(data).slice(0, 4000),
    sources: [
      {
        tool: "clima_historico",
        label: "ClimAPI — Embrapa",
        detail: `${p.inicio} a ${p.fim}`,
      },
    ],
  };
}

async function viaOpenMeteo(p: {
  lat: number;
  lon: number;
  inicio: string;
  fim: string;
}) {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(p.lat));
  url.searchParams.set("longitude", String(p.lon));
  url.searchParams.set("start_date", p.inicio);
  url.searchParams.set("end_date", p.fim);
  url.searchParams.set(
    "daily",
    [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "relative_humidity_2m_mean",
      "et0_fao_evapotranspiration",
    ].join(","),
  );
  url.searchParams.set("timezone", "America/Sao_Paulo");

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Open-Meteo Archive respondeu ${res.status}`);
  const data = (await res.json()) as {
    daily: Record<string, (number | string)[]>;
  };
  const d = data.daily;

  const chuvaTotal = (d.precipitation_sum as number[]).reduce(
    (a, b) => a + (b ?? 0),
    0,
  );
  const etoTotal = (d.et0_fao_evapotranspiration as number[]).reduce(
    (a, b) => a + (b ?? 0),
    0,
  );

  const linhas = d.time.map(
    (dia, i) =>
      `${dia}: chuva ${d.precipitation_sum[i]} mm, temp ${d.temperature_2m_min[i]}–${d.temperature_2m_max[i]} °C, UR ${d.relative_humidity_2m_mean[i]}%`,
  );

  return {
    text:
      `Histórico observado para lat ${p.lat}, lon ${p.lon}, de ${p.inicio} a ${p.fim}:\n` +
      linhas.join("\n") +
      `\n\nAcumulados no período: chuva ${chuvaTotal.toFixed(1)} mm, ETo ${etoTotal.toFixed(1)} mm ` +
      `(balanço hídrico aproximado: ${(chuvaTotal - etoTotal).toFixed(1)} mm).`,
    sources: [
      {
        tool: "clima_historico",
        label: "Open-Meteo Archive — clima observado",
        detail: `${p.inicio} a ${p.fim}`,
      },
    ],
  };
}

/**
 * Clima para o painel inicial: condição atual e janela de pulverização dos
 * próximos dias, via Open-Meteo (a mesma fonte da tool previsao_tempo).
 *
 * A classificação da janela é um resumo diário e indicativo — a tool do chat
 * continua sendo o caminho para a recomendação detalhada.
 */

export type NivelJanela = "boa" | "atencao" | "evitar";

export interface DiaJanela {
  data: string;
  nivel: NivelJanela;
  motivo: string;
  chuvaMm: number;
  probChuva: number;
  ventoMax: number;
  tempMax: number;
  tempMin: number;
}

export interface Clima {
  atualizadoEm: string;
  agora: {
    temperatura: number;
    umidade: number;
    vento: number;
    descricao: string;
    codigo: number;
  };
  hoje: { tempMax: number; tempMin: number; chuvaMm: number };
  janela: DiaJanela[];
}

/**
 * Limites da classificação. Mesma referência da tool previsao_tempo (vento
 * acima de 10 km/h causa deriva), mas aplicada à rajada máxima do dia, que
 * costuma ocorrer à tarde — por isso a folga maior antes de "evitar".
 */
const LIMITES = {
  chuvaEvitar: 5,
  probEvitar: 70,
  ventoEvitar: 25,
  chuvaAtencao: 1,
  probAtencao: 40,
  ventoAtencao: 15,
};

function classificar(chuva: number, prob: number, vento: number): Pick<DiaJanela, "nivel" | "motivo"> {
  if (chuva >= LIMITES.chuvaEvitar) {
    return { nivel: "evitar", motivo: `Chuva de ${Math.round(chuva)} mm` };
  }
  if (prob >= LIMITES.probEvitar) {
    return { nivel: "evitar", motivo: `${Math.round(prob)}% de chance de chuva` };
  }
  if (vento >= LIMITES.ventoEvitar) {
    return { nivel: "evitar", motivo: `Vento de ${Math.round(vento)} km/h` };
  }
  if (vento >= LIMITES.ventoAtencao) {
    return { nivel: "atencao", motivo: `Rajadas de ${Math.round(vento)} km/h` };
  }
  if (chuva >= LIMITES.chuvaAtencao || prob >= LIMITES.probAtencao) {
    return { nivel: "atencao", motivo: `${Math.round(prob)}% de chance de chuva` };
  }
  return { nivel: "boa", motivo: `Vento ${Math.round(vento)} km/h, sem chuva` };
}

/** Códigos WMO usados pelo Open-Meteo, agrupados no que importa ao produtor. */
function descrever(codigo: number) {
  if (codigo === 0) return "Céu limpo";
  if (codigo <= 2) return "Parcialmente nublado";
  if (codigo === 3) return "Nublado";
  if (codigo <= 48) return "Neblina";
  if (codigo <= 57) return "Garoa";
  if (codigo <= 67) return "Chuva";
  if (codigo <= 77) return "Neve";
  if (codigo <= 82) return "Pancadas de chuva";
  return "Tempestade";
}

/**
 * Previsão por coordenada, guardada em memória. O Open-Meteo às vezes demora
 * ou falha ao conectar; com o cache o painel não fica sem clima a cada falha,
 * e recarregar a página não gera uma chamada nova.
 */
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { em: number; clima: Clima }>();

export async function buscarClima(latitude: number, longitude: number, dias = 3): Promise<Clima> {
  const chave = `${latitude.toFixed(3)},${longitude.toFixed(3)},${dias}`;
  const guardado = cache.get(chave);
  if (guardado && Date.now() - guardado.em < CACHE_MS) return guardado.clima;

  let ultimoErro: unknown;
  // Duas tentativas: a primeira conexão costuma ser a que falha.
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const clima = await consultarOpenMeteo(latitude, longitude, dias);
      cache.set(chave, { em: Date.now(), clima });
      return clima;
    } catch (err) {
      ultimoErro = err;
    }
  }

  // Sem resposta: uma previsão de algumas horas atrás é melhor que nenhuma.
  if (guardado) return guardado.clima;
  throw ultimoErro;
}

async function consultarOpenMeteo(latitude: number, longitude: number, dias: number): Promise<Clima> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
  );
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
  );
  url.searchParams.set("timezone", "America/Sao_Paulo");
  // Hoje + os dias da janela, que começa amanhã.
  url.searchParams.set("forecast_days", String(dias + 1));

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Open-Meteo respondeu ${res.status}`);

  const data = (await res.json()) as {
    current: {
      time: string;
      temperature_2m: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      weather_code: number;
    };
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_sum: number[];
      precipitation_probability_max: (number | null)[];
      wind_speed_10m_max: number[];
    };
  };
  const d = data.daily;

  const janela = d.time.slice(1).map((dia, j) => {
    const i = j + 1;
    const chuva = d.precipitation_sum[i] ?? 0;
    const prob = d.precipitation_probability_max[i] ?? 0;
    const vento = d.wind_speed_10m_max[i] ?? 0;
    return {
      data: dia,
      ...classificar(chuva, prob, vento),
      chuvaMm: chuva,
      probChuva: prob,
      ventoMax: vento,
      tempMax: d.temperature_2m_max[i],
      tempMin: d.temperature_2m_min[i],
    };
  });

  return {
    atualizadoEm: data.current.time,
    agora: {
      temperatura: data.current.temperature_2m,
      umidade: data.current.relative_humidity_2m,
      vento: data.current.wind_speed_10m,
      codigo: data.current.weather_code,
      descricao: descrever(data.current.weather_code),
    },
    hoje: {
      tempMax: d.temperature_2m_max[0],
      tempMin: d.temperature_2m_min[0],
      chuvaMm: d.precipitation_sum[0] ?? 0,
    },
    janela,
  };
}

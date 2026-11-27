"use client";

import { useEffect, useRef, useState } from "react";
import { TIPO_FLUXO_CHAT, type EtapaChat, type EventoChat } from "@/shared/etapas-chat";

/**
 * Frases do andamento do chat, por etapa. Várias por etapa para a espera não
 * soar como disco arranhado: a cada troca sai uma que ainda não apareceu
 * nesta pergunta. Ferramenta sem frase própria cai em `ferramenta`.
 *
 * Para incluir uma tool nova, basta uma chave com o nome dela.
 */
const FRASES: Record<string, string[]> = {
  pensando: [
    "Pensando na sua pergunta…",
    "Entendendo o que você precisa…",
    "Lendo sua pergunta com calma…",
    "Organizando as ideias…",
    "Vendo por onde começar…",
    "Separando o que importa na pergunta…",
  ],
  foto: [
    "Analisando a foto do cladódio…",
    "Olhando a foto de perto…",
    "Procurando sinais de doença na imagem…",
    "Examinando as manchas e a cor da foto…",
  ],
  busca_conhecimento: [
    "Procurando nos boletins técnicos…",
    "Consultando a base de conhecimento…",
    "Folheando os materiais sobre pitaya…",
    "Buscando o que a literatura técnica diz…",
    "Conferindo as cartilhas de cultivo…",
  ],
  previsao_tempo: [
    "Olhando a previsão do tempo…",
    "Checando o clima dos próximos dias…",
    "Vendo se vem chuva por aí…",
    "Conferindo vento e chuva na sua região…",
  ],
  clima_historico: [
    "Conferindo o histórico de chuva e temperatura…",
    "Olhando como o clima andou na região…",
    "Levantando os dados de clima dos últimos dias…",
  ],
  consulta_agrofit: [
    "Consultando os produtos registrados no MAPA…",
    "Buscando no Agrofit…",
    "Conferindo o que é registrado para pitaya…",
    "Verificando os registros de defensivos…",
  ],
  responde_agro: [
    "Buscando conteúdo técnico da Embrapa…",
    "Consultando as respostas da Embrapa…",
  ],
  ferramenta: [
    "Consultando as fontes…",
    "Buscando informações…",
    "Conferindo os dados…",
  ],
  escrevendo: [
    "Juntando as informações…",
    "Montando a resposta…",
    "Organizando o que encontrei…",
    "Escrevendo a resposta…",
    "Conferindo as fontes antes de responder…",
    "Deixando a resposta clara…",
  ],
};

/** Tempo que uma frase fica na tela quando a etapa demora. */
const TROCA_MS = 4000;

function chaveDa(etapa: EtapaChat): string {
  if (etapa.etapa !== "ferramenta") return etapa.etapa;
  return etapa.ferramenta in FRASES ? etapa.ferramenta : "ferramenta";
}

/**
 * Frase do momento para a etapa em andamento. Troca a cada TROCA_MS enquanto a
 * etapa não muda, sem repetir frase dentro da mesma pergunta até esgotar as da
 * etapa. Com `etapa` null (nada em andamento), zera a memória.
 */
function usarFrase(etapa: EtapaChat | null): string {
  const [frase, setFrase] = useState("");
  const usadas = useRef(new Set<string>());
  const chave = etapa ? chaveDa(etapa) : null;

  useEffect(() => {
    if (!chave) {
      usadas.current.clear();
      setFrase("");
      return;
    }
    const opcoes = FRASES[chave];

    function sortear() {
      let livres = opcoes.filter((f) => !usadas.current.has(f));
      if (livres.length === 0) {
        // Esgotou: libera as da etapa, menos a que está na tela.
        opcoes.forEach((f) => usadas.current.delete(f));
        livres = opcoes.length > 1 ? opcoes.filter((f) => f !== frase) : opcoes;
      }
      const escolhida = livres[Math.floor(Math.random() * livres.length)];
      usadas.current.add(escolhida);
      setFrase(escolhida);
    }

    sortear();
    const t = setInterval(sortear, TROCA_MS);
    return () => clearInterval(t);
    // `frase` fica de fora: incluí-la reiniciaria o intervalo a cada troca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return frase;
}

/** As três bolinhas e a frase da etapa. */
export function Andamento({ etapa }: { etapa: EtapaChat | null }) {
  const frase = usarFrase(etapa);
  if (!etapa) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-suave" role="status" aria-live="polite">
      <span className="flex gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-marca-texto" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-marca-texto [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-marca-texto [animation-delay:300ms]" />
      </span>
      <span key={frase} className="surgir">
        {frase}
      </span>
    </div>
  );
}

/**
 * POST /api/chat pedindo o andamento em NDJSON. Repassa cada etapa a
 * `aoEtapa` e devolve a resposta final. Se o servidor responder JSON comum
 * (erro de validação, por exemplo), trata como antes.
 */
export async function perguntarComAndamento<T>(
  init: { headers?: HeadersInit; body: BodyInit },
  aoEtapa: (etapa: EtapaChat) => void,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", TIPO_FLUXO_CHAT);
  const res = await fetch("/api/chat", { method: "POST", headers, body: init.body });

  if (!res.body || !res.headers.get("content-type")?.includes(TIPO_FLUXO_CHAT)) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Falha na requisição");
    return data as T;
  }

  const leitor = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let pendente = "";
  for (;;) {
    const { value, done } = await leitor.read();
    if (value) pendente += value;

    let quebra: number;
    while ((quebra = pendente.indexOf("\n")) >= 0) {
      const linha = pendente.slice(0, quebra).trim();
      pendente = pendente.slice(quebra + 1);
      if (!linha) continue;

      const evento = JSON.parse(linha) as EventoChat;
      if (evento.tipo === "fim") return evento.resposta as T;
      if (evento.tipo === "erro") throw new Error(evento.error);
      const { tipo: _tipo, ...etapa } = evento;
      aoEtapa(etapa as EtapaChat);
    }

    if (done) break;
  }
  throw new Error("A conexão caiu antes de a resposta chegar. Tente de novo.");
}

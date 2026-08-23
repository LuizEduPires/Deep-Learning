"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ConfigLlm from "./config-llm";
import Historico, { type ConversaAberta } from "./historico";
import { usarDitado } from "./usar-ditado";
import {
  IconeAtencao,
  IconeFazenda,
  IconeMicrofone,
  IconeMicrofoneBloqueado,
} from "./icones";

type Source = { tool: string; label: string; detail?: string };
type Msg = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};
type Propriedade = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

const SUGESTOES = [
  "Vai dar pra pulverizar nos próximos 3 dias?",
  "Qual produto é registrado para antracnose em pitaya?",
  "Quando faço a poda de formação?",
  "Como induzir floração fora de época?",
];

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [propriedades, setPropriedades] = useState<Propriedade[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  // Sobe a cada resposta: o histórico reordena e a conversa nova aparece nele.
  const [versao, setVersao] = useState(0);
  const fim = useRef<HTMLDivElement>(null);

  // O ditado acrescenta ao que já está escrito em vez de substituir: o produtor
  // pode digitar, ditar o complemento e revisar antes de enviar.
  const acrescentarFala = useCallback((texto: string) => {
    setInput((atual) => (atual ? `${atual.trimEnd()} ${texto}` : texto));
  }, []);
  const ditado = usarDitado(acrescentarFala);

  useEffect(() => {
    fetch("/api/propriedades")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPropriedades)
      .catch(() => setPropriedades([]));
  }, []);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, carregando]);

  async function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || carregando) return;

    setMsgs((m) => [...m, { role: "user", content: pergunta }]);
    setInput("");
    setCarregando(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: pergunta,
          conversationId,
          propertyId: propriedades[0]?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na requisição");
      setConversationId(data.conversationId);
      setVersao((v) => v + 1);
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: data.text, sources: data.sources },
      ]);
    } catch (err) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: `Não consegui responder: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      ]);
    } finally {
      setCarregando(false);
    }
  }

  async function salvarPropriedade(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/propriedades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name")),
        latitude: Number(form.get("latitude")),
        longitude: Number(form.get("longitude")),
      }),
    });
    if (res.ok) {
      const criada: Propriedade = await res.json();
      setPropriedades((p) => [...p, criada]);
      setMostrarForm(false);
    }
  }

  function abrirConversa(conversa: ConversaAberta) {
    setConversationId(conversa.id);
    setMsgs(conversa.mensagens);
    setInput("");
  }

  function novaConversa() {
    setConversationId(undefined);
    setMsgs([]);
    setInput("");
  }

  const prop = propriedades[0];

  const rotuloDitado = ditado.bloqueado
    ? "Microfone sem acesso — libere no navegador"
    : ditado.gravando
      ? "Parar de ditar"
      : "Ditar por voz";

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b py-5"
        style={{ borderColor: "var(--borda)" }}
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            🐉 Dr. Pitaya
          </h1>
          <p className="text-sm" style={{ color: "var(--suave)" }}>
            Manejo com clima, Agrofit e base técnica
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Historico
            conversaAtual={conversationId}
            versao={versao}
            aoAbrir={abrirConversa}
            aoNova={novaConversa}
          />
          <ConfigLlm />
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ borderColor: "var(--borda)", color: "var(--suave)" }}
          >
            <IconeFazenda />
            {prop ? prop.name : "Cadastrar propriedade"}
          </button>
        </div>
      </header>

      {mostrarForm && (
        <form
          onSubmit={salvarPropriedade}
          className="mt-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-3"
          style={{ borderColor: "var(--borda)", background: "var(--painel)" }}
        >
          <label className="flex flex-col gap-1 text-sm sm:col-span-3">
            Nome da propriedade
            <input
              name="name"
              required
              placeholder="Sítio Boa Vista"
              className="rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--borda)", background: "transparent" }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Latitude
            <input
              name="latitude"
              type="number"
              step="any"
              required
              placeholder="-22.9"
              className="rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--borda)", background: "transparent" }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Longitude
            <input
              name="longitude"
              type="number"
              step="any"
              required
              placeholder="-47.1"
              className="rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--borda)", background: "transparent" }}
            />
          </label>
          <button
            type="submit"
            className="self-end rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: "var(--acento)" }}
          >
            Salvar
          </button>
        </form>
      )}

      <main className="flex-1 space-y-5 py-6">
        {msgs.length === 0 && (
          <div className="space-y-4 py-8">
            <p style={{ color: "var(--suave)" }}>
              Pergunte sobre manejo, clima ou produtos registrados. As respostas
              citam a fonte consultada.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="rounded-full border px-3 py-1.5 text-sm transition-colors"
                  style={{
                    borderColor: "var(--borda)",
                    background: "var(--painel)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {!prop && (
              <p className="text-sm" style={{ color: "var(--suave)" }}>
                Cadastre a propriedade para habilitar as perguntas de clima.
              </p>
            )}
          </div>
        )}

        {msgs.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : ""}
          >
            <div
              className="max-w-[90%] rounded-2xl px-4 py-3 leading-relaxed"
              style={
                m.role === "user"
                  ? { background: "var(--acento-suave)" }
                  : {
                      background: "var(--painel)",
                      border: "1px solid var(--borda)",
                    }
              }
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "assistant" && (
                <div
                  className="mt-3 border-t pt-2 text-xs"
                  style={{ borderColor: "var(--borda)", color: "var(--suave)" }}
                >
                  {m.sources && m.sources.length > 0 ? (
                    <>
                      <span className="font-medium">Fontes consultadas:</span>
                      <ul className="mt-1 space-y-0.5">
                        {m.sources.map((s, j) => (
                          <li key={j}>
                            • {s.label}
                            {s.detail ? ` — ${s.detail}` : ""}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    /*
                     * Sem este aviso, resposta sem lastro fica visualmente
                     * idêntica a uma consultada — o produtor não tem como
                     * distinguir. O modelo é instruído a declarar a origem,
                     * mas instrução de estilo já se mostrou pouco confiável;
                     * a lista de fontes vem do agente, não do texto, então
                     * este aviso é verdade verificável.
                     */
                    <span className="flex items-start gap-1.5 font-medium">
                      <IconeAtencao className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Nenhuma fonte consultada — resposta de conhecimento
                        geral, não verificada na base técnica.
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {carregando && (
          <p className="text-sm italic" style={{ color: "var(--suave)" }}>
            Consultando as fontes…
          </p>
        )}
        <div ref={fim} />
      </main>

      <div className="sticky bottom-0 py-4" style={{ background: "var(--fundo)" }}>
        {(ditado.gravando || ditado.erro) && (
          <p className="px-4 pb-2 text-xs" style={{ color: ditado.erro ? "var(--alerta, #b91c1c)" : "var(--suave)" }}>
            {ditado.erro
              ? ditado.erro
              : ditado.parcial
                ? `Ouvindo: ${ditado.parcial}`
                : "Ouvindo… pode falar."}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre o manejo da sua pitaya…"
            className="flex-1 rounded-full border px-4 py-3"
            style={{ borderColor: "var(--borda)", background: "var(--painel)" }}
          />

          {ditado.suportado && (
            <button
              type="button"
              onClick={ditado.alternar}
              disabled={carregando}
              aria-pressed={ditado.gravando}
              aria-label={rotuloDitado}
              title={rotuloDitado}
              className="rounded-full border p-3 disabled:opacity-40"
              style={{
                borderColor: ditado.gravando ? "transparent" : "var(--borda)",
                background: ditado.gravando ? "#b91c1c" : "var(--painel)",
                color: ditado.gravando
                  ? "#ffffff"
                  : ditado.bloqueado
                    ? "var(--alerta, #b91c1c)"
                    : "var(--texto)",
              }}
            >
              {ditado.bloqueado ? (
                <IconeMicrofoneBloqueado />
              ) : (
                <IconeMicrofone />
              )}
            </button>
          )}

          <button
            type="submit"
            disabled={carregando || !input.trim()}
            className="rounded-full px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: "var(--acento)" }}
          >
            Enviar
          </button>
        </form>
      </div>

      <p
        className="pb-4 text-center text-xs"
        style={{ color: "var(--suave)" }}
      >
        Informações de registro no MAPA não substituem receituário agronômico.
      </p>
    </div>
  );
}

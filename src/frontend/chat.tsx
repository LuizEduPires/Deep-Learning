"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usarDitado } from "./usar-ditado";
import { usarPropriedade, type Fonte } from "./dados";
import { IconeMicrofone, IconeMicrofoneBloqueado } from "./icones";
import { Icone, Logo, type NomeIcone } from "./ui";
import {
  MAX_FOLHA_BYTES,
  PERGUNTA_PADRAO_FOLHA,
  TIPOS_IMAGEM_FOLHA,
  type LeafInference,
} from "@/shared/classificador-folha";

type Msg = {
  role: "user" | "assistant";
  content: string;
  sources?: Fonte[];
  leafInference?: LeafInference;
  erro?: boolean;
};

const SUGESTOES = [
  "Vai dar pra pulverizar nos próximos 3 dias?",
  "Qual produto é registrado para antracnose em pitaya?",
  "Quando faço a poda de formação?",
  "Como induzir floração fora de época?",
];

/** Ícone da fonte pela tool que a produziu. */
function iconeDaFonte(tool: string): NomeIcone {
  if (tool.includes("tempo") || tool.includes("clima")) return "chuva";
  if (tool.includes("agrofit") || tool.includes("bioinsumo")) return "escudo";
  return "livro";
}

export default function Chat() {
  const router = useRouter();
  const params = useSearchParams();
  const idNaUrl = params.get("id");
  const perguntaNaUrl = params.get("q");

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [titulo, setTitulo] = useState("Nova conversa");
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [modelo, setModelo] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const { propriedade } = usarPropriedade();
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const seletorFoto = useRef<HTMLInputElement>(null);
  const envioAtivo = useRef(false);
  const perguntaEnviada = useRef<string | null>(null);
  const tiposAceitos = TIPOS_IMAGEM_FOLHA.join(",");
  const fotoUrl = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);
  useEffect(
    () => () => {
      if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    },
    [fotoUrl],
  );

  // O ditado acrescenta ao que já está escrito em vez de substituir: o produtor
  // pode digitar, ditar o complemento e revisar antes de enviar.
  const acrescentarFala = useCallback((texto: string) => {
    setInput((atual) => (atual ? `${atual.trimEnd()} ${texto}` : texto));
  }, []);
  const ditado = usarDitado(acrescentarFala);

  useEffect(() => {
    fetch("/api/llm")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setModelo(d?.atual?.model ?? null))
      .catch(() => setModelo(null));
  }, []);

  // Abre a conversa pedida na URL (vinda do histórico).
  useEffect(() => {
    if (!idNaUrl || idNaUrl === conversationId) return;
    setFoto(null);
    setErroFoto(null);
    setInput("");
    setAbrindo(true);
    fetch(`/api/conversas/${idNaUrl}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Falha ao abrir");
        setConversationId(data.id);
        setTitulo(data.title);
        setMsgs(data.mensagens);
      })
      .catch((e) =>
        setMsgs([
          {
            role: "assistant",
            content: `Não consegui abrir a conversa: ${e instanceof Error ? e.message : String(e)}`,
            erro: true,
          },
        ]),
      )
      .finally(() => setAbrindo(false));
    // Só a URL dispara a abertura; conversationId muda também ao responder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNaUrl]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, carregando]);

  // Altura do campo acompanha o texto, até um limite.
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const enviar = useCallback(
    async (texto: string, imagem?: File | null) => {
      const perguntaDigitada = texto.trim();
      const pergunta = perguntaDigitada || (imagem ? PERGUNTA_PADRAO_FOLHA : "");
      if ((!pergunta && !imagem) || carregando || envioAtivo.current) return;
      envioAtivo.current = true;

      setMsgs((m) => [...m, { role: "user", content: pergunta }]);
      setCarregando(true);
      if (!conversationId) setTitulo(pergunta.length > 60 ? `${pergunta.slice(0, 57)}…` : pergunta);

      try {
        let headers: HeadersInit | undefined;
        let body: BodyInit;
        if (imagem) {
          const formulario = new FormData();
          formulario.append("image", imagem, imagem.name);
          formulario.append("message", pergunta);
          if (conversationId) formulario.append("conversationId", conversationId);
          if (propriedade?.id) formulario.append("propertyId", propriedade.id);
          body = formulario;
        } else {
          headers = { "Content-Type": "application/json" };
          body = JSON.stringify({
            message: pergunta,
            conversationId,
            propertyId: propriedade?.id,
          });
        }
        const res = await fetch("/api/chat", {
          method: "POST",
          ...(headers ? { headers } : {}),
          body,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha na requisição");
        setConversationId(data.conversationId);
        setInput("");
        setFoto(null);
        setErroFoto(null);
        // A URL passa a apontar para a conversa: recarregar não a perde.
        router.replace(`/chat?id=${data.conversationId}`, { scroll: false });
        setMsgs((m) => [
          ...m.slice(0, -1),
          {
            ...m[m.length - 1],
            ...(data.leafInference ? { leafInference: data.leafInference as LeafInference } : {}),
          },
          {
            role: "assistant",
            content: data.text,
            sources: data.sources,
          },
        ]);
      } catch (err) {
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            content: `Não consegui responder: ${err instanceof Error ? err.message : String(err)}`,
            erro: true,
          },
        ]);
      } finally {
        envioAtivo.current = false;
        setCarregando(false);
      }
    },
    [carregando, conversationId, propriedade?.id, router],
  );

  // Pergunta sugerida vinda do painel: envia assim que a propriedade carregar,
  // para as perguntas de clima já irem com as coordenadas.
  useEffect(() => {
    if (!perguntaNaUrl || propriedade === undefined) return;
    if (perguntaEnviada.current === perguntaNaUrl) return;
    perguntaEnviada.current = perguntaNaUrl;
    enviar(perguntaNaUrl);
  }, [perguntaNaUrl, propriedade, enviar]);

  function novaConversa() {
    setConversationId(undefined);
    setMsgs([]);
    setInput("");
    setFoto(null);
    setErroFoto(null);
    setTitulo("Nova conversa");
    perguntaEnviada.current = null;
    router.replace("/chat", { scroll: false });
  }

  const rotuloDitado = ditado.bloqueado
    ? "Microfone sem acesso — libere no navegador"
    : ditado.gravando
      ? "Parar de ditar"
      : "Ditar por voz";

  const subtitulo = [propriedade?.name, modelo].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-borda bg-fundo/95 px-2 py-2.5 backdrop-blur md:px-6">
        <Link
          href="/"
          aria-label="Voltar ao início"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-painel md:hidden"
        >
          <Icone nome="esquerda" className="h-[22px] w-[22px]" />
        </Link>
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-base font-bold">{titulo}</div>
          {subtitulo && (
            <div className="flex items-center gap-1 text-xs text-suave">
              {propriedade && <Icone nome="pin" className="h-3 w-3" />}
              <span className="truncate">{subtitulo}</span>
            </div>
          )}
        </div>
        <Link
          href="/conversas"
          aria-label="Histórico de conversas"
          title="Histórico de conversas"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-painel"
        >
          <Icone nome="relogio" className="h-[21px] w-[21px]" />
        </Link>
        <button
          type="button"
          onClick={novaConversa}
          aria-label="Nova conversa"
          title="Nova conversa"
          disabled={carregando}
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-painel disabled:opacity-40"
        >
          <Icone nome="lapis" className="h-[21px] w-[21px]" />
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pt-5 pb-6 md:px-6">
        {msgs.length === 0 && !abrindo && (
          <div className="flex flex-col gap-5 py-6">
            <div className="flex items-center gap-3">
              <Logo className="h-12 w-12" />
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight">Pergunte ao Dr. Pitaya</h1>
                <p className="text-[15px] text-suave">
                  Manejo, clima ou produtos registrados. As respostas citam a fonte consultada.
                </p>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {SUGESTOES.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => enviar(s, foto)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-borda bg-painel px-4 py-2 text-left text-[15px] transition hover:border-suave"
                  >
                    <Icone nome="brilho" className="h-[18px] w-[18px] text-acento" />
                    <span className="flex-1">{s}</span>
                  </button>
                </li>
              ))}
            </ul>
            {propriedade === null && (
              <p className="flex items-start gap-2 text-sm text-suave">
                <Icone nome="pin" className="mt-0.5 h-4 w-4" />
                <span>
                  <Link href="/fazenda" className="-my-3 inline-block py-3 font-bold text-marca-texto underline">
                    Cadastre a propriedade
                  </Link>{" "}
                  para habilitar as perguntas de clima.
                </span>
              </p>
            )}
          </div>
        )}

        {abrindo && <p className="text-sm text-suave">Abrindo conversa…</p>}

        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              className="max-w-[85%] self-end rounded-[20px] rounded-br-md bg-acento px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-white"
            >
              {m.content}
              {m.leafInference && <CartaoFolha analise={m.leafInference} />}
            </div>
          ) : (
            <article key={i} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[13px] font-bold text-texto-2">
                <Logo className="h-[26px] w-[26px]" />
                Dr. Pitaya
              </div>
              <div
                className={`rounded-[20px] rounded-tl-md border px-4 py-4 text-[15px] leading-relaxed ${
                  m.erro ? "border-acento-texto/40 bg-acento-suave" : "border-borda bg-painel"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {!m.erro && <Fontes fontes={m.sources} />}
              </div>
            </article>
          ),
        )}

        {carregando && (
          <div className="flex items-center gap-2 text-sm text-suave" role="status">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-marca-texto" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-marca-texto [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-marca-texto [animation-delay:300ms]" />
            </span>
            {foto ? "Analisando a foto e preparando a resposta…" : "Consultando as fontes…"}
          </div>
        )}
        <div ref={fim} />
      </main>

      <div className="sticky bottom-0 z-20 border-t border-borda bg-fundo px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] md:px-6">
        <div className="mx-auto max-w-3xl">
          {(ditado.gravando || ditado.erro) && (
            <p className={`px-3 pb-2 text-xs ${ditado.erro ? "text-acento-texto" : "text-suave"}`}>
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
              enviar(input, foto);
            }}
            className="flex flex-col gap-1.5 rounded-3xl border-[1.5px] border-borda bg-painel p-1.5 focus-within:border-marca-texto"
          >
            {foto && (
              <div className="flex items-center gap-3 rounded-2xl border border-borda bg-fundo p-2">
                {fotoUrl && foto.type !== "image/tiff" ? (
                  <img
                    src={fotoUrl}
                    alt="Prévia da folha selecionada"
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-marca-suave text-marca-texto">
                    <Icone nome="broto" className="h-7 w-7" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-suave">Analisar folha</span>
                  <span className="block truncate text-sm" title={foto.name}>{foto.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFoto(null);
                    setErroFoto(null);
                    if (seletorFoto.current) seletorFoto.current.value = "";
                  }}
                  disabled={carregando}
                  aria-label="Remover foto"
                  title="Remover foto"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-suave hover:bg-painel disabled:opacity-40"
                >
                  <Icone nome="x" className="h-5 w-5" />
                </button>
              </div>
            )}

            {erroFoto && <p className="px-3 text-sm text-acento-texto" role="alert">{erroFoto}</p>}

            <div className="flex items-end gap-1.5">
            <label htmlFor="pergunta" className="sr-only">
              Sua pergunta
            </label>
            <textarea
              id="pergunta"
              ref={campo}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={carregando}
              onKeyDown={(e) => {
                // Enter envia; Shift+Enter quebra a linha.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar(input, foto);
                }
              }}
              placeholder="Sua pergunta…"
              className="max-h-[140px] min-h-11 flex-1 resize-none bg-transparent py-2.5 pr-2 pl-3 text-base leading-6 outline-none md:text-[15px] placeholder:text-suave"
            />

            <input
              ref={seletorFoto}
              type="file"
              accept={tiposAceitos}
              className="sr-only"
              tabIndex={-1}
              aria-label="Escolher foto da folha"
              onChange={(e) => {
                const selecionada = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                setErroFoto(null);
                if (!selecionada) return;
                const tipo = selecionada.type.toLowerCase();
                if (!tipo.startsWith("image/") || !(TIPOS_IMAGEM_FOLHA as readonly string[]).includes(tipo)) {
                  setErroFoto("Formato não aceito. Envie uma foto JPEG, PNG, WebP, BMP ou TIFF.");
                  return;
                }
                if (selecionada.size === 0) {
                  setErroFoto("A foto está vazia. Escolha outra imagem.");
                  return;
                }
                if (selecionada.size > MAX_FOLHA_BYTES) {
                  setErroFoto("A foto excede o limite de 20 MiB.");
                  return;
                }
                setFoto(selecionada);
              }}
            />

            <button
              type="button"
              onClick={() => seletorFoto.current?.click()}
              disabled={carregando}
              aria-label={foto ? "Trocar foto da folha" : "Analisar folha"}
              title={foto ? "Trocar foto da folha" : "Analisar folha"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fundo text-marca-texto disabled:opacity-40"
            >
              <Icone nome="broto" className="h-5 w-5" />
            </button>

            {ditado.suportado && (
              <button
                type="button"
                onClick={ditado.alternar}
                disabled={carregando}
                aria-pressed={ditado.gravando}
                aria-label={rotuloDitado}
                title={rotuloDitado}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${
                  ditado.gravando
                    ? "bg-[#b91c1c] text-white"
                    : ditado.bloqueado
                      ? "bg-fundo text-acento-texto"
                      : "bg-fundo text-texto"
                }`}
              >
                {ditado.bloqueado ? (
                  <IconeMicrofoneBloqueado className="h-5 w-5" />
                ) : (
                  <IconeMicrofone className="h-5 w-5" />
                )}
              </button>
            )}

            <button
              type="submit"
              disabled={carregando || (!input.trim() && !foto)}
              aria-label={foto ? "Analisar foto e enviar pergunta" : "Enviar pergunta"}
              title={foto ? "Analisar foto e enviar pergunta" : "Enviar pergunta"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-acento text-white disabled:opacity-40"
            >
              <Icone nome="enviar" className="h-5 w-5" strokeWidth={2.2} />
            </button>
            </div>
          </form>
          <p className="mt-2 text-center text-xs text-suave">
            Registro no MAPA não substitui o receituário agronômico.
          </p>
        </div>
      </div>
    </div>
  );
}

function Fontes({ fontes }: { fontes?: Fonte[] }) {
  if (!fontes || fontes.length === 0) {
    /*
     * Sem este aviso, resposta sem lastro fica visualmente idêntica a uma
     * consultada — o produtor não tem como distinguir. O modelo é instruído a
     * declarar a origem, mas instrução de estilo já se mostrou pouco confiável;
     * a lista de fontes vem do agente, não do texto, então este aviso é
     * verdade verificável.
     */
    return (
      <div className="mt-3 flex gap-2 rounded-xl bg-alerta-suave px-3 py-2.5 text-[13px] leading-snug text-alerta-texto">
        <Icone nome="triangulo" className="mt-px h-4 w-4" />
        <span>
          <strong>Nenhuma fonte técnica consultada.</strong> Orientação de manejo não verificada na
          base técnica.
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3.5 border-t border-linha pt-3">
      <div className="text-[11px] font-bold tracking-[0.08em] text-suave uppercase">
        Fontes consultadas
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {fontes.map((f, j) => (
          <li
            key={j}
            title={f.detail}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-borda bg-fundo px-2.5 py-1.5 text-[13px]"
          >
            <Icone nome={iconeDaFonte(f.tool)} className="h-3.5 w-3.5 text-marca-texto" />
            <span className="truncate">{f.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CartaoFolha({ analise }: { analise: LeafInference }) {
  return (
    <figure className="mt-3 rounded-2xl border border-white/30 bg-black/10 px-3.5 py-3 text-sm">
      <figcaption className="flex items-center gap-1.5 text-xs font-bold">
        <Icone nome="broto" className="h-4 w-4" />
        Resultado do classificador · {analise.nomeArquivo}
      </figcaption>
      <p className="mt-2 font-bold">{analise.classe} · {(analise.confianca * 100).toFixed(1)}%</p>
      <p className="mt-2 text-xs font-bold">Pontuação do modelo</p>
      <ul className="mt-1 space-y-0.5 text-xs" aria-label="Três principais pontuações do modelo">
        {analise.top_3.map((candidato) => (
          <li key={candidato.classe} className="flex justify-between gap-3">
            <span>{candidato.classe}</span>
            <span className="tabular-nums">{(candidato.probabilidade * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-snug opacity-80">
        Sugestão automática, não é um diagnóstico. Confirme com orientação técnica.
      </p>
    </figure>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { IconeConversas } from "./icones";

type Source = { tool: string; label: string; detail?: string };

export type MensagemSalva = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

export type ConversaAberta = {
  id: string;
  title: string;
  mensagens: MensagemSalva[];
};

type ItemDoHistorico = {
  id: string;
  title: string;
  criadaEm: string;
  ultimaEm: string;
  mensagens: number;
};

type Props = {
  /** Conversa em tela, para destacar na lista e saber o que recarregar. */
  conversaAtual?: string;
  /** Muda a cada resposta recebida: a lista reordena e ganha a conversa nova. */
  versao: number;
  aoAbrir: (conversa: ConversaAberta) => void;
  aoNova: () => void;
};

/** "14:32" hoje, "ontem", "12 de ago" antes disso. */
function quando(iso: string) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";

  const agora = new Date();
  const meiaNoite = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
  ).getTime();
  const umDia = 24 * 60 * 60 * 1000;

  if (data.getTime() >= meiaNoite) {
    return data.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (data.getTime() >= meiaNoite - umDia) return "ontem";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * Histórico de conversas: as anteriores já estavam no banco, mas recarregar a
 * página começava do zero e não havia caminho de volta para nenhuma delas.
 */
export default function Historico({
  conversaAtual,
  versao,
  aoAbrir,
  aoNova,
}: Props) {
  const [lista, setLista] = useState<ItemDoHistorico[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const [posicao, setPosicao] = useState<{
    top: number;
    right: number;
    width: number;
  } | null>(null);

  // A lista só é buscada com o painel aberto: quem nunca abre não paga por ela.
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;

    fetch("/api/conversas")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falhou"))))
      .then((d: ItemDoHistorico[]) => {
        if (!cancelado) setLista(d);
      })
      .catch(() => {
        if (!cancelado) setErro("Não consegui carregar o histórico.");
      });

    return () => {
      cancelado = true;
    };
  }, [aberto, versao]);

  /**
   * Posiciona o painel abaixo do botão sem deixar sobrar para fora da tela —
   * mesmo cálculo do painel de modelo, pelo mesmo motivo: no celular o botão
   * fica no canto direito e a ancoragem pela direita vazava pela esquerda.
   */
  useEffect(() => {
    if (!aberto) return;

    const medir = () => {
      const r = botao.current?.getBoundingClientRect();
      if (!r) return;
      const margem = 16;
      const width = Math.min(352, window.innerWidth - margem * 2);
      setPosicao({
        top: r.bottom + 8,
        right: Math.min(
          Math.max(window.innerWidth - r.right, margem),
          window.innerWidth - width - margem,
        ),
        width,
      });
    };

    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [aberto]);

  async function abrir(id: string) {
    if (id === conversaAtual) {
      setAberto(false);
      return;
    }
    setCarregando(id);
    setErro(null);
    try {
      const res = await fetch(`/api/conversas/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao abrir");
      aoAbrir(data as ConversaAberta);
      setAberto(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setCarregando(null);
    }
  }

  async function apagar(id: string) {
    setCarregando(id);
    setErro(null);
    try {
      const res = await fetch(`/api/conversas/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao apagar");
      }
      setLista((l) => (l ?? []).filter((c) => c.id !== id));
      setConfirmando(null);
      // Apagou a que está na tela: o chat não pode continuar escrevendo nela.
      if (id === conversaAtual) aoNova();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setCarregando(null);
    }
  }

  return (
    <>
      <button
        ref={botao}
        onClick={() => {
          setAberto((v) => !v);
          setConfirmando(null);
        }}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-opacity hover:opacity-70"
        style={{ borderColor: "var(--borda)", color: "var(--suave)" }}
        title="Conversas anteriores"
      >
        <IconeConversas />
        Conversas
      </button>

      {aberto && posicao && (
        <div
          className="fixed z-20 flex max-h-[75vh] flex-col gap-3 overflow-y-auto rounded-xl border p-4 shadow-lg"
          style={{
            top: posicao.top,
            right: posicao.right,
            width: posicao.width,
            borderColor: "var(--borda)",
            background: "var(--painel)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Conversas</h2>
            <button
              onClick={() => {
                aoNova();
                setAberto(false);
              }}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-white"
              style={{ background: "var(--acento)" }}
            >
              Nova conversa
            </button>
          </div>

          {erro && (
            <p className="text-sm" style={{ color: "var(--acento)" }}>
              {erro}
            </p>
          )}

          {lista === null && !erro && (
            <p className="text-sm" style={{ color: "var(--suave)" }}>
              Carregando…
            </p>
          )}

          {lista?.length === 0 && (
            <p className="text-sm" style={{ color: "var(--suave)" }}>
              Nenhuma conversa ainda. A primeira pergunta abre uma.
            </p>
          )}

          <ul className="flex flex-col gap-1">
            {lista?.map((c) => {
              const atual = c.id === conversaAtual;
              return (
                <li key={c.id}>
                  <div
                    className="flex items-start gap-2 rounded-lg px-2 py-1.5"
                    style={{
                      background: atual ? "var(--acento-suave)" : "transparent",
                    }}
                  >
                    <button
                      onClick={() => abrir(c.id)}
                      disabled={carregando === c.id}
                      className="flex-1 text-left text-sm disabled:opacity-50"
                      title={c.title}
                    >
                      <span className="line-clamp-2">{c.title}</span>
                      <span
                        className="mt-0.5 block text-xs"
                        style={{ color: "var(--suave)" }}
                      >
                        {quando(c.ultimaEm)} · {c.mensagens}{" "}
                        {c.mensagens === 1 ? "mensagem" : "mensagens"}
                        {atual ? " · em tela" : ""}
                      </span>
                    </button>

                    {confirmando === c.id ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs">
                        <button
                          onClick={() => apagar(c.id)}
                          disabled={carregando === c.id}
                          className="rounded px-2 py-1 font-medium disabled:opacity-50"
                          style={{ color: "var(--acento)" }}
                        >
                          Apagar
                        </button>
                        <button
                          onClick={() => setConfirmando(null)}
                          className="rounded px-2 py-1"
                          style={{ color: "var(--suave)" }}
                        >
                          Não
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmando(c.id)}
                        className="shrink-0 rounded px-2 py-1 text-xs transition-opacity hover:opacity-70"
                        style={{ color: "var(--suave)" }}
                        title="Apagar conversa"
                        aria-label={`Apagar conversa: ${c.title}`}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

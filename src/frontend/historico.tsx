"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { grupoDoDia, quando } from "./dados";
import { CabecalhoPagina, Icone, classeCartao } from "./ui";

type ItemDoHistorico = {
  id: string;
  title: string;
  criadaEm: string;
  ultimaEm: string;
  mensagens: number;
};

const GRUPOS = ["Hoje", "Ontem", "Anteriores"] as const;

/** Tira acentos e caixa para a busca achar "podridao" em "Podridão". */
function normalizar(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Histórico de conversas: as anteriores já estavam no banco, mas recarregar a
 * página começava do zero e não havia caminho de volta para nenhuma delas.
 */
export default function Historico() {
  const [lista, setLista] = useState<ItemDoHistorico[] | null>(null);
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/conversas")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falhou"))))
      .then((d: ItemDoHistorico[]) => setLista(d))
      .catch(() => setErro("Não consegui carregar o histórico."));
  }, []);

  async function apagar(id: string) {
    setOcupado(id);
    setErro(null);
    try {
      const res = await fetch(`/api/conversas/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao apagar");
      }
      setLista((l) => (l ?? []).filter((c) => c.id !== id));
      setConfirmando(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setOcupado(null);
    }
  }

  const grupos = useMemo(() => {
    const termo = normalizar(busca.trim());
    const filtradas = (lista ?? []).filter((c) => !termo || normalizar(c.title).includes(termo));
    return GRUPOS.map((g) => ({
      nome: g,
      itens: filtradas.filter((c) => grupoDoDia(c.ultimaEm) === g),
    })).filter((g) => g.itens.length > 0);
  }, [lista, busca]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 pt-6 pb-8 md:px-8 md:pt-8">
      <CabecalhoPagina
        titulo="Conversas"
        acao={
          <Link
            href="/chat"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-acento px-4 text-[15px] font-bold text-white transition-opacity hover:opacity-90"
          >
            <Icone nome="mais" className="h-[18px] w-[18px]" strokeWidth={2.2} />
            Nova
          </Link>
        }
      />

      <label className="relative flex items-center">
        <span className="sr-only">Buscar nas conversas</span>
        <Icone nome="busca" className="pointer-events-none absolute left-3.5 h-[18px] w-[18px] text-suave" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nas conversas"
          className="min-h-12 w-full rounded-2xl border border-borda bg-painel pr-3 pl-10 text-base outline-none md:text-[15px] placeholder:text-suave focus:border-marca-texto"
        />
      </label>

      {erro && <p className="rounded-2xl bg-acento-suave px-4 py-3 text-sm text-acento-texto">{erro}</p>}

      {lista === null && !erro && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-painel" />
          ))}
        </div>
      )}

      {lista?.length === 0 && (
        <div className={`${classeCartao} flex flex-col items-center gap-2 px-6 py-10 text-center`}>
          <Icone nome="conversa" className="h-8 w-8 text-suave" />
          <p className="font-bold">Nenhuma conversa ainda</p>
          <p className="text-sm text-suave">A primeira pergunta abre uma.</p>
        </div>
      )}

      {lista && lista.length > 0 && grupos.length === 0 && (
        <p className="text-sm text-suave">Nenhuma conversa com &ldquo;{busca}&rdquo;.</p>
      )}

      {grupos.map((g) => (
        <section key={g.nome} className="flex flex-col gap-2">
          <h2 className="text-xs font-bold tracking-[0.08em] text-suave uppercase">{g.nome}</h2>
          <ul className={`${classeCartao} overflow-hidden`}>
            {g.itens.map((c, i) => (
              <li key={c.id} className={`flex items-center ${i > 0 ? "border-t border-linha" : ""}`}>
                <Link
                  href={`/chat?id=${c.id}`}
                  className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pr-1 pl-3.5 transition hover:bg-fundo"
                >
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-marca-suave text-marca-texto">
                    <Icone nome="conversa" className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold">{c.title}</span>
                    <span className="mt-0.5 block text-[13px] text-suave">
                      {quando(c.ultimaEm)} · {c.mensagens} {c.mensagens === 1 ? "mensagem" : "mensagens"}
                    </span>
                  </span>
                </Link>

                {confirmando === c.id ? (
                  <span className="flex shrink-0 items-center gap-1 pr-2 text-sm">
                    <button
                      type="button"
                      onClick={() => apagar(c.id)}
                      disabled={ocupado === c.id}
                      className="min-h-11 rounded-lg px-2.5 font-bold text-acento-texto disabled:opacity-50"
                    >
                      Apagar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      className="min-h-11 rounded-lg px-2.5 text-suave"
                    >
                      Não
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmando(c.id)}
                    aria-label={`Apagar conversa: ${c.title}`}
                    title="Apagar conversa"
                    className="mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-suave transition hover:bg-fundo hover:text-acento-texto"
                  >
                    <Icone nome="lixeira" className="h-[18px] w-[18px]" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

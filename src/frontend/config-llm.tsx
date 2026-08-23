"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconeAtencao,
  IconeChave,
  IconeLlm,
  IconeSemChave,
} from "./icones";

type Modelo = { id: string; rotulo: string; nota?: string };

type Provedor = {
  id: string;
  rotulo: string;
  envChave: string;
  modeloPadrao: string;
  modelos: Modelo[];
  ajuda: string;
  temChave: boolean;
};

type Atual = {
  provider: string;
  model: string;
  origem: "painel" | "env";
  aviso?: string;
};

type Estado = { atual: Atual; provedores: Provedor[] };

const OUTRO = "__outro__";

/**
 * Painel de troca de LLM: escolhe provedor e modelo em runtime, sem editar o
 * .env nem reiniciar o servidor. As chaves de API continuam no .env — aqui só
 * se vê quais provedores têm chave.
 */
export default function ConfigLlm() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [aberto, setAberto] = useState(false);
  const [provider, setProvider] = useState("");
  const [modelo, setModelo] = useState("");
  const [outro, setOutro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const [posicao, setPosicao] = useState<{
    top: number;
    right: number;
    width: number;
  } | null>(null);

  /**
   * Posiciona o painel abaixo do botão sem deixar sobrar para fora da tela.
   * Ancorar só pela direita do botão jogava o painel para fora da borda
   * esquerda no celular, porque o botão fica no canto direito do cabeçalho.
   */
  useEffect(() => {
    if (!aberto) return;

    const medir = () => {
      const r = botao.current?.getBoundingClientRect();
      if (!r) return;
      const margem = 16;
      const width = Math.min(352, window.innerWidth - margem * 2);
      const direitaDoBotao = window.innerWidth - r.right;
      setPosicao({
        top: r.bottom + 8,
        right: Math.min(
          Math.max(direitaDoBotao, margem),
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

  useEffect(() => {
    fetch("/api/llm")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Estado | null) => {
        if (d) aplicar(d);
      })
      .catch(() => setErro("Não consegui carregar a configuração de LLM."));
  }, []);

  /** Sincroniza os campos do formulário com o que o servidor devolveu. */
  function aplicar(d: Estado) {
    setEstado(d);
    setProvider(d.atual.provider);
    const catalogo = d.provedores.find((p) => p.id === d.atual.provider);
    const conhecido = catalogo?.modelos.some((m) => m.id === d.atual.model);
    setModelo(conhecido ? d.atual.model : OUTRO);
    setOutro(conhecido ? "" : d.atual.model);
  }

  function trocarProvedor(id: string) {
    setProvider(id);
    setSalvo(false);
    const p = estado?.provedores.find((x) => x.id === id);
    // Volta para o modelo em uso quando o provedor escolhido é o ativo.
    if (id === estado?.atual.provider) {
      const conhecido = p?.modelos.some((m) => m.id === estado.atual.model);
      setModelo(conhecido ? estado.atual.model : OUTRO);
      setOutro(conhecido ? "" : estado.atual.model);
      return;
    }
    setModelo(p?.modelos[0]?.id ?? OUTRO);
    setOutro("");
  }

  async function enviar(metodo: "PUT" | "DELETE") {
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      const res = await fetch("/api/llm", {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body:
          metodo === "PUT"
            ? JSON.stringify({
                provider,
                model: modelo === OUTRO ? outro.trim() : modelo,
              })
            : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na requisição");
      aplicar(data as Estado);
      setSalvo(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  if (!estado) {
    return (
      <span
        className="flex items-center gap-1.5 text-sm"
        style={{ color: "var(--suave)" }}
      >
        <IconeLlm />…
      </span>
    );
  }

  const selecionado = estado.provedores.find((p) => p.id === provider);
  const modeloFinal = modelo === OUTRO ? outro.trim() : modelo;
  const mudou =
    provider !== estado.atual.provider || modeloFinal !== estado.atual.model;
  const podeSalvar = !salvando && mudou && modeloFinal.length > 0;

  return (
    <>
      <button
        ref={botao}
        onClick={() => setAberto((v) => !v)}
        className="flex max-w-[14rem] items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-opacity hover:opacity-70"
        style={{ borderColor: "var(--borda)", color: "var(--suave)" }}
        title={`${estado.atual.provider} / ${estado.atual.model} — clique para trocar`}
      >
        <IconeLlm />
        {/* Id do OpenRouter passa de 40 caracteres e empurra o cabeçalho. */}
        <span className="truncate">{estado.atual.model}</span>
      </button>

      {aberto && posicao && (
        <div
          className="fixed z-20 max-h-[75vh] space-y-4 overflow-y-auto rounded-xl border p-4 shadow-lg"
          style={{
            top: posicao.top,
            right: posicao.right,
            width: posicao.width,
            borderColor: "var(--borda)",
            background: "var(--painel)",
          }}
        >
          <div>
            <h2 className="text-sm font-semibold">Modelo de IA</h2>
            <p className="text-xs" style={{ color: "var(--suave)" }}>
              Vale a partir da próxima pergunta, sem reiniciar o servidor. As
              chaves de API continuam no <code>.env</code>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {estado.provedores.map((p) => {
              const ativo = p.id === provider;
              return (
                <button
                  key={p.id}
                  onClick={() => trocarProvedor(p.id)}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
                  style={{
                    borderColor: ativo ? "var(--acento)" : "var(--borda)",
                    background: ativo ? "var(--acento-suave)" : "transparent",
                    color: ativo ? "var(--acento)" : "var(--texto)",
                  }}
                >
                  {p.rotulo}
                  {/* Chave cortada diz o que falta; um alerta genérico não. */}
                  <span
                    className="flex"
                    title={
                      p.temChave
                        ? `${p.envChave} definida`
                        : `${p.envChave} ausente no .env`
                    }
                  >
                    {p.temChave ? <IconeChave /> : <IconeSemChave />}
                  </span>
                </button>
              );
            })}
          </div>

          {selecionado && (
            <>
              <p className="text-xs" style={{ color: "var(--suave)" }}>
                {selecionado.ajuda}
              </p>

              <label className="flex flex-col gap-1 text-sm">
                Modelo
                <select
                  value={modelo}
                  onChange={(e) => {
                    setModelo(e.target.value);
                    setSalvo(false);
                  }}
                  className="rounded-lg border px-3 py-2"
                  style={{
                    borderColor: "var(--borda)",
                    background: "transparent",
                    color: "var(--texto)",
                  }}
                >
                  {selecionado.modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.rotulo}
                      {m.nota ? ` — ${m.nota}` : ""}
                    </option>
                  ))}
                  <option value={OUTRO}>Outro modelo…</option>
                </select>
              </label>

              {modelo === OUTRO && (
                <label className="flex flex-col gap-1 text-sm">
                  Id do modelo
                  <input
                    value={outro}
                    onChange={(e) => {
                      setOutro(e.target.value);
                      setSalvo(false);
                    }}
                    placeholder={selecionado.modeloPadrao}
                    className="rounded-lg border px-3 py-2 font-mono"
                    style={{
                      borderColor: "var(--borda)",
                      background: "transparent",
                    }}
                  />
                </label>
              )}

              {!selecionado.temChave && (
                <p
                  className="flex items-start gap-1.5 text-sm"
                  style={{ color: "var(--acento)" }}
                >
                  <IconeAtencao className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {selecionado.envChave} não está no <code>.env</code>. Dá
                    para salvar, mas o chat vai falhar enquanto a chave não
                    existir.
                  </span>
                </p>
              )}
            </>
          )}

          {estado.atual.aviso && (
            <p
              className="flex items-start gap-1.5 text-sm"
              style={{ color: "var(--acento)" }}
            >
              <IconeAtencao className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{estado.atual.aviso}</span>
            </p>
          )}
          {erro && (
            <p className="text-sm" style={{ color: "var(--acento)" }}>
              {erro}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => enviar("PUT")}
              disabled={!podeSalvar}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              style={{ background: "var(--acento)" }}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            {estado.atual.origem === "painel" && (
              <button
                onClick={() => enviar("DELETE")}
                disabled={salvando}
                className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
                style={{ borderColor: "var(--borda)" }}
              >
                Usar o do .env
              </button>
            )}
            <span className="text-xs" style={{ color: "var(--suave)" }}>
              {salvo && !mudou ? "Salvo. " : ""}
              Em uso: <strong>{estado.atual.provider}</strong> /{" "}
              <code>{estado.atual.model}</code> (
              {estado.atual.origem === "painel" ? "painel" : ".env"})
            </span>
          </div>
        </div>
      )}
    </>
  );
}

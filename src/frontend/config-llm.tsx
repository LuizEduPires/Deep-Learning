"use client";

import { useEffect, useState } from "react";
import { IconeAtencao, IconeChave, IconeSemChave } from "./icones";
import { TituloSecao, classeBotaoPrimario, classeCartao, classeInput } from "./ui";

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
  const [provider, setProvider] = useState("");
  const [modelo, setModelo] = useState("");
  const [outro, setOutro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    fetch("/api/llm")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Estado | null) => {
        if (d) aplicar(d);
        else setErro("Não consegui carregar a configuração de LLM.");
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

  const selecionado = estado?.provedores.find((p) => p.id === provider);
  const modeloFinal = modelo === OUTRO ? outro.trim() : modelo;
  const mudou = !!estado && (provider !== estado.atual.provider || modeloFinal !== estado.atual.model);
  const podeSalvar = !salvando && mudou && modeloFinal.length > 0;

  return (
    <section aria-labelledby="modelo-ia" className="flex flex-col gap-3">
      <div>
        <TituloSecao id="modelo-ia">Modelo de IA</TituloSecao>
        <p className="mt-1 text-sm leading-snug text-suave">
          Escolha quem responde. Vale a partir da próxima pergunta; as chaves de acesso ficam só no
          servidor.
        </p>
      </div>

      {!estado ? (
        erro ? (
          <p className="rounded-2xl bg-acento-suave px-4 py-3 text-sm text-acento-texto">{erro}</p>
        ) : (
          <div className="h-60 animate-pulse rounded-[20px] bg-painel" />
        )
      ) : (
        <>
          <div role="radiogroup" aria-label="Provedor" className={`${classeCartao} overflow-hidden`}>
            {estado.provedores.map((p, i) => {
              const ativo = p.id === provider;
              const emUso = p.id === estado.atual.provider;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => trocarProvedor(p.id)}
                  className={`flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                    i > 0 ? "border-t border-linha" : ""
                  } ${ativo ? "bg-marca-suave" : "hover:bg-fundo"}`}
                >
                  <span
                    className={`h-5 w-5 shrink-0 rounded-full ${
                      ativo ? "border-[6px] border-marca-texto bg-painel" : "border-2 border-suave"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold">{p.rotulo}</span>
                    <span className="block text-[13px] text-texto-2">
                      {emUso ? `Em uso · ${estado.atual.model}` : p.temChave ? "Chave configurada" : "Sem chave no servidor"}
                    </span>
                  </span>
                  {/* Chave cortada diz o que falta; um alerta genérico não. */}
                  <span
                    className={p.temChave ? "text-marca-texto" : "text-suave"}
                    title={p.temChave ? `${p.envChave} definida` : `${p.envChave} ausente no .env`}
                  >
                    {p.temChave ? <IconeChave /> : <IconeSemChave />}
                  </span>
                </button>
              );
            })}
          </div>

          {selecionado && (
            <>
              <p className="text-[13px] leading-snug text-suave">{selecionado.ajuda}</p>

              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-texto-2">
                Modelo
                <select
                  value={modelo}
                  onChange={(e) => {
                    setModelo(e.target.value);
                    setSalvo(false);
                  }}
                  className={classeInput}
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
                <label className="flex flex-col gap-1.5 text-[13px] font-bold text-texto-2">
                  Id do modelo
                  <input
                    value={outro}
                    onChange={(e) => {
                      setOutro(e.target.value);
                      setSalvo(false);
                    }}
                    placeholder={selecionado.modeloPadrao}
                    className={`${classeInput} font-mono`}
                  />
                </label>
              )}

              {!selecionado.temChave && (
                <p className="flex items-start gap-1.5 text-sm text-acento-texto">
                  <IconeAtencao className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {selecionado.envChave} não está no <code>.env</code>. Dá para salvar, mas o chat
                    vai falhar enquanto a chave não existir.
                  </span>
                </p>
              )}
            </>
          )}

          {estado.atual.aviso && (
            <p className="flex items-start gap-1.5 text-sm text-acento-texto">
              <IconeAtencao className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{estado.atual.aviso}</span>
            </p>
          )}
          {erro && <p className="text-sm text-acento-texto">{erro}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => enviar("PUT")}
              disabled={!podeSalvar}
              className={classeBotaoPrimario}
            >
              {salvando ? "Salvando…" : "Salvar modelo"}
            </button>
            {estado.atual.origem === "painel" && (
              <button
                type="button"
                onClick={() => enviar("DELETE")}
                disabled={salvando}
                className="min-h-11 text-sm font-bold text-marca-texto disabled:opacity-40"
              >
                Voltar ao padrão do servidor
              </button>
            )}
            {salvo && !mudou && <span className="text-sm text-marca-texto">Salvo.</span>}
          </div>
        </>
      )}
    </section>
  );
}

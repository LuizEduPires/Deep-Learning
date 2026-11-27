"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usarPropriedade } from "./dados";
import { CabecalhoPagina, Campo, classeBotaoPrimario, classeCartao } from "./ui";

type Plano = {
  id: string;
  propertyId: string;
  propertyName: string;
  cultivar: string;
  plannedDate: string;
  irrigationAvailable: boolean;
  notes: string | null;
};

type Fonte = { tool: string; label: string; detail?: string };
type Analise = { text: string; sources: Fonte[]; analisadoEm: string };

function dataLocalHoje() {
  const hoje = new Date();
  const deslocamento = hoje.getTimezoneOffset() * 60_000;
  return new Date(hoje.getTime() - deslocamento).toISOString().slice(0, 10);
}

async function respostaJson<T>(res: Response): Promise<T> {
  const corpo: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const mensagem =
      typeof corpo === "object" && corpo !== null && "error" in corpo &&
      typeof corpo.error === "string"
        ? corpo.error
        : "Não consegui completar a operação.";
    throw new Error(mensagem);
  }
  return corpo as T;
}

function formatarData(valor: string) {
  const [ano, mes, dia] = valor.slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}

/** Planos persistentes com análise climática atualizada sob demanda. */
export default function PlanosPlantio() {
  const { propriedade } = usarPropriedade();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [analisandoId, setAnalisandoId] = useState<string | null>(null);
  const [cultivar, setCultivar] = useState("");
  const [dataPlantio, setDataPlantio] = useState(dataLocalHoje);
  const [irrigacao, setIrrigacao] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [analises, setAnalises] = useState<Record<string, Analise>>({});
  // Erro de salvar aparece no formulário; o de carregar ou analisar, na lista.
  // Com um estado só, a mesma mensagem saía duas vezes na tela.
  const [erro, setErro] = useState<string | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);

  useEffect(() => {
    let ativa = true;
    fetch("/api/planos-plantio")
      .then((res) => respostaJson<Plano[]>(res))
      .then((dados) => {
        if (ativa) setPlanos(dados);
      })
      .catch((err) => {
        if (ativa) setErroLista(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (ativa) setCarregando(false);
      });
    return () => {
      ativa = false;
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!propriedade) {
      setErro("Salve uma propriedade antes de criar um plano.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const plano = await respostaJson<Plano>(
        await fetch("/api/planos-plantio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: propriedade.id,
            cultivar,
            plannedDate: dataPlantio,
            irrigationAvailable: irrigacao,
            notes: observacoes,
          }),
        }),
      );
      setPlanos((atuais) => [plano, ...atuais]);
      setCultivar("");
      setDataPlantio(dataLocalHoje());
      setIrrigacao(false);
      setObservacoes("");
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  async function analisar(id: string) {
    setAnalisandoId(id);
    setErroLista(null);
    try {
      const resultado = await respostaJson<Analise>(
        await fetch(`/api/planos-plantio/${id}/analise`, { method: "POST" }),
      );
      setAnalises((atuais) => ({ ...atuais, [id]: resultado }));
    } catch (err) {
      setErroLista(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalisandoId(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 pt-6 pb-8 md:px-8 md:pt-8">
      <CabecalhoPagina
        titulo="Planos de plantio"
        apoio="Salve suas opções e consulte uma análise com a previsão atual da propriedade."
      />
      <p className="text-sm leading-relaxed text-suave">
        A previsão cobre até 14 dias e não define sozinha a melhor época anual. As fontes atuais não trazem
        faixas de temperatura comprovadas para cada cultivar; a análise é orientativa, não uma garantia.
      </p>

      {propriedade === undefined ? (
        <p className="text-sm text-suave">Carregando sua propriedade…</p>
      ) : propriedade === null ? (
        <p className={`${classeCartao} p-4 text-sm text-suave`}>
          Salve sua propriedade antes de criar um plano.{" "}
          <Link href="/fazenda" className="font-bold text-marca-texto underline">
            Ir para Fazenda
          </Link>
        </p>
      ) : (
        <form onSubmit={salvar} className={`${classeCartao} flex flex-col gap-3 p-4`}>
          <h2 className="font-display text-lg font-bold">Novo plano</h2>
          <p className="text-sm text-suave">Propriedade: {propriedade.name}</p>
          <Campo
            rotulo="Tipo ou cultivar de pitaya"
            valor={cultivar}
            aoMudar={setCultivar}
            dica="Ex.: pitaya vermelha, cultivar Palora"
            obrigatorio
          />
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-texto-2">
            Data pretendida para o plantio
            <input
              type="date"
              required
              value={dataPlantio}
              onChange={(e) => setDataPlantio(e.target.value)}
              className="min-h-12 rounded-2xl border border-borda bg-painel px-3 text-base outline-none focus:border-marca-texto md:text-[15px]"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-texto-2">
            <input
              type="checkbox"
              checked={irrigacao}
              onChange={(e) => setIrrigacao(e.target.checked)}
              className="h-4 w-4 accent-marca-texto"
            />
            Tenho irrigação disponível
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-texto-2">
            Observações (opcional)
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              maxLength={1000}
              rows={3}
              className="rounded-2xl border border-borda bg-painel px-3 py-2 text-base outline-none focus:border-marca-texto md:text-[15px]"
            />
          </label>
          {erro && <p role="alert" className="text-sm text-acento-texto">{erro}</p>}
          <button type="submit" disabled={salvando} className={classeBotaoPrimario}>
            {salvando ? "Salvando…" : "Salvar plano"}
          </button>
        </form>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Planos salvos</h2>
        {erroLista && <p role="alert" className="text-sm text-acento-texto">{erroLista}</p>}
        {carregando && <p className="text-sm text-suave">Carregando planos…</p>}
        {!carregando && planos.length === 0 && (
          <p className={`${classeCartao} p-4 text-sm text-suave`}>
            Você ainda não salvou nenhum plano.
          </p>
        )}
        {planos.map((plano) => {
          const analise = analises[plano.id];
          return (
            <article key={plano.id} className={`${classeCartao} flex flex-col gap-3 p-4`}>
              <div>
                <h3 className="font-bold">{plano.cultivar}</h3>
                <p className="text-sm text-suave">
                  {plano.propertyName} · plantio pretendido em {formatarData(plano.plannedDate)}
                </p>
                <p className="mt-1 text-sm text-suave">
                  Irrigação {plano.irrigationAvailable ? "disponível" : "não disponível"}
                  {plano.notes ? ` · ${plano.notes}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void analisar(plano.id)}
                disabled={analisandoId !== null}
                className={`${classeBotaoPrimario} self-start`}
              >
                {analisandoId === plano.id
                  ? "Analisando…"
                  : analise
                    ? "Atualizar análise"
                    : "Analisar previsão atual"}
              </button>
              {analise && (
                <div className="flex flex-col gap-2 border-t border-linha pt-3">
                  <p className="text-xs text-suave">
                    Análise atualizada em {new Date(analise.analisadoEm).toLocaleString("pt-BR")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{analise.text}</p>
                  {analise.sources.length > 0 && (
                    <ul className="list-inside list-disc text-xs text-suave">
                      {analise.sources.map((fonte, i) => (
                        <li key={`${fonte.tool}-${fonte.label}-${i}`}>
                          {fonte.label}{fonte.detail ? ` — ${fonte.detail}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}

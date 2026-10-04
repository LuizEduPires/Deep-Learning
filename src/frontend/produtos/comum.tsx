"use client";

import { useState } from "react";
import { Aviso, CabecalhoPagina, Etiqueta, Icone, Segmentado, classeCartao } from "../ui";

export type CulturaDoProduto = { cultura: string; alvos: string | null };

/** Cabeçalho comum às duas bases, com a troca Agrofit ↔ Bioinsumos. */
export function CabecalhoProdutos({ base }: { base: "agrofit" | "bioinsumos" }) {
  return (
    <>
      <CabecalhoPagina
        titulo="Produtos registrados"
        apoio="Consulta direta à cópia local das bases do MAPA — sem IA: o que aparece aqui é o que está registrado."
      />
      <div className="max-w-md">
        <Segmentado
          rotulo="Base de consulta"
          valor={base}
          opcoes={[
            { valor: "agrofit", rotulo: "Agrofit", href: "/agrofit" },
            { valor: "bioinsumos", rotulo: "Bioinsumos", href: "/bioinsumos" },
          ]}
        />
      </div>
    </>
  );
}

/** Campos principais sempre visíveis; o resto recolhido em "Mais filtros". */
export function PainelFiltros({
  principais,
  extras,
  extrasAtivos,
}: {
  principais: React.ReactNode;
  extras?: React.ReactNode;
  extrasAtivos: number;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <section className={`${classeCartao} flex flex-col gap-3 p-4`}>
      <div className="grid gap-3 md:grid-cols-2">{principais}</div>
      {extras && (
        <>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="flex min-h-11 items-center gap-2 self-start text-sm font-bold text-marca-texto"
          >
            <Icone nome="filtro" className="h-4 w-4" />
            {aberto ? "Menos filtros" : "Mais filtros"}
            {extrasAtivos > 0 && !aberto && (
              <span className="rounded-full bg-marca px-2 py-0.5 text-xs text-white">{extrasAtivos}</span>
            )}
            <Icone nome={aberto ? "cima" : "baixo"} className="h-4 w-4" />
          </button>
          {aberto && <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{extras}</div>}
        </>
      )}
    </section>
  );
}

export function Caixinha({
  rotulo,
  marcado,
  aoMudar,
}: {
  rotulo: string;
  marcado: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2.5 text-[15px] font-semibold">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => aoMudar(e.target.checked)}
        className="h-5 w-5 accent-[var(--marca)]"
      />
      {rotulo}
    </label>
  );
}

export function AvisoReceituario() {
  return (
    <Aviso>
      Mostra o que está registrado no MAPA. Dose, intervalo de segurança e modo de aplicação estão
      na bula; a aquisição e a aplicação exigem receituário agronômico.
    </Aviso>
  );
}

export function Contagem({ texto }: { texto: string }) {
  return <p className="min-h-5 text-sm text-suave">{texto}</p>;
}

export function Vazio({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className={`${classeCartao} flex flex-col gap-1 p-5 text-sm`}>
      <p className="font-bold">{titulo}</p>
      <div className="text-suave">{children}</div>
    </div>
  );
}

/** Erro da consulta; falha de banco vira uma frase legível, com o detalhe recolhido. */
export function Erro({ texto }: { texto: string }) {
  const doBanco = /Failed query|ECONNREFUSED|authentication failed|does not exist/i.test(texto);
  if (!doBanco) {
    return <p className="rounded-2xl bg-acento-suave px-4 py-3 text-sm text-acento-texto">{texto}</p>;
  }
  return (
    <div className="rounded-2xl bg-acento-suave px-4 py-3 text-sm text-acento-texto">
      <p className="font-bold">Não consegui consultar a base local.</p>
      <p className="mt-1">
        Confira se o banco está rodando (<code>npm run db:up</code>) e se a base foi carregada.
      </p>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer">Detalhe técnico</summary>
        <p className="mt-1 break-words">{texto}</p>
      </details>
    </div>
  );
}

export function Carregando() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-52 animate-pulse rounded-[20px] bg-painel" />
      ))}
    </div>
  );
}

export function Paginacao({
  pagina,
  paginas,
  aoMudar,
}: {
  pagina: number;
  paginas: number;
  aoMudar: (p: number) => void;
}) {
  if (paginas <= 1) return null;
  const botao =
    "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-borda bg-painel px-4 text-sm font-bold disabled:opacity-40";
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
      <button type="button" className={botao} disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
        <Icone nome="esquerda" className="h-4 w-4" />
        Anterior
      </button>
      <span className="text-sm text-suave">
        {pagina} de {paginas}
      </span>
      <button type="button" className={botao} disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)}>
        Próxima
        <Icone nome="direita" className="h-4 w-4" />
      </button>
    </nav>
  );
}

export type DadosCartao = {
  chave: string;
  nome: string;
  ingrediente: string | null;
  classe: string | null;
  biologico?: boolean | null;
  organico?: boolean | null;
  todasAsCulturas?: boolean;
  registro: string | null;
  url: string | null;
  titular: string | null;
  toxicologica: string | null;
  ambiental: string | null;
  formulacao: string | null;
  alvos: string | null;
  nCulturas: number | string;
  modoAcao?: string | null;
  tecnicaAplicacao?: string | null;
};

/** Cartão de produto registrado, com as culturas carregadas sob demanda. */
export function CartaoProduto({
  p,
  aberto,
  culturas,
  aoAlternar,
}: {
  p: DadosCartao;
  aberto: boolean;
  culturas?: CulturaDoProduto[];
  aoAlternar: () => void;
}) {
  const detalhes: [string, string | null][] = [
    ["Registro MAPA", p.registro],
    ["Titular", p.titular],
    ["Toxicológica", p.toxicologica],
    ["Ambiental", p.ambiental],
  ];

  return (
    <article className={`${classeCartao} flex flex-col gap-3 p-4`}>
      {/* A classe fica com as outras etiquetas, não ao lado do nome: ali ela
          espremia nome e ingrediente numa coluna estreita no celular. */}
      <div className="min-w-0">
        <h3 className="text-[17px] leading-snug font-bold break-words">{p.nome}</h3>
        <p className="mt-0.5 text-sm break-words text-texto-2">{p.ingrediente ?? "Ingrediente não informado"}</p>
      </div>

      {(p.classe || p.biologico || p.organico || p.todasAsCulturas || p.formulacao) && (
        <div className="flex flex-wrap gap-1.5">
          {p.classe && <Etiqueta tom={p.biologico ? "acento" : "marca"}>{p.classe}</Etiqueta>}
          {p.biologico && <Etiqueta tom="acento">Biológico</Etiqueta>}
          {p.organico && <Etiqueta tom="marca">Uso orgânico</Etiqueta>}
          {/* Registro genérico: vale para a cultura buscada sem citá-la. */}
          {p.todasAsCulturas && <Etiqueta tom="alerta">Todas as culturas</Etiqueta>}
          {p.formulacao && <Etiqueta tom="neutro">{p.formulacao}</Etiqueta>}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[13px]">
        {detalhes.map(([rotulo, valor]) => (
          <div key={rotulo} className="min-w-0">
            <dt className="text-suave">{rotulo}</dt>
            <dd className="mt-0.5 font-semibold break-words">{valor ?? "—"}</dd>
          </div>
        ))}
      </dl>

      {p.alvos && (
        <p className="border-t border-linha pt-2.5 text-[13px] text-texto-2">
          <strong>Alvos nesta cultura:</strong> {p.alvos}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-linha pt-2">
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberto}
          className="flex min-h-11 items-center gap-1.5 text-sm font-bold text-marca-texto"
        >
          {p.nCulturas} cultura(s)
          <Icone nome={aberto ? "cima" : "baixo"} className="h-4 w-4" />
        </button>
        {p.url && (
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-1.5 text-sm font-bold text-marca-texto"
          >
            Ver no Agrofit
            <Icone nome="externo" className="h-4 w-4" />
          </a>
        )}
      </div>

      {aberto && (
        <div className="rounded-2xl bg-fundo p-3 text-[13px]">
          {!culturas ? (
            <span className="text-suave">Carregando culturas…</span>
          ) : (
            <>
              <p className="mb-2 text-suave">Culturas com registro e os alvos em cada uma:</p>
              <ul className="flex flex-col gap-1.5">
                {culturas.map((c) => (
                  <li key={c.cultura}>
                    <strong>{c.cultura}</strong>
                    <span className="text-suave">{c.alvos ? ` — ${c.alvos}` : " — sem alvo específico"}</span>
                  </li>
                ))}
              </ul>
              {p.modoAcao && (
                <p className="mt-2 text-suave">
                  Modo de ação: {p.modoAcao}
                  {p.tecnicaAplicacao ? ` · aplicação: ${p.tecnicaAplicacao}` : ""}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** Culturas por registro, buscadas uma vez e guardadas. */
export function usarCulturas(endpoint: string) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [culturas, setCulturas] = useState<Record<string, CulturaDoProduto[]>>({});

  async function alternar(registro: string | null) {
    if (!registro) return;
    if (aberto === registro) {
      setAberto(null);
      return;
    }
    setAberto(registro);
    if (culturas[registro]) return;
    try {
      const res = await fetch(`${endpoint}?registro=${encodeURIComponent(registro)}`);
      const json = await res.json();
      if (res.ok) setCulturas((c) => ({ ...c, [registro]: json.culturas }));
    } catch {
      // Falha aqui não pode derrubar a listagem: o cartão só não expande.
    }
  }

  return { aberto, setAberto, culturas, alternar };
}

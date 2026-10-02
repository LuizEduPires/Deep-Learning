"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Clima, DiaJanela } from "@/server/clima";
import { diaCurto, usarPropriedade } from "./dados";
import { Icone, Logo, TituloSecao, classeCartao, type NomeIcone } from "./ui";
import { IconeMicrofone } from "./icones";

const PERGUNTAS = [
  "Qual produto é registrado para antracnose em pitaya?",
  "Quando faço a poda de formação?",
  "Como induzir floração fora de época?",
];

const ATALHOS: { href: string; titulo: string; apoio: string; icone: NomeIcone; tom: string }[] = [
  { href: "/agrofit", titulo: "Agrofit", apoio: "Defensivos registrados", icone: "escudo", tom: "bg-marca-suave text-marca-texto" },
  { href: "/bioinsumos", titulo: "Bioinsumos", apoio: "Biológicos e inoculantes", icone: "frasco", tom: "bg-acento-suave text-acento-texto" },
  { href: "/conversas", titulo: "Conversas", apoio: "Retome de onde parou", icone: "relogio", tom: "bg-fundo text-texto" },
  { href: "/fazenda", titulo: "Propriedade", apoio: "Local e modelo de IA", icone: "broto", tom: "bg-fundo text-texto" },
];

const NIVEL: Record<DiaJanela["nivel"], { rotulo: string; icone: NomeIcone; caixa: string; texto: string }> = {
  boa: { rotulo: "Boa", icone: "check", caixa: "bg-marca-suave", texto: "text-marca-texto" },
  atencao: { rotulo: "Atenção", icone: "alerta", caixa: "bg-alerta-suave", texto: "text-alerta-texto" },
  evitar: { rotulo: "Evitar", icone: "x", caixa: "bg-acento-suave", texto: "text-acento-texto" },
};

function hojePorExtenso() {
  const s = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Inicio() {
  const { propriedade } = usarPropriedade();
  const [clima, setClima] = useState<Clima | null>(null);
  const [erroClima, setErroClima] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [data, setData] = useState("");

  // Data montada no cliente: no servidor o fuso pode ser outro.
  useEffect(() => setData(hojePorExtenso()), []);

  useEffect(() => {
    if (!propriedade) return;
    setErroClima(null);
    const p = new URLSearchParams({
      lat: String(propriedade.latitude),
      lon: String(propriedade.longitude),
    });
    fetch(`/api/clima?${p}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Falha ao buscar o clima");
        setClima(json);
      })
      .catch(() =>
        setErroClima("O serviço de previsão não respondeu agora."),
      );
  }, [propriedade, tentativa]);

  const tentarDeNovo = () => setTentativa((t) => t + 1);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-5 pt-5 pb-8 md:px-8 md:pt-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex shrink-0 items-center gap-2.5 md:hidden">
          <Logo />
          <span className="font-display text-[22px] font-bold tracking-tight whitespace-nowrap">Dr. Pitaya</span>
        </div>
        <Link
          href="/fazenda"
          className="ml-auto flex min-h-11 min-w-0 items-center gap-1.5 rounded-full border border-borda bg-painel px-3.5 text-sm font-semibold"
        >
          <Icone nome="pin" className="h-[18px] w-[18px] text-marca-texto" />
          <span className="truncate">
            {propriedade === undefined ? "…" : (propriedade?.name ?? "Cadastrar")}
          </span>
          <Icone nome="baixo" className="h-4 w-4 text-suave" />
        </Link>
      </header>

      <div>
        <p className="min-h-5 text-sm text-suave">{data}</p>
        <h1 className="mt-1 font-display text-[30px] leading-tight font-bold tracking-tight md:text-4xl">
          Como está a lavoura hoje
        </h1>
      </div>

      <Link
        href="/chat"
        className="flex min-h-[58px] items-center gap-2.5 rounded-[18px] border-[1.5px] border-borda bg-painel py-1.5 pr-1.5 pl-4 text-[15px] text-suave shadow-sm transition hover:border-suave"
      >
        <Icone nome="brilho" className="h-5 w-5 text-acento" />
        <span className="flex-1">Pergunte ao Dr. Pitaya…</span>
        <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-acento text-white">
          <IconeMicrofone className="h-5 w-5" />
        </span>
      </Link>

      <div className="grid gap-5 lg:grid-cols-2">
        <CartaoClima propriedade={propriedade} clima={clima} erro={erroClima} aoTentar={tentarDeNovo} />
        <CartaoJanela temPropriedade={!!propriedade} clima={clima} erro={erroClima} />
      </div>

      <section aria-labelledby="rapidas" className="flex flex-col gap-3">
        <TituloSecao id="rapidas">Consultas rápidas</TituloSecao>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {ATALHOS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`${classeCartao} flex flex-col gap-3 p-4 transition hover:border-suave`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.tom}`}>
                <Icone nome={a.icone} className="h-[22px] w-[22px]" />
              </span>
              <span>
                <span className="block text-base font-bold">{a.titulo}</span>
                <span className="mt-0.5 block text-[13px] text-suave">{a.apoio}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="frequentes" className="flex flex-col gap-3">
        <TituloSecao id="frequentes">Perguntas frequentes</TituloSecao>
        <ul className={`${classeCartao} overflow-hidden`}>
          {PERGUNTAS.map((p, i) => (
            <li key={p} className={i > 0 ? "border-t border-linha" : ""}>
              <Link
                href={`/chat?q=${encodeURIComponent(p)}`}
                className="flex min-h-14 items-center gap-3 px-4 py-2 text-[15px] transition hover:bg-fundo"
              >
                <span className="flex-1">{p}</span>
                <Icone nome="direita" className="h-[18px] w-[18px] text-suave" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function CartaoClima({
  propriedade,
  clima,
  erro,
  aoTentar,
}: {
  propriedade: { name: string } | null | undefined;
  clima: Clima | null;
  erro: string | null;
  aoTentar: () => void;
}) {
  if (propriedade === null) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-3xl bg-marca p-5 text-white">
        <Icone nome="pin" className="h-8 w-8 text-[#CFE3D2]" />
        <h2 className="font-display text-xl font-bold">Cadastre sua propriedade</h2>
        <p className="text-[15px] text-[#E4F0E6]">
          Com a localização, o painel mostra o clima e a janela de pulverização, e o chat responde
          perguntas sobre o tempo.
        </p>
        <Link
          href="/fazenda"
          className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-[15px] font-bold text-[#1E5B3A]"
        >
          Cadastrar agora
          <Icone nome="direita" className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  const stats: { icone: NomeIcone; rotulo: string; valor: string }[] = clima
    ? [
        { icone: "chuva", rotulo: "Chuva hoje", valor: `${Math.round(clima.hoje.chuvaMm)} mm` },
        { icone: "vento", rotulo: "Vento", valor: `${Math.round(clima.agora.vento)} km/h` },
        { icone: "gota", rotulo: "Umidade", valor: `${Math.round(clima.agora.umidade)}%` },
      ]
    : [];

  return (
    <section aria-label="Clima agora" className="flex flex-col gap-4 rounded-3xl bg-marca p-5 text-white">
      <div className="text-xs font-bold tracking-[0.08em] text-[#CFE3D2] uppercase">
        Agora na propriedade
      </div>
      {erro && !clima ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[15px] text-[#E4F0E6]">{erro} Pode ser instabilidade na conexão.</p>
          <button
            type="button"
            onClick={aoTentar}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-[15px] font-bold text-[#1E5B3A]"
          >
            Tentar de novo
          </button>
        </div>
      ) : !clima ? (
        <div className="h-[150px] animate-pulse rounded-2xl bg-white/10" />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-[64px] leading-none font-semibold tracking-tighter">
                {Math.round(clima.agora.temperatura)}°
              </div>
              <div className="mt-1 text-[15px] text-[#E4F0E6]">
                {clima.agora.descricao} · máx. {Math.round(clima.hoje.tempMax)}° / mín.{" "}
                {Math.round(clima.hoje.tempMin)}°
              </div>
            </div>
            <IconeTempo codigo={clima.agora.codigo} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div key={s.rotulo} className="rounded-[14px] bg-white/10 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-[#CFE3D2]">
                  <Icone nome={s.icone} className="h-3.5 w-3.5" />
                  {s.rotulo}
                </div>
                <div className="mt-1 text-lg font-bold">{s.valor}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-[#CFE3D2]">
            Previsão Open-Meteo · atualizada às{" "}
            {clima.atualizadoEm.slice(11, 16)}
          </div>
        </>
      )}
    </section>
  );
}

function CartaoJanela({
  temPropriedade,
  clima,
  erro,
}: {
  temPropriedade: boolean;
  clima: Clima | null;
  erro: string | null;
}) {
  if (!temPropriedade) return null;

  return (
    <section aria-labelledby="janela" className={`${classeCartao} flex flex-col gap-3.5 rounded-3xl p-5`}>
      <div className="flex items-center justify-between gap-2">
        <TituloSecao id="janela">Janela de pulverização</TituloSecao>
        <span className="rounded-full bg-fundo px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-suave">
          3 dias
        </span>
      </div>
      {erro && !clima ? (
        <p className="text-sm text-suave">Sem previsão no momento.</p>
      ) : !clima ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-fundo" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {clima.janela.map((d) => {
            const n = NIVEL[d.nivel];
            return (
              <div key={d.data} className={`flex flex-col gap-1.5 rounded-2xl p-3 ${n.caixa}`}>
                <div className="text-[13px] font-semibold text-texto-2">{diaCurto(d.data)}</div>
                <div className={`flex items-center gap-1 text-[15px] font-bold ${n.texto}`}>
                  <Icone nome={n.icone} className="h-4 w-4" strokeWidth={2.4} />
                  {n.rotulo}
                </div>
                <div className="text-xs leading-snug text-texto-2">{d.motivo}</div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-suave">Indicativo. Confirme vento e chuva na hora da aplicação.</p>
      <Link
        href={`/chat?q=${encodeURIComponent("Vai dar pra pulverizar nos próximos 3 dias?")}`}
        className="flex min-h-11 items-center justify-between text-[15px] font-bold text-marca-texto"
      >
        Ver recomendação completa
        <Icone nome="direita" className="h-[18px] w-[18px]" />
      </Link>
    </section>
  );
}

/** Sol, nuvem ou chuva conforme o código WMO. */
function IconeTempo({ codigo }: { codigo: number }) {
  const sol = codigo <= 2;
  const chuva = codigo >= 51;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-16 w-16 shrink-0">
      {(sol || !chuva) && (
        <>
          <circle cx="26" cy="24" r="11" fill="#F6CF5A" />
          <path
            d="M26 6v4M26 38v4M8 24h4M40 24h4M13.3 11.3l2.8 2.8M35.9 33.9l2.8 2.8M13.3 36.7l2.8-2.8M35.9 14.1l2.8-2.8"
            stroke="#F6CF5A"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}
      {codigo !== 0 && (
        <path d="M24 52a9 9 0 0 1 1.5-17.9A11 11 0 0 1 46.5 37 7.5 7.5 0 0 1 46 52z" fill="#FFFFFF" />
      )}
      {chuva && (
        <path d="M28 56v4M36 56v4M44 56v4" stroke="#A8D4F0" strokeWidth="2.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

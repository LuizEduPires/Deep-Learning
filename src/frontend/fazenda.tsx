"use client";

import { useEffect, useState } from "react";
import ConfigLlm from "./config-llm";
import { usarPropriedade, type Propriedade } from "./dados";
import {
  CabecalhoPagina,
  Campo,
  Icone,
  classeBotaoContorno,
  classeBotaoPrimario,
  classeCartao,
} from "./ui";

function formatarCoord(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export default function Fazenda() {
  const { propriedade, setPropriedade, erro: erroCarga } = usarPropriedade();
  const [nome, setNome] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // Preenche o formulário com a propriedade salva quando ela chega.
  useEffect(() => {
    if (!propriedade) return;
    setNome(propriedade.name);
    setLat(String(propriedade.latitude));
    setLon(String(propriedade.longitude));
  }, [propriedade]);

  function usarLocalizacao() {
    if (!("geolocation" in navigator)) {
      setMsg({ tipo: "erro", texto: "Este navegador não informa a localização." });
      return;
    }
    setLocalizando(true);
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLon(pos.coords.longitude.toFixed(5));
        setLocalizando(false);
        setMsg({ tipo: "ok", texto: "Localização preenchida. Confira e salve." });
      },
      (e) => {
        setLocalizando(false);
        setMsg({
          tipo: "erro",
          texto:
            e.code === e.PERMISSION_DENIED
              ? "Acesso à localização negado. Libere no navegador ou digite as coordenadas."
              : "Não consegui obter a localização agora. Digite as coordenadas.",
        });
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const latitude = Number(lat.replace(",", "."));
    const longitude = Number(lon.replace(",", "."));
    if (!nome.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setMsg({ tipo: "erro", texto: "Preencha o nome, a latitude e a longitude." });
      return;
    }

    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/propriedades", {
        method: propriedade ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(propriedade ? { id: propriedade.id } : {}),
          name: nome.trim(),
          latitude,
          longitude,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar");
      setPropriedade(data as Propriedade);
      setMsg({ tipo: "ok", texto: "Propriedade salva." });
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : String(err) });
    } finally {
      setSalvando(false);
    }
  }

  const latN = Number(lat.replace(",", "."));
  const lonN = Number(lon.replace(",", "."));
  const temCoord = lat !== "" && lon !== "" && Number.isFinite(latN) && Number.isFinite(lonN);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 pt-6 pb-8 md:px-8 md:pt-8">
      <CabecalhoPagina
        titulo="Minha propriedade"
        apoio="A localização alimenta o clima e a janela de pulverização."
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="flex flex-col gap-4">
          <div className="relative h-[170px] overflow-hidden rounded-[20px] border border-borda bg-[repeating-linear-gradient(115deg,#D6E4CF_0px,#D6E4CF_18px,#CBDCC3_18px,#CBDCC3_36px)]">
            <span className="absolute top-3 left-3 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#1E5B3A]">
              {propriedade?.name ?? "Sua propriedade"}
            </span>
            <svg viewBox="0 0 44 52" aria-hidden="true" className="absolute top-12 left-1/2 h-[52px] w-11 -translate-x-1/2">
              <path d="M22 50s18-15 18-30a18 18 0 0 0-36 0c0 15 18 30 18 30z" fill="var(--acento)" />
              <circle cx="22" cy="20" r="7" fill="#FFFFFF" />
            </svg>
            {temCoord && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${latN}&mlon=${lonN}#map=15/${latN}/${lonN}`}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap text-[#17261C]"
              >
                {formatarCoord(latN)} · {formatarCoord(lonN)}
                <Icone nome="externo" className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={usarLocalizacao}
            disabled={localizando}
            className={classeBotaoContorno}
          >
            <Icone nome="mira" className="h-[18px] w-[18px]" />
            {localizando ? "Localizando…" : "Usar minha localização atual"}
          </button>

          <form onSubmit={salvar} className={`${classeCartao} flex flex-col gap-3 p-4`}>
            <Campo rotulo="Nome da propriedade" valor={nome} aoMudar={setNome} dica="Sítio Boa Vista" obrigatorio />
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Latitude" valor={lat} aoMudar={setLat} dica="-22.9" inputMode="decimal" obrigatorio />
              <Campo rotulo="Longitude" valor={lon} aoMudar={setLon} dica="-47.1" inputMode="decimal" obrigatorio />
            </div>
            {msg && (
              <p className={`text-sm ${msg.tipo === "ok" ? "text-marca-texto" : "text-acento-texto"}`} role="status">
                {msg.texto}
              </p>
            )}
            {erroCarga && !propriedade && (
              <p className="text-sm text-acento-texto">
                Não consegui ler a propriedade salva. O banco está rodando?
              </p>
            )}
            <button type="submit" disabled={salvando} className={classeBotaoPrimario}>
              {salvando ? "Salvando…" : propriedade ? "Salvar alterações" : "Salvar propriedade"}
            </button>
          </form>
        </section>

        <ConfigLlm />
      </div>
    </main>
  );
}

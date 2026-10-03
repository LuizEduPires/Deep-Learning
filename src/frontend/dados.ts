"use client";

import { useEffect, useState } from "react";

export type Propriedade = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type Fonte = { tool: string; label: string; detail?: string };

/**
 * Propriedade em uso (a primeira cadastrada). `undefined` enquanto carrega,
 * `null` quando não há nenhuma — as telas mostram coisas diferentes em cada caso.
 */
export function usarPropriedade() {
  const [propriedade, setPropriedade] = useState<Propriedade | null | undefined>(undefined);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    fetch("/api/propriedades")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falhou"))))
      .then((lista: Propriedade[]) => setPropriedade(lista[0] ?? null))
      .catch(() => {
        setErro(true);
        setPropriedade(null);
      });
  }, []);

  return { propriedade, setPropriedade, erro };
}

/** "14:32" hoje, "ontem", "12 de ago" antes disso. */
export function quando(iso: string) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";

  const agora = new Date();
  const meiaNoite = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const umDia = 24 * 60 * 60 * 1000;

  if (data.getTime() >= meiaNoite) {
    return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (data.getTime() >= meiaNoite - umDia) return "ontem";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Grupo do histórico: hoje, ontem ou anteriores. */
export function grupoDoDia(iso: string): "Hoje" | "Ontem" | "Anteriores" {
  const data = new Date(iso).getTime();
  const agora = new Date();
  const meiaNoite = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  if (data >= meiaNoite) return "Hoje";
  if (data >= meiaNoite - 24 * 60 * 60 * 1000) return "Ontem";
  return "Anteriores";
}

/** "Qua 30" a partir de "2026-09-30" — sem passar por UTC, que mudaria o dia. */
export function diaCurto(isoData: string) {
  const [a, m, d] = isoData.split("-").map(Number);
  const data = new Date(a, m - 1, d);
  const semana = data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${String(d).padStart(2, "0")}`;
}

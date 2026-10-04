"use client";

import { useEffect, useState } from "react";

export type Usuario = { id: string; name: string; email: string };

/** Evento que mantém iguais as cópias do usuário (menu lateral, aba Conta). */
const EVENTO_USUARIO = "pitaya:usuario";

/** Avisa todas as telas montadas de que o usuário mudou (ex.: novo nome). */
export function anunciarUsuario(usuario: Usuario) {
  window.dispatchEvent(new CustomEvent<Usuario>(EVENTO_USUARIO, { detail: usuario }));
}

/**
 * Usuário logado. `undefined` enquanto carrega, `null` se a sessão não vale
 * mais — o proxy só confere o formato do cookie, então uma sessão vencida
 * chega até aqui e é este hook que manda para /entrar.
 */
export function usarUsuario() {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);

  useEffect(() => {
    let ativo = true;
    fetch("/api/auth/eu", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u: Usuario | null) => {
        if (!ativo) return;
        setUsuario(u);
        if (!u) irParaEntrar();
      })
      .catch(() => ativo && setUsuario(null));

    const aoMudar = (e: Event) => setUsuario((e as CustomEvent<Usuario>).detail);
    window.addEventListener(EVENTO_USUARIO, aoMudar);
    return () => {
      ativo = false;
      window.removeEventListener(EVENTO_USUARIO, aoMudar);
    };
  }, []);

  return usuario;
}

export function irParaEntrar() {
  const volta = window.location.pathname + window.location.search;
  window.location.assign(`/entrar?next=${encodeURIComponent(volta)}`);
}

export async function sair() {
  await fetch("/api/auth/sair", { method: "POST" }).catch(() => undefined);
  // Recarga completa: o estado das telas é do usuário que saiu.
  window.location.assign("/entrar");
}

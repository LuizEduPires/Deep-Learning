"use client";

import { useState } from "react";
import { Campo, Logo, Segmentado, classeBotaoPrimario, classeCartao } from "./ui";

type Modo = "entrar" | "cadastro";

/** Tela de login e cadastro, sem a casca de navegação. */
export default function Entrar({ proximo }: { proximo: string }) {
  const [modo, setModo] = useState<Modo>("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (modo === "cadastro" && senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(modo === "entrar" ? "/api/auth/entrar" : "/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          modo === "entrar" ? { email, senha } : { name: nome, email, senha },
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não consegui continuar.");
      }
      // Recarga completa para as telas buscarem os dados já com a sessão nova.
      window.location.assign(proximo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <section className="flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-[24px] font-bold tracking-tight">Dr. Pitaya</span>
        </div>

        <div>
          <h1 className="font-display text-[28px] leading-tight font-bold tracking-tight">
            {modo === "entrar" ? "Entre na sua conta" : "Crie sua conta"}
          </h1>
          <p className="mt-1.5 text-[15px] leading-snug text-suave">
            Cada conta tem as próprias conversas e a própria propriedade.
          </p>
        </div>

        <Segmentado<Modo>
          rotulo="Entrar ou criar conta"
          valor={modo}
          aoMudar={(m) => {
            setModo(m);
            setErro(null);
          }}
          opcoes={[
            { valor: "entrar", rotulo: "Entrar" },
            { valor: "cadastro", rotulo: "Criar conta" },
          ]}
        />

        <form onSubmit={enviar} className={`${classeCartao} flex flex-col gap-3 p-4`}>
          {modo === "cadastro" && (
            <Campo rotulo="Nome" valor={nome} aoMudar={setNome} dica="Maria Souza" nome="name" autoComplete="name" obrigatorio />
          )}
          <Campo
            rotulo="E-mail"
            valor={email}
            aoMudar={setEmail}
            tipo="email"
            dica="voce@exemplo.com"
            nome="email"
            autoComplete="email"
            obrigatorio
          />
          <Campo
            rotulo="Senha"
            valor={senha}
            aoMudar={setSenha}
            tipo="password"
            dica={modo === "cadastro" ? "Pelo menos 8 caracteres" : undefined}
            nome="password"
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
            obrigatorio
          />
          {erro && (
            <p role="alert" className="text-sm text-acento-texto">
              {erro}
            </p>
          )}
          <button type="submit" disabled={enviando} className={`${classeBotaoPrimario} mt-1`}>
            {enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </section>
    </main>
  );
}

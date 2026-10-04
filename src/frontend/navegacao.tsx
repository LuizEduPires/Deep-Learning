"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icone, Logo, type NomeIcone } from "./ui";
import { usarUsuario } from "./usuario";

type Aba = {
  href: string;
  rotulo: string;
  icone: NomeIcone;
  /** Rotas que também acendem a aba. */
  inclui: string[];
};

const ABAS: Aba[] = [
  { href: "/", rotulo: "Início", icone: "inicio", inclui: [] },
  { href: "/conversas", rotulo: "Conversas", icone: "conversa", inclui: ["/chat"] },
  { href: "/agrofit", rotulo: "Produtos", icone: "busca", inclui: ["/bioinsumos"] },
  { href: "/fazenda", rotulo: "Fazenda", icone: "broto", inclui: [] },
  { href: "/conta", rotulo: "Conta", icone: "usuario", inclui: [] },
];

function ativa(aba: Aba, caminho: string) {
  if (aba.href === "/") return caminho === "/";
  return [aba.href, ...aba.inclui].some((r) => caminho === r || caminho.startsWith(`${r}/`));
}

/**
 * Casca do app: menu lateral no desktop e barra de abas no celular. A tela de
 * verificação e a de login ficam sem navegação; o chat, no celular, também —
 * ele ocupa a tela inteira com o campo de pergunta fixo embaixo, onde a barra
 * estaria.
 */
export default function Casca({ children }: { children: React.ReactNode }) {
  const caminho = usePathname() ?? "/";

  if (caminho.startsWith("/verificar") || caminho.startsWith("/entrar")) return <>{children}</>;

  return <CascaLogada caminho={caminho}>{children}</CascaLogada>;
}

function CascaLogada({ caminho, children }: { caminho: string; children: React.ReactNode }) {
  // Também é o que manda para /entrar quando a sessão venceu.
  const usuario = usarUsuario();
  const noChat = caminho === "/chat";

  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="Navegação principal"
        className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r border-borda bg-painel px-4 py-6 md:flex"
      >
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="font-display text-[22px] font-bold tracking-tight">Dr. Pitaya</span>
        </Link>
        <Link
          href="/chat"
          className="mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-acento px-4 text-[15px] font-bold text-white transition-opacity hover:opacity-90"
        >
          <Icone nome="brilho" className="h-[18px] w-[18px]" />
          Perguntar
        </Link>
        {ABAS.map((aba) => {
          const on = ativa(aba, caminho);
          return (
            <Link
              key={aba.href}
              href={aba.href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition ${
                on ? "bg-marca-suave font-bold text-marca-texto" : "font-semibold text-texto-2 hover:bg-fundo"
              }`}
            >
              <Icone nome={aba.icone} className="h-[22px] w-[22px]" />
              {aba.rotulo}
            </Link>
          );
        })}
        {usuario && (
          <Link
            href="/conta"
            className="mt-auto flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold text-texto-2 hover:bg-fundo"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-marca-suave text-[14px] font-bold text-marca-texto">
              {usuario.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="truncate">{usuario.name}</span>
          </Link>
        )}
        <p className={`${usuario ? "mt-3" : "mt-auto"} px-2 text-xs leading-snug text-suave`}>
          Registro no MAPA não substitui o receituário agronômico.
        </p>
      </nav>

      <div className={`min-w-0 flex-1 ${noChat ? "" : "pb-24 md:pb-0"}`}>{children}</div>

      {!noChat && (
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 gap-1 border-t border-borda bg-painel px-2 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden"
        >
          {ABAS.map((aba) => {
            const on = ativa(aba, caminho);
            return (
              <Link
                key={aba.href}
                href={aba.href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-[3px] text-xs ${
                  on ? "font-bold text-marca-texto" : "font-semibold text-suave"
                }`}
              >
                <span
                  className={`flex h-[30px] w-12 items-center justify-center rounded-full ${
                    on ? "bg-marca-suave" : ""
                  }`}
                >
                  <Icone nome={aba.icone} className="h-[22px] w-[22px]" />
                </span>
                {aba.rotulo}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

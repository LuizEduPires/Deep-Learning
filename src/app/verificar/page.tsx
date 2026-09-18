import type { Metadata } from "next";
import Script from "next/script";
import { redirect } from "next/navigation";
import {
  TURNSTILE_ACTION,
  safeReturnPath,
  turnstileConfigured,
  turnstileRequired,
} from "@/server/turnstile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verificação de acesso — Dr. Pitaya",
};

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  if (!turnstileRequired()) redirect("/");

  const params = await searchParams;
  const ready = turnstileConfigured();
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section
        className="w-full max-w-md rounded-2xl border p-8 shadow-sm"
        style={{
          background: "var(--painel)",
          borderColor: "var(--borda)",
          color: "var(--texto)",
        }}
      >
        <p className="mb-2 text-sm font-semibold" style={{ color: "var(--acento)" }}>
          Dr. Pitaya
        </p>
        <h1 className="text-2xl font-semibold">Verifique seu acesso</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--suave)" }}>
          Conclua a verificação para abrir a aplicação.
        </p>

        {ready ? (
          <>
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js"
              strategy="afterInteractive"
            />
            <form
              action="/api/turnstile/verify"
              method="post"
              className="mt-7 flex flex-col gap-5"
            >
              <input
                type="hidden"
                name="next"
                value={safeReturnPath(params.next)}
              />
              <div
                className="cf-turnstile"
                data-sitekey={siteKey}
                data-action={TURNSTILE_ACTION}
                data-theme="auto"
              />
              <button
                type="submit"
                className="rounded-lg px-4 py-3 font-semibold text-white"
                style={{ background: "var(--acento)" }}
              >
                Entrar
              </button>
            </form>
            {params.erro && (
              <p role="alert" className="mt-4 text-sm" style={{ color: "var(--acento)" }}>
                Não foi possível confirmar a verificação. Tente novamente.
              </p>
            )}
          </>
        ) : (
          <p role="alert" className="mt-6 text-sm" style={{ color: "var(--acento)" }}>
            Verificação indisponível. Configure as chaves do Turnstile no servidor.
          </p>
        )}
      </section>
    </main>
  );
}

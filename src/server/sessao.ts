/**
 * Constantes do cookie de sessão. Ficam fora de auth.ts para que o proxy
 * (src/proxy.ts) possa conferir a presença do cookie sem importar o banco.
 */
export const SESSAO_COOKIE = "pitaya_sessao";
export const SESSAO_SEGUNDOS = 30 * 24 * 60 * 60;

/** Token no formato que criarSessao gera: 32 bytes em base64url. */
export function formatoDeToken(valor: string | undefined): valor is string {
  return typeof valor === "string" && /^[A-Za-z0-9_-]{43}$/.test(valor);
}

/** Rotas abertas sem login: as telas de entrada e as APIs que as servem. */
export function rotaPublica(caminho: string) {
  return (
    caminho === "/entrar" ||
    caminho.startsWith("/api/auth/") ||
    caminho === "/api/health"
  );
}

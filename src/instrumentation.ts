/**
 * Gancho que o Next executa uma vez, ao subir o servidor.
 *
 * Usado para ligar o observador da base de conhecimento junto com
 * `npm run dev`, sem exigir um segundo terminal: salvar um .md em
 * data/conhecimento passa a bastar para o Dr. Pitaya citá-lo.
 */
export async function register() {
  // O gancho roda também no runtime edge, onde não há fs nem pool de Postgres.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Em produção o sistema de arquivos costuma ser somente leitura, e quem
  // decide quando semear é o deploy.
  if (process.env.NODE_ENV === "production") return;

  const { observarConhecimento } = await import(
    "./server/conhecimento-observador"
  );
  observarConhecimento();
}

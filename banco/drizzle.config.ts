import { defineConfig } from "drizzle-kit";

/**
 * Config do drizzle-kit — usada por `npm run db:studio`.
 *
 * Os caminhos são relativos à raiz do projeto (não a esta pasta): o drizzle-kit
 * resolve a partir do diretório de onde é chamado, e os scripts do package.json
 * rodam sempre da raiz.
 *
 * ATENÇÃO: as migrações em banco/migracoes/*.sql são escritas à mão e aplicadas por
 * scripts/migrate.ts. Por isso `out` aponta para outra pasta: um
 * `drizzle-kit generate` acidental não pode sobrescrever nem renumerar os
 * arquivos que já rodaram em produção. E nunca use `drizzle-kit push` aqui —
 * ele altera o banco direto, sem deixar migração registrada.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./banco/_gerado",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://pitaya:pitaya@localhost:5432/pitaya",
  },
});

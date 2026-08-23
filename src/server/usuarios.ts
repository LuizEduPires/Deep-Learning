import { eq } from "drizzle-orm";
import { db, schema } from "./db";

/**
 * MVP com uma organização e sem autenticação (ver não-escopo no handoff).
 * A tabela já usa uuid, então trocar por auth real não exige migração
 * destrutiva.
 *
 * Estava duplicado nas rotas de chat e de propriedades; com as duas criando o
 * mesmo usuário por e-mail, divergir aqui significaria dois donos para os
 * mesmos dados.
 */
export async function usuarioDemo() {
  const email = "produtor@pitaya.local";
  const achado = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (achado[0]) return achado[0];

  const [criado] = await db
    .insert(schema.users)
    .values({ name: "Produtor", email })
    .returning();
  return criado;
}

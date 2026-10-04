import { and, eq } from "drizzle-orm";
import { db, schema } from "./db";

export interface NovaPropriedade {
  name: string;
  latitude: number;
  longitude: number;
}

export async function listarPropriedades(userId: string) {
  return db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.userId, userId));
}

export async function criarPropriedade(userId: string, dados: NovaPropriedade) {
  const [criada] = await db
    .insert(schema.properties)
    .values({ userId, ...dados })
    .returning();
  return criada;
}

/** Atualiza só se a propriedade for do usuário; devolve undefined se não achar. */
export async function atualizarPropriedade(
  userId: string,
  id: string,
  dados: NovaPropriedade,
) {
  const [atualizada] = await db
    .update(schema.properties)
    .set(dados)
    .where(and(eq(schema.properties.id, id), eq(schema.properties.userId, userId)))
    .returning();
  return atualizada;
}

import { and, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { usuarioDemo } from "./usuarios";

export interface NovaPropriedade {
  name: string;
  latitude: number;
  longitude: number;
}

export async function listarPropriedades() {
  const user = await usuarioDemo();
  return db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.userId, user.id));
}

export async function criarPropriedade(dados: NovaPropriedade) {
  const user = await usuarioDemo();
  const [criada] = await db
    .insert(schema.properties)
    .values({ userId: user.id, ...dados })
    .returning();
  return criada;
}

/** Atualiza só se a propriedade for do usuário; devolve undefined se não achar. */
export async function atualizarPropriedade(id: string, dados: NovaPropriedade) {
  const user = await usuarioDemo();
  const [atualizada] = await db
    .update(schema.properties)
    .set(dados)
    .where(and(eq(schema.properties.id, id), eq(schema.properties.userId, user.id)))
    .returning();
  return atualizada;
}

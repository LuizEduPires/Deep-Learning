import { eq } from "drizzle-orm";
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

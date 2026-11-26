import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { responder } from "./agent";
import { getTools } from "./tools";
import { previsaoTempo } from "./tools/previsao-tempo";
import { montarPerguntaAnalise, type EntradaPlanoPlantio } from "@/plantio/validacao";

export class PropriedadePlanoNaoEncontrada extends Error {
  constructor() {
    super("Propriedade não encontrada.");
    this.name = "PropriedadePlanoNaoEncontrada";
  }
}

export type PlanoPlantio = {
  id: string;
  propertyId: string;
  propertyName: string;
  cultivar: string;
  plannedDate: string;
  irrigationAvailable: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function propriedadeDoUsuario(userId: string, propertyId: string) {
  const [property] = await db
    .select({
      id: schema.properties.id,
      name: schema.properties.name,
      latitude: schema.properties.latitude,
      longitude: schema.properties.longitude,
    })
    .from(schema.properties)
    .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.userId, userId)))
    .limit(1);
  return property;
}

function planoSelect() {
  return {
    id: schema.plantingPlans.id,
    propertyId: schema.plantingPlans.propertyId,
    propertyName: schema.properties.name,
    cultivar: schema.plantingPlans.cultivar,
    plannedDate: schema.plantingPlans.plannedDate,
    irrigationAvailable: schema.plantingPlans.irrigationAvailable,
    notes: schema.plantingPlans.notes,
    createdAt: schema.plantingPlans.createdAt,
    updatedAt: schema.plantingPlans.updatedAt,
  };
}

export async function listarPlanosPlantio(userId: string): Promise<PlanoPlantio[]> {
  return db
    .select(planoSelect())
    .from(schema.plantingPlans)
    .innerJoin(
      schema.properties,
      and(
        eq(schema.properties.id, schema.plantingPlans.propertyId),
        eq(schema.properties.userId, userId),
      ),
    )
    .where(eq(schema.plantingPlans.userId, userId))
    .orderBy(desc(schema.plantingPlans.plannedDate), desc(schema.plantingPlans.createdAt));
}

export async function obterPlanoPlantio(
  userId: string,
  id: string,
): Promise<PlanoPlantio | undefined> {
  const [plano] = await db
    .select(planoSelect())
    .from(schema.plantingPlans)
    .innerJoin(
      schema.properties,
      and(
        eq(schema.properties.id, schema.plantingPlans.propertyId),
        eq(schema.properties.userId, userId),
      ),
    )
    .where(and(eq(schema.plantingPlans.id, id), eq(schema.plantingPlans.userId, userId)))
    .limit(1);
  return plano;
}

export async function criarPlanoPlantio(
  userId: string,
  dados: EntradaPlanoPlantio,
): Promise<PlanoPlantio> {
  const property = await propriedadeDoUsuario(userId, dados.propertyId);
  if (!property) throw new PropriedadePlanoNaoEncontrada();

  const [criado] = await db
    .insert(schema.plantingPlans)
    .values({
      userId,
      propertyId: property.id,
      cultivar: dados.cultivar,
      plannedDate: dados.plannedDate,
      irrigationAvailable: dados.irrigationAvailable,
      notes: dados.notes || null,
    })
    .returning({ id: schema.plantingPlans.id });
  const plano = await obterPlanoPlantio(userId, criado.id);
  if (!plano) throw new Error("Não consegui carregar o plano recém-criado.");
  return plano;
}

export async function analisarPlanoPlantio(userId: string, id: string) {
  const plano = await obterPlanoPlantio(userId, id);
  if (!plano) return undefined;

  const property = await propriedadeDoUsuario(userId, plano.propertyId);
  if (!property) return undefined;

  const contexto = {
    property: {
      name: property.name,
      latitude: property.latitude,
      longitude: property.longitude,
    },
  };
  const previsao = await previsaoTempo.run({ dias: 14 }, contexto);
  const resultado = await responder({
    messages: [{
      role: "user",
      content: `${montarPerguntaAnalise(plano)}\n\n${previsao.text}`,
    }],
    ctx: contexto,
    tools: getTools().filter((tool) => tool.name === "busca_conhecimento" || tool.name === "responde_agro"),
  });
  return {
    ...resultado,
    sources: [...previsao.sources, ...resultado.sources],
    analisadoEm: new Date().toISOString(),
  };
}

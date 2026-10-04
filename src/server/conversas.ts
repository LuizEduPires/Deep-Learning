import { and, asc, desc, eq, sql } from "drizzle-orm";
import { responder } from "./agent";
import {
  classificarImagemFolha,
  type FotoDeFolha,
} from "./classificador-folha";
import { db, schema } from "./db";
import { montarMensagensDoChat } from "./mensagens-chat";
import type { Source } from "./llm/types";
import { usuarioAtual } from "./auth";

export interface PerguntaDoChat {
  conversationId?: string;
  propertyId?: string;
  message: string;
  foto?: FotoDeFolha;
}

/** conversationId que não existe ou é de outro usuário. */
export class ErroConversaNaoEncontrada extends Error {
  constructor() {
    super("Conversa não encontrada.");
    this.name = "ErroConversaNaoEncontrada";
  }
}

/** Título da conversa: a primeira pergunta, cortada no limite da lista. */
function tituloDe(mensagem: string) {
  const limpo = mensagem.trim().replace(/\s+/g, " ");
  return limpo.length > 60 ? `${limpo.slice(0, 59)}…` : limpo;
}

/**
 * Uma rodada de conversa: chama o agente com o histórico e a propriedade em
 * contexto, e só então persiste pergunta e resposta.
 *
 * A gravação vem depois da resposta de propósito. Gravando antes, toda falha
 * de provedor — saldo, cota de modelo gratuito, timeout — deixava para trás
 * uma conversa com pergunta e sem resposta, e o histórico ficava cheio de
 * tentativas mortas. O contexto enviado ao modelo não muda: o histórico é
 * lido antes de qualquer inserção nos dois desenhos.
 *
 * A propriedade entra no contexto porque as tools de clima precisam de
 * coordenadas; sem `propertyId` explícito vale a primeira propriedade do
 * usuário logado.
 */
export async function responderNaConversa(pergunta: PerguntaDoChat) {
  const user = await usuarioAtual();
  const analise = pergunta.foto
    ? await classificarImagemFolha(pergunta.foto)
    : undefined;

  // Conversa e propriedade só valem se forem do usuário: sem isso, um id
  // alheio bastaria para ler o histórico de outra conta ou escrever nele.
  if (pergunta.conversationId) {
    const [dona] = await db
      .select({ id: schema.conversations.id })
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.id, pergunta.conversationId),
          eq(schema.conversations.userId, user.id),
        ),
      )
      .limit(1);
    if (!dona) throw new ErroConversaNaoEncontrada();
  }

  const historico = pergunta.conversationId
    ? await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, pergunta.conversationId))
        .orderBy(asc(schema.messages.createdAt))
    : [];

  const property = pergunta.propertyId
    ? (
        await db
          .select()
          .from(schema.properties)
          .where(
            and(
              eq(schema.properties.id, pergunta.propertyId),
              eq(schema.properties.userId, user.id),
            ),
          )
          .limit(1)
      )[0]
    : (
        await db
          .select()
          .from(schema.properties)
          .where(eq(schema.properties.userId, user.id))
          .limit(1)
      )[0];

  const messages = montarMensagensDoChat(historico, pergunta.message, analise);

  const resposta = await responder({
    messages,
    ctx: {
      property: property
        ? {
            name: property.name,
            latitude: property.latitude,
            longitude: property.longitude,
          }
        : null,
    },
  });

  // Reaproveita a conversa existente ou cria uma nova com título derivado.
  let conversationId = pergunta.conversationId;
  if (!conversationId) {
    const [conversa] = await db
      .insert(schema.conversations)
      .values({
        userId: user.id,
        propertyId: pergunta.propertyId ? (property?.id ?? null) : null,
        title: tituloDe(pergunta.message),
      })
      .returning();
    conversationId = conversa.id;
  }

  await db.insert(schema.messages).values([
    {
      conversationId,
      role: "user",
      content: pergunta.message,
      ...(analise ? { leafInference: analise } : {}),
    },
    {
      conversationId,
      role: "assistant",
      content: resposta.text,
      sources: resposta.sources,
    },
  ]);

  if (!analise) {
    return { conversationId, text: resposta.text, sources: resposta.sources };
  }

  return {
    conversationId,
    text: resposta.text,
    sources: resposta.sources,
    leafInference: analise,
  };
}

/**
 * Conversas do usuário para o painel de histórico, da mais recente para a mais
 * antiga. A ordem é por última mensagem, não por criação: retomar uma conversa
 * de ontem devia trazê-la para o topo, senão ela some para o fim da lista.
 */
export async function listarConversas(limite = 50) {
  const user = await usuarioAtual();

  return db
    .select({
      id: schema.conversations.id,
      title: schema.conversations.title,
      criadaEm: schema.conversations.createdAt,
      // Formatado como ISO em UTC de propósito: a expressão crua volta do pg
      // como "2026-08-23 16:39:34.9+00", que o new Date() do Safari recusa —
      // e data quebrada some da lista sem erro nenhum aparecer.
      ultimaEm: sql<string>`to_char(coalesce(max(${schema.messages.createdAt}), ${schema.conversations.createdAt}) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      mensagens: sql<number>`count(${schema.messages.id})::int`,
    })
    .from(schema.conversations)
    .leftJoin(
      schema.messages,
      eq(schema.messages.conversationId, schema.conversations.id),
    )
    .where(eq(schema.conversations.userId, user.id))
    .groupBy(schema.conversations.id)
    .orderBy(
      desc(
        sql`coalesce(max(${schema.messages.createdAt}), ${schema.conversations.createdAt})`,
      ),
    )
    .limit(limite);
}

/**
 * Mensagens de uma conversa, no formato que o chat renderiza.
 *
 * Devolve null quando a conversa não é do usuário — id de outra pessoa não
 * pode virar leitura de conversa alheia.
 */
export async function abrirConversa(id: string) {
  const user = await usuarioAtual();

  const [conversa] = await db
    .select()
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, id),
        eq(schema.conversations.userId, user.id),
      ),
    )
    .limit(1);

  if (!conversa) return null;

  const mensagens = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, id))
    .orderBy(asc(schema.messages.createdAt));

  return {
    id: conversa.id,
    title: conversa.title,
    propertyId: conversa.propertyId,
    mensagens: mensagens.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      sources: (m.sources as Source[] | null) ?? undefined,
      leafInference: m.leafInference ?? undefined,
    })),
  };
}

/** Apaga a conversa e, por cascata no banco, as mensagens dela. */
export async function apagarConversa(id: string) {
  const user = await usuarioAtual();

  const apagadas = await db
    .delete(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, id),
        eq(schema.conversations.userId, user.id),
      ),
    )
    .returning({ id: schema.conversations.id });

  return apagadas.length > 0;
}

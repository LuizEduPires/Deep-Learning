import {
  pgTable,
  uuid,
  text,
  timestamp,
  doublePrecision,
  integer,
  jsonb,
  serial,
  boolean,
  date,
  primaryKey,
  unique,
  customType,
} from "drizzle-orm/pg-core";

const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  propertyId: uuid("property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull().default("Nova conversa"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  sources: jsonb("sources"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chunks = pgTable("chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector1536("embedding"),
});

export const agrofitProducts = pgTable("agrofit_products", {
  id: serial("id").primaryKey(),
  registration: text("registration").unique(),
  productName: text("product_name").notNull(),
  activeIngredient: text("active_ingredient"),
  productClass: text("product_class"),
  crops: text("crops"),
  pests: text("pests"),
  holder: text("holder"),
  toxicologicalClass: text("toxicological_class"),
  environmentalClass: text("environmental_class"),
  // Campos que só a API traz — o CSV dos Dados Abertos não tem todos.
  fonte: text("fonte"),
  formulacao: text("formulacao"),
  modoAcao: text("modo_acao"),
  tecnicaAplicacao: text("tecnica_aplicacao"),
  produtoBiologico: boolean("produto_biologico"),
  agriculturaOrganica: boolean("agricultura_organica"),
  inflamavel: boolean("inflamavel"),
  corrosivo: boolean("corrosivo"),
  urlAgrofit: text("url_agrofit"),
  raw: jsonb("raw"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Payload cru de toda coleção da API Agrofit — ver scripts/agrofit-sync.ts. */
export const agrofitItens = pgTable(
  "agrofit_itens",
  {
    colecao: text("colecao").notNull(),
    chave: text("chave").notNull(),
    payload: jsonb("payload").notNull(),
    sincronizadoEm: timestamp("sincronizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.colecao, t.chave] })],
);

export const agrofitColecoes = pgTable("agrofit_colecoes", {
  colecao: text("colecao").primaryKey(),
  registrosApi: integer("registros_api"),
  registrosGravados: integer("registros_gravados").notNull().default(0),
  paginas: integer("paginas"),
  ultimoErro: text("ultimo_erro"),
  sincronizadoEm: timestamp("sincronizado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** indicacao_uso explodida: uma linha por produto × cultura × praga. */
export const agrofitIndicacoes = pgTable(
  "agrofit_indicacoes",
  {
    id: serial("id").primaryKey(),
    registration: text("registration").notNull(),
    cultura: text("cultura").notNull(),
    pragaNomeCientifico: text("praga_nome_cientifico").notNull().default(""),
    pragaNomeComum: text("praga_nome_comum").notNull().default(""),
  },
  (t) => [
    unique().on(t.registration, t.cultura, t.pragaNomeCientifico, t.pragaNomeComum),
  ],
);

// ---------------------------------------------------------------- bioinsumos

/**
 * Base Bioinsumos (AgroAPI/Embrapa) — ver scripts/bioinsumos-sync.ts.
 * Mesmo desenho do Agrofit: payload cru de toda coleção aqui, e as duas
 * coleções que a aplicação consulta normalizadas nas tabelas abaixo.
 */
export const bioinsumosItens = pgTable(
  "bioinsumos_itens",
  {
    colecao: text("colecao").notNull(),
    chave: text("chave").notNull(),
    payload: jsonb("payload").notNull(),
    sincronizadoEm: timestamp("sincronizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.colecao, t.chave] })],
);

export const bioinsumosColecoes = pgTable("bioinsumos_colecoes", {
  colecao: text("colecao").primaryKey(),
  registrosApi: integer("registros_api"),
  registrosGravados: integer("registros_gravados").notNull().default(0),
  paginas: integer("paginas"),
  ultimoErro: text("ultimo_erro"),
  sincronizadoEm: timestamp("sincronizado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Produtos biológicos para controle de pragas. */
export const bioinsumosProdutos = pgTable("bioinsumos_produtos", {
  numeroRegistro: text("numero_registro").primaryKey(),
  marcaComercial: text("marca_comercial").notNull().default(""),
  titularRegistro: text("titular_registro"),
  classeCategoria: text("classe_categoria"),
  formulacao: text("formulacao"),
  ingredienteAtivo: text("ingrediente_ativo"),
  modoAcao: text("modo_acao"),
  tecnicaAplicacao: text("tecnica_aplicacao"),
  classificacaoToxicologica: text("classificacao_toxicologica"),
  classificacaoAmbiental: text("classificacao_ambiental"),
  agriculturaOrganica: boolean("agricultura_organica"),
  inflamavel: boolean("inflamavel"),
  corrosivo: boolean("corrosivo"),
  urlAgrofit: text("url_agrofit"),
  payload: jsonb("payload"),
  sincronizadoEm: timestamp("sincronizado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * indicacao_uso explodida: uma linha por produto × cultura × praga.
 *
 * `todasAsCulturas` marca o registro genérico — 795 dos 834 produtos estão
 * cadastrados assim. Sem essa coluna, "existe bioinsumo para pitaya?"
 * responderia zero em SQL.
 */
export const bioinsumosIndicacoes = pgTable(
  "bioinsumos_indicacoes",
  {
    id: serial("id").primaryKey(),
    numeroRegistro: text("numero_registro").notNull(),
    cultura: text("cultura").notNull(),
    pragaNomeCientifico: text("praga_nome_cientifico").notNull().default(""),
    pragaNomeComum: text("praga_nome_comum").notNull().default(""),
    todasAsCulturas: boolean("todas_as_culturas").notNull().default(false),
  },
  (t) => [
    unique().on(t.numeroRegistro, t.cultura, t.pragaNomeCientifico, t.pragaNomeComum),
  ],
);

/**
 * Inoculantes: uma linha por produto × cultura, como a API entrega — 1.032
 * produtos viram 1.239 linhas, então `registroProduto` não é único.
 */
export const bioinsumosInoculantes = pgTable("bioinsumos_inoculantes", {
  chave: text("chave").primaryKey(),
  registroProduto: text("registro_produto").notNull(),
  razaoSocial: text("razao_social"),
  uf: text("uf"),
  atividade: text("atividade"),
  tipo: text("tipo"),
  especie: text("especie"),
  cultura: text("cultura"),
  culturaNomeCientifico: text("cultura_nome_cientifico"),
  garantia: text("garantia"),
  naturezaFisica: text("natureza_fisica"),
  dataRegistro: date("data_registro"),
  payload: jsonb("payload"),
  sincronizadoEm: timestamp("sincronizado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ------------------------------------------------------------ configurações

/**
 * Configurações editáveis em runtime — hoje só a chave "llm", gravada pelo
 * painel de troca de provedor/modelo. Ver banco/migracoes/0004_configuracoes.sql.
 */
export const configuracoes = pgTable("configuracoes", {
  chave: text("chave").primaryKey(),
  valor: jsonb("valor").notNull(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

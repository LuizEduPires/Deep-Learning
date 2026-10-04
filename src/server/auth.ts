import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "./db";
import { SESSAO_COOKIE, SESSAO_SEGUNDOS, formatoDeToken } from "./sessao";

const scryptAsync = promisify(scrypt) as (
  senha: string,
  sal: Buffer,
  tamanho: number,
) => Promise<Buffer>;

/** Rota que precisa de usuário recebeu requisição sem sessão válida. */
export class ErroNaoAutenticado extends Error {
  constructor() {
    super("Faça login para continuar.");
    this.name = "ErroNaoAutenticado";
  }
}

/** Cadastro ou login com dados que não fecham. */
export class ErroDeCredencial extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 409,
  ) {
    super(message);
    this.name = "ErroDeCredencial";
  }
}

export type UsuarioPublico = { id: string; name: string; email: string };

// ------------------------------------------------------------------- senha

/** "scrypt$<sal>$<hash>", os dois em base64url. */
async function gerarHashDeSenha(senha: string) {
  const sal = randomBytes(16);
  const hash = await scryptAsync(senha, sal, 64);
  return `scrypt$${sal.toString("base64url")}$${hash.toString("base64url")}`;
}

async function senhaConfere(senha: string, guardado: string) {
  const [algoritmo, sal, hash] = guardado.split("$");
  if (algoritmo !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64url");
  const obtido = await scryptAsync(senha, Buffer.from(sal, "base64url"), esperado.length);
  return timingSafeEqual(obtido, esperado);
}

// Hash de uma senha qualquer, para que e-mail inexistente custe o mesmo tempo
// que senha errada e o tempo de resposta não revele quem tem conta.
const hashFalso = gerarHashDeSenha(randomBytes(16).toString("hex"));

// ----------------------------------------------------------------- sessões

function hashDoToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Cria a sessão no banco e devolve o token cru, que só vai para o cookie. */
async function criarSessao(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(schema.sessions).values({
    tokenHash: hashDoToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSAO_SEGUNDOS * 1000),
  });
  // Faxina oportunista: sessões vencidas não servem para nada.
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  return token;
}

export async function encerrarSessao(token: string | undefined) {
  if (!formatoDeToken(token)) return;
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashDoToken(token)));
}

async function usuarioDoToken(token: string | undefined): Promise<UsuarioPublico | null> {
  if (!formatoDeToken(token)) return null;
  const [achado] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, hashDoToken(token)),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return achado ?? null;
}

/** Usuário logado na requisição atual, ou null. */
export async function usuarioDaRequisicao() {
  const jar = await cookies();
  return usuarioDoToken(jar.get(SESSAO_COOKIE)?.value);
}

/** Token cru do cookie da requisição atual (para não encerrar a própria sessão). */
async function tokenDaRequisicao() {
  const jar = await cookies();
  return jar.get(SESSAO_COOKIE)?.value;
}

/** Usuário logado; lança ErroNaoAutenticado sem sessão válida. */
export async function usuarioAtual() {
  const usuario = await usuarioDaRequisicao();
  if (!usuario) throw new ErroNaoAutenticado();
  return usuario;
}

// --------------------------------------------------------- cadastro/login

function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function cadastrar(dados: { name: string; email: string; senha: string }) {
  const email = normalizarEmail(dados.email);
  const passwordHash = await gerarHashDeSenha(dados.senha);

  const [criado] = await db
    .insert(schema.users)
    .values({ name: dados.name.trim(), email, passwordHash })
    .onConflictDoNothing()
    .returning({ id: schema.users.id, name: schema.users.name, email: schema.users.email });
  if (!criado) {
    throw new ErroDeCredencial("Já existe uma conta com este e-mail.", 409);
  }

  return { usuario: criado, token: await criarSessao(criado.id) };
}

export async function entrar(dados: { email: string; senha: string }) {
  const [achado] = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${normalizarEmail(dados.email)}`)
    .limit(1);

  const confere = await senhaConfere(dados.senha, achado?.passwordHash ?? (await hashFalso));
  if (!achado?.passwordHash || !confere) {
    throw new ErroDeCredencial("E-mail ou senha incorretos.", 401);
  }

  const usuario = { id: achado.id, name: achado.name, email: achado.email };
  return { usuario, token: await criarSessao(achado.id) };
}

// ------------------------------------------------------------------ conta

export async function atualizarNome(name: string): Promise<UsuarioPublico> {
  const usuario = await usuarioAtual();
  const [atualizado] = await db
    .update(schema.users)
    .set({ name: name.trim() })
    .where(eq(schema.users.id, usuario.id))
    .returning({ id: schema.users.id, name: schema.users.name, email: schema.users.email });
  return atualizado;
}

/**
 * Troca a senha conferindo a atual. As outras sessões do usuário caem: quem
 * troca a senha por desconfiar de acesso alheio espera que esse acesso acabe.
 * A sessão deste aparelho continua.
 */
export async function trocarSenha(dados: { senhaAtual: string; novaSenha: string }) {
  const usuario = await usuarioAtual();
  const [achado] = await db
    .select({ passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, usuario.id))
    .limit(1);

  if (!achado?.passwordHash || !(await senhaConfere(dados.senhaAtual, achado.passwordHash))) {
    throw new ErroDeCredencial("A senha atual não confere.", 401);
  }

  await db
    .update(schema.users)
    .set({ passwordHash: await gerarHashDeSenha(dados.novaSenha) })
    .where(eq(schema.users.id, usuario.id));

  const token = await tokenDaRequisicao();
  await db
    .delete(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, usuario.id),
        ne(schema.sessions.tokenHash, formatoDeToken(token) ? hashDoToken(token) : ""),
      ),
    );
}

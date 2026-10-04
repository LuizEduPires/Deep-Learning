import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "./db";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_HASH_BYTES = 64;
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

function deriveKey(password: string, salt: Buffer, length: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      length,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
      },
      (error, derived) => {
        if (error) reject(error);
        else resolve(derived);
      },
    );
  });
}

export const AUTH_COOKIE_NAME = "pitaya_session";
export const AUTH_SESSION_MAX_AGE = SESSION_DURATION_SECONDS;

export type AuthUser = Pick<
  typeof schema.users.$inferSelect,
  "id" | "name" | "email" | "createdAt"
>;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, PASSWORD_HASH_BYTES);
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, n, r, p, saltEncoded, hashEncoded] = stored.split("$");
  if (
    algorithm !== "scrypt" ||
    n !== String(SCRYPT_COST) ||
    r !== String(SCRYPT_BLOCK_SIZE) ||
    p !== String(SCRYPT_PARALLELIZATION) ||
    !saltEncoded ||
    !hashEncoded
  ) {
    return false;
  }

  const salt = Buffer.from(saltEncoded, "base64url");
  const expected = Buffer.from(hashEncoded, "base64url");
  if (salt.length !== 16 || expected.length !== PASSWORD_HASH_BYTES) return false;

  const actual = await deriveKey(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function publicUser(user: typeof schema.users.$inferSelect): AuthUser {
  const { id, name, email, createdAt } = user;
  return { id, name, email, createdAt };
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  await db.insert(schema.sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });
  return token;
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ name: input.name.trim(), email, passwordHash })
      .returning();
    const token = randomBytes(32).toString("base64url");
    await tx.insert(schema.sessions).values({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
    });
    return { user: publicUser(user), token };
  });
}

export async function loginUser(emailInput: string, password: string) {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalizeEmail(emailInput)))
    .limit(1);
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }
  return { user: publicUser(user), token: await createSession(user.id) };
}

export async function getUserFromSession(token: string | undefined) {
  if (!token || token.length > 128) return null;
  const [row] = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(
      and(
        eq(schema.sessions.tokenHash, hashSessionToken(token)),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ? publicUser(row.user) : null;
}

export function usuarioAutenticado(request: NextRequest) {
  return getUserFromSession(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

export async function revokeSession(token: string | undefined) {
  if (!token || token.length > 128) return;
  await db
    .delete(schema.sessions)
    .where(eq(schema.sessions.tokenHash, hashSessionToken(token)));
}

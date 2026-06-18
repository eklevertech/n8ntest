import { cookies } from "next/headers";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import {
  createSession,
  deleteSession,
  getAccount,
  getSession,
  getUserById,
} from "./store";
import type { Account, SafeUser, User } from "./types";

export const SESSION_COOKIE = "vigilai_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export interface AuthContext {
  user: SafeUser;
  account: Account;
}

// ── Contraseñas (scrypt, sin dependencias nativas) ───────────────────
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _omit, ...safe } = user;
  void _omit;
  return safe;
}

// ── Sesiones por cookie ──────────────────────────────────────────────
export async function startSession(userId: string): Promise<void> {
  const session = await createSession(userId, SESSION_TTL_MS);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  jar.delete(SESSION_COOKIE);
}

/** Devuelve el usuario y su cuenta a partir de la cookie de sesión, o null. */
export async function getCurrentAuth(): Promise<AuthContext | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await getSession(token);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user) return null;
  try {
    const account = await getAccount(user.accountId);
    return { user: toSafeUser(user), account };
  } catch {
    return null;
  }
}

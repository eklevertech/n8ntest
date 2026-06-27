import crypto from "node:crypto";
import type { Account, Camera, DetectionEvent, PlanId, Session, User } from "../types";

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export interface ListEventsOpts {
  cameraId?: string;
  limit?: number;
}

/**
 * Interfaz de persistencia. Tiene dos implementaciones intercambiables:
 * almacén JSON (dev sin base de datos) y Postgres (producción).
 */
export interface Repo {
  // Cuentas (organizaciones / tenants)
  createAccount(data: { name: string; plan: PlanId }): Promise<Account>;
  getAccount(accountId: string): Promise<Account>;
  saveAccount(account: Account): Promise<void>;

  // Usuarios
  createUser(data: Omit<User, "id" | "createdAt">): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;

  // Sesiones
  createSession(userId: string, ttlMs: number): Promise<Session>;
  getSession(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<void>;

  // Cámaras (siempre scopeadas por accountId)
  listCameras(accountId: string): Promise<Camera[]>;
  getCamera(id: string): Promise<Camera | undefined>;
  createCamera(data: Omit<Camera, "id" | "createdAt">): Promise<Camera>;
  updateCamera(id: string, patch: Partial<Camera>): Promise<Camera | undefined>;
  deleteCamera(id: string): Promise<boolean>;

  // Eventos
  addEvent(event: DetectionEvent): Promise<void>;
  listEvents(accountId: string, opts?: ListEventsOpts): Promise<DetectionEvent[]>;
}

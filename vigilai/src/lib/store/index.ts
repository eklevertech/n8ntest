import { JsonRepo } from "./json";
import { PgRepo } from "./pg";
import { newId, type ListEventsOpts, type Repo } from "./types";
import type { Account, Camera, DetectionEvent, PlanId, Session, User } from "../types";

/**
 * Selecciona el backend de persistencia:
 *  - Postgres si DATABASE_URL está definido (recomendado para producción).
 *  - Almacén JSON en caso contrario (desarrollo/demo sin base de datos).
 *
 * Se reutiliza una única instancia (importante para el pool de Postgres,
 * también ante el hot-reload de Next en desarrollo).
 */
declare global {
  // eslint-disable-next-line no-var
  var __vigilaiRepo: Repo | undefined;
}

function createRepo(): Repo {
  if (process.env.DATABASE_URL) {
    console.log("[store] usando backend Postgres");
    return new PgRepo();
  }
  console.log("[store] usando almacén JSON (define DATABASE_URL para Postgres)");
  return new JsonRepo();
}

const repo: Repo = globalThis.__vigilaiRepo ?? (globalThis.__vigilaiRepo = createRepo());

export { newId };

// Cuentas
export const createAccount = (data: { name: string; plan: PlanId }): Promise<Account> =>
  repo.createAccount(data);
export const getAccount = (accountId: string): Promise<Account> => repo.getAccount(accountId);
export const saveAccount = (account: Account): Promise<void> => repo.saveAccount(account);

// Usuarios
export const createUser = (data: Omit<User, "id" | "createdAt">): Promise<User> =>
  repo.createUser(data);
export const getUserByEmail = (email: string): Promise<User | undefined> =>
  repo.getUserByEmail(email);
export const getUserById = (id: string): Promise<User | undefined> => repo.getUserById(id);

// Sesiones
export const createSession = (userId: string, ttlMs: number): Promise<Session> =>
  repo.createSession(userId, ttlMs);
export const getSession = (token: string): Promise<Session | undefined> =>
  repo.getSession(token);
export const deleteSession = (token: string): Promise<void> => repo.deleteSession(token);

// Cámaras
export const listCameras = (accountId: string): Promise<Camera[]> =>
  repo.listCameras(accountId);
export const getCamera = (id: string): Promise<Camera | undefined> => repo.getCamera(id);
export const createCamera = (data: Omit<Camera, "id" | "createdAt">): Promise<Camera> =>
  repo.createCamera(data);
export const updateCamera = (
  id: string,
  patch: Partial<Camera>,
): Promise<Camera | undefined> => repo.updateCamera(id, patch);
export const deleteCamera = (id: string): Promise<boolean> => repo.deleteCamera(id);

// Eventos
export const addEvent = (event: DetectionEvent): Promise<void> => repo.addEvent(event);
export const listEvents = (
  accountId: string,
  opts?: ListEventsOpts,
): Promise<DetectionEvent[]> => repo.listEvents(accountId, opts);

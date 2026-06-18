import { JsonRepo } from "./json";
import { PgRepo } from "./pg";
import { DEMO_ACCOUNT_ID, newId, type ListEventsOpts, type Repo } from "./types";
import type { Account, Camera, DetectionEvent } from "../types";

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

export const DEMO = { accountId: DEMO_ACCOUNT_ID };
export { newId };

export const getAccount = (accountId?: string): Promise<Account> =>
  repo.getAccount(accountId);
export const saveAccount = (account: Account): Promise<void> => repo.saveAccount(account);
export const listCameras = (accountId?: string): Promise<Camera[]> =>
  repo.listCameras(accountId);
export const getCamera = (id: string): Promise<Camera | undefined> => repo.getCamera(id);
export const createCamera = (data: Omit<Camera, "id" | "createdAt">): Promise<Camera> =>
  repo.createCamera(data);
export const updateCamera = (
  id: string,
  patch: Partial<Camera>,
): Promise<Camera | undefined> => repo.updateCamera(id, patch);
export const deleteCamera = (id: string): Promise<boolean> => repo.deleteCamera(id);
export const addEvent = (event: DetectionEvent): Promise<void> => repo.addEvent(event);
export const listEvents = (
  accountId?: string,
  opts?: ListEventsOpts,
): Promise<DetectionEvent[]> => repo.listEvents(accountId, opts);

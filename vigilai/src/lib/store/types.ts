import crypto from "node:crypto";
import type { Account, Camera, DetectionEvent } from "../types";

export const DEMO_ACCOUNT_ID = "acct_demo";

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
  getAccount(accountId?: string): Promise<Account>;
  saveAccount(account: Account): Promise<void>;
  listCameras(accountId?: string): Promise<Camera[]>;
  getCamera(id: string): Promise<Camera | undefined>;
  createCamera(data: Omit<Camera, "id" | "createdAt">): Promise<Camera>;
  updateCamera(id: string, patch: Partial<Camera>): Promise<Camera | undefined>;
  deleteCamera(id: string): Promise<boolean>;
  addEvent(event: DetectionEvent): Promise<void>;
  listEvents(accountId: string | undefined, opts?: ListEventsOpts): Promise<DetectionEvent[]>;
}

export function seedAccount(): Account {
  return {
    id: DEMO_ACCOUNT_ID,
    name: "Cuenta de demostración",
    plan: "pro",
    framesAnalyzedThisMonth: 0,
    periodStart: new Date().toISOString(),
  };
}

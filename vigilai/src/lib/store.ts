import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Account, Camera, DetectionEvent } from "./types";

/**
 * Almacén persistente mínimo respaldado por un archivo JSON.
 *
 * Es deliberadamente simple para que el prototipo arranque sin dependencias
 * nativas ni base de datos. Para producción debe sustituirse por Postgres
 * (p.ej. con Prisma) — los tipos y la interfaz de funciones se mantendrían.
 */

interface DB {
  accounts: Account[];
  cameras: Camera[];
  events: DetectionEvent[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const DEMO_ACCOUNT_ID = "acct_demo";

let cache: DB | null = null;
let writeChain: Promise<void> = Promise.resolve();

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function seed(): DB {
  return {
    accounts: [
      {
        id: DEMO_ACCOUNT_ID,
        name: "Cuenta de demostración",
        plan: "pro",
        framesAnalyzedThisMonth: 0,
        periodStart: new Date().toISOString(),
      },
    ],
    cameras: [],
    events: [],
  };
}

async function load(): Promise<DB> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    cache = JSON.parse(raw) as DB;
  } catch {
    cache = seed();
    await persist();
  }
  return cache!;
}

async function persist(): Promise<void> {
  // Serializa las escrituras para evitar corrupción con peticiones concurrentes.
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(cache, null, 2), "utf8");
  });
  return writeChain;
}

export const DEMO = { accountId: DEMO_ACCOUNT_ID };

export async function getAccount(accountId = DEMO_ACCOUNT_ID): Promise<Account> {
  const db = await load();
  const acct = db.accounts.find((a) => a.id === accountId);
  if (!acct) throw new Error(`Cuenta no encontrada: ${accountId}`);
  return acct;
}

export async function saveAccount(account: Account): Promise<void> {
  const db = await load();
  const i = db.accounts.findIndex((a) => a.id === account.id);
  if (i >= 0) db.accounts[i] = account;
  else db.accounts.push(account);
  await persist();
}

export async function listCameras(accountId = DEMO_ACCOUNT_ID): Promise<Camera[]> {
  const db = await load();
  return db.cameras.filter((c) => c.accountId === accountId);
}

export async function getCamera(id: string): Promise<Camera | undefined> {
  const db = await load();
  return db.cameras.find((c) => c.id === id);
}

export async function createCamera(
  data: Omit<Camera, "id" | "createdAt">,
): Promise<Camera> {
  const db = await load();
  const camera: Camera = { ...data, id: newId("cam"), createdAt: new Date().toISOString() };
  db.cameras.push(camera);
  await persist();
  return camera;
}

export async function updateCamera(
  id: string,
  patch: Partial<Camera>,
): Promise<Camera | undefined> {
  const db = await load();
  const i = db.cameras.findIndex((c) => c.id === id);
  if (i < 0) return undefined;
  db.cameras[i] = { ...db.cameras[i], ...patch, id, accountId: db.cameras[i].accountId };
  await persist();
  return db.cameras[i];
}

export async function deleteCamera(id: string): Promise<boolean> {
  const db = await load();
  const before = db.cameras.length;
  db.cameras = db.cameras.filter((c) => c.id !== id);
  const changed = db.cameras.length !== before;
  if (changed) await persist();
  return changed;
}

export async function addEvent(event: DetectionEvent): Promise<void> {
  const db = await load();
  db.events.unshift(event);
  // Mantén el log acotado en el prototipo.
  if (db.events.length > 500) db.events = db.events.slice(0, 500);
  await persist();
}

export async function listEvents(
  accountId = DEMO_ACCOUNT_ID,
  opts: { cameraId?: string; limit?: number } = {},
): Promise<DetectionEvent[]> {
  const db = await load();
  let events = db.events.filter((e) => e.accountId === accountId);
  if (opts.cameraId) events = events.filter((e) => e.cameraId === opts.cameraId);
  return events.slice(0, opts.limit ?? 100);
}

export { newId };

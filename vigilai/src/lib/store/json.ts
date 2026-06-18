import { promises as fs } from "node:fs";
import path from "node:path";
import type { Account, Camera, DetectionEvent } from "../types";
import {
  DEMO_ACCOUNT_ID,
  newId,
  seedAccount,
  type ListEventsOpts,
  type Repo,
} from "./types";

/**
 * Almacén respaldado por un archivo JSON. Sin dependencias nativas ni base de
 * datos: ideal para desarrollo o demos. Para producción usar el backend Postgres.
 */
interface DB {
  accounts: Account[];
  cameras: Camera[];
  events: DetectionEvent[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

export class JsonRepo implements Repo {
  private cache: DB | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  private async load(): Promise<DB> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as DB;
    } catch {
      this.cache = { accounts: [seedAccount()], cameras: [], events: [] };
      await this.persist();
    }
    return this.cache;
  }

  private persist(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(DB_FILE, JSON.stringify(this.cache, null, 2), "utf8");
    });
    return this.writeChain;
  }

  async getAccount(accountId = DEMO_ACCOUNT_ID): Promise<Account> {
    const db = await this.load();
    const acct = db.accounts.find((a) => a.id === accountId);
    if (!acct) throw new Error(`Cuenta no encontrada: ${accountId}`);
    return acct;
  }

  async saveAccount(account: Account): Promise<void> {
    const db = await this.load();
    const i = db.accounts.findIndex((a) => a.id === account.id);
    if (i >= 0) db.accounts[i] = account;
    else db.accounts.push(account);
    await this.persist();
  }

  async listCameras(accountId = DEMO_ACCOUNT_ID): Promise<Camera[]> {
    const db = await this.load();
    return db.cameras.filter((c) => c.accountId === accountId);
  }

  async getCamera(id: string): Promise<Camera | undefined> {
    const db = await this.load();
    return db.cameras.find((c) => c.id === id);
  }

  async createCamera(data: Omit<Camera, "id" | "createdAt">): Promise<Camera> {
    const db = await this.load();
    const camera: Camera = { ...data, id: newId("cam"), createdAt: new Date().toISOString() };
    db.cameras.push(camera);
    await this.persist();
    return camera;
  }

  async updateCamera(id: string, patch: Partial<Camera>): Promise<Camera | undefined> {
    const db = await this.load();
    const i = db.cameras.findIndex((c) => c.id === id);
    if (i < 0) return undefined;
    db.cameras[i] = { ...db.cameras[i], ...patch, id, accountId: db.cameras[i].accountId };
    await this.persist();
    return db.cameras[i];
  }

  async deleteCamera(id: string): Promise<boolean> {
    const db = await this.load();
    const before = db.cameras.length;
    db.cameras = db.cameras.filter((c) => c.id !== id);
    const changed = db.cameras.length !== before;
    if (changed) await this.persist();
    return changed;
  }

  async addEvent(event: DetectionEvent): Promise<void> {
    const db = await this.load();
    db.events.unshift(event);
    if (db.events.length > 500) db.events = db.events.slice(0, 500);
    await this.persist();
  }

  async listEvents(
    accountId = DEMO_ACCOUNT_ID,
    opts: ListEventsOpts = {},
  ): Promise<DetectionEvent[]> {
    const db = await this.load();
    let events = db.events.filter((e) => e.accountId === accountId);
    if (opts.cameraId) events = events.filter((e) => e.cameraId === opts.cameraId);
    return events.slice(0, opts.limit ?? 100);
  }
}

import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  Account,
  Camera,
  DetectionEvent,
  PlanId,
  Session,
  User,
} from "../types";
import { newId, type ListEventsOpts, type Repo } from "./types";

/**
 * Almacén respaldado por un archivo JSON. Sin dependencias nativas ni base de
 * datos: ideal para desarrollo o demos. Para producción usar el backend Postgres.
 */
interface DB {
  accounts: Account[];
  users: User[];
  sessions: Session[];
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
      const raw = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Partial<DB>;
      this.cache = {
        accounts: raw.accounts ?? [],
        users: raw.users ?? [],
        sessions: raw.sessions ?? [],
        cameras: raw.cameras ?? [],
        events: raw.events ?? [],
      };
    } catch {
      this.cache = { accounts: [], users: [], sessions: [], cameras: [], events: [] };
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

  // ── Cuentas ──────────────────────────────────────────────────────
  async createAccount(data: { name: string; plan: PlanId }): Promise<Account> {
    const db = await this.load();
    const account: Account = {
      id: newId("acct"),
      name: data.name,
      plan: data.plan,
      framesAnalyzedThisMonth: 0,
      periodStart: new Date().toISOString(),
    };
    db.accounts.push(account);
    await this.persist();
    return account;
  }

  async getAccount(accountId: string): Promise<Account> {
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

  // ── Usuarios ─────────────────────────────────────────────────────
  async createUser(data: Omit<User, "id" | "createdAt">): Promise<User> {
    const db = await this.load();
    const user: User = { ...data, id: newId("usr"), createdAt: new Date().toISOString() };
    db.users.push(user);
    await this.persist();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = await this.load();
    const lower = email.toLowerCase();
    return db.users.find((u) => u.email.toLowerCase() === lower);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const db = await this.load();
    return db.users.find((u) => u.id === id);
  }

  // ── Sesiones ─────────────────────────────────────────────────────
  async createSession(userId: string, ttlMs: number): Promise<Session> {
    const db = await this.load();
    const session: Session = {
      token: newId("sess"),
      userId,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    };
    db.sessions.push(session);
    await this.persist();
    return session;
  }

  async getSession(token: string): Promise<Session | undefined> {
    const db = await this.load();
    const s = db.sessions.find((x) => x.token === token);
    if (!s) return undefined;
    if (new Date(s.expiresAt).getTime() < Date.now()) {
      await this.deleteSession(token);
      return undefined;
    }
    return s;
  }

  async deleteSession(token: string): Promise<void> {
    const db = await this.load();
    const before = db.sessions.length;
    db.sessions = db.sessions.filter((x) => x.token !== token);
    if (db.sessions.length !== before) await this.persist();
  }

  // ── Cámaras ──────────────────────────────────────────────────────
  async listCameras(accountId: string): Promise<Camera[]> {
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

  // ── Eventos ──────────────────────────────────────────────────────
  async addEvent(event: DetectionEvent): Promise<void> {
    const db = await this.load();
    db.events.unshift(event);
    if (db.events.length > 1000) db.events = db.events.slice(0, 1000);
    await this.persist();
  }

  async listEvents(accountId: string, opts: ListEventsOpts = {}): Promise<DetectionEvent[]> {
    const db = await this.load();
    let events = db.events.filter((e) => e.accountId === accountId);
    if (opts.cameraId) events = events.filter((e) => e.cameraId === opts.cameraId);
    return events.slice(0, opts.limit ?? 100);
  }
}

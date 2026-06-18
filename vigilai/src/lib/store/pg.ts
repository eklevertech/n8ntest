import { Pool, type PoolClient } from "pg";
import type { Account, Camera, DetectionEvent, NotificationConfig, Rule, Severity } from "../types";
import {
  DEMO_ACCOUNT_ID,
  newId,
  seedAccount,
  type ListEventsOpts,
  type Repo,
} from "./types";

/**
 * Backend de persistencia en Postgres (node-postgres).
 *
 * Activa este backend definiendo DATABASE_URL. El esquema se crea
 * automáticamente en el primer uso (ver también db/schema.sql como referencia).
 * Para SSL en proveedores gestionados, usa sslmode=require en la URL o PGSSL=true.
 */

function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL!;
  const needsSsl =
    process.env.PGSSL === "true" || /sslmode=require/.test(connectionString);
  return new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PGPOOL_MAX ?? 5),
  });
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  name text NOT NULL,
  plan text NOT NULL,
  frames_analyzed_this_month integer NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cameras (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  capture_interval_sec integer NOT NULL DEFAULT 8,
  frames_per_analysis integer NOT NULL DEFAULT 4,
  frame_spacing_ms integer NOT NULL DEFAULT 700,
  motion_detection_enabled boolean NOT NULL DEFAULT true,
  motion_threshold double precision NOT NULL DEFAULT 1.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cameras_account_idx ON cameras(account_id);

CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  camera_id text NOT NULL,
  camera_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  violation_detected boolean NOT NULL,
  rule_violated text NOT NULL DEFAULT '',
  severity text NOT NULL,
  confidence integer NOT NULL,
  description text NOT NULL DEFAULT '',
  snapshot text,
  notified jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS events_account_created_idx ON events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_camera_created_idx ON events(camera_id, created_at DESC);
`;

function toCamera(r: Record<string, unknown>): Camera {
  return {
    id: r.id as string,
    accountId: r.account_id as string,
    name: r.name as string,
    location: r.location as string,
    rules: r.rules as Rule[],
    notifications: r.notifications as NotificationConfig,
    captureIntervalSec: r.capture_interval_sec as number,
    framesPerAnalysis: r.frames_per_analysis as number,
    frameSpacingMs: r.frame_spacing_ms as number,
    motionDetectionEnabled: r.motion_detection_enabled as boolean,
    motionThreshold: Number(r.motion_threshold),
    createdAt: (r.created_at as Date).toISOString(),
  };
}

function toEvent(r: Record<string, unknown>): DetectionEvent {
  return {
    id: r.id as string,
    accountId: r.account_id as string,
    cameraId: r.camera_id as string,
    cameraName: r.camera_name as string,
    createdAt: (r.created_at as Date).toISOString(),
    violationDetected: r.violation_detected as boolean,
    ruleViolated: r.rule_violated as string,
    severity: r.severity as Severity,
    confidence: r.confidence as number,
    description: r.description as string,
    snapshot: (r.snapshot as string | null) ?? undefined,
    notified: r.notified as DetectionEvent["notified"],
  };
}

export class PgRepo implements Repo {
  private pool: Pool;
  private ready: Promise<void> | null = null;

  constructor() {
    this.pool = makePool();
  }

  /** Crea el esquema y siembra la cuenta demo una sola vez. */
  private init(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.pool.query(SCHEMA);
        const demo = seedAccount();
        await this.pool.query(
          `INSERT INTO accounts (id, name, plan, frames_analyzed_this_month, period_start)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [demo.id, demo.name, demo.plan, demo.framesAnalyzedThisMonth, demo.periodStart],
        );
      })().catch((err) => {
        this.ready = null; // permite reintentar en la siguiente petición
        throw err;
      });
    }
    return this.ready;
  }

  private async query<T extends Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
    client?: PoolClient,
  ): Promise<T[]> {
    await this.init();
    const runner = client ?? this.pool;
    const res = await runner.query(text, params);
    return res.rows as T[];
  }

  async getAccount(accountId = DEMO_ACCOUNT_ID): Promise<Account> {
    const rows = await this.query(`SELECT * FROM accounts WHERE id = $1`, [accountId]);
    const r = rows[0];
    if (!r) throw new Error(`Cuenta no encontrada: ${accountId}`);
    return {
      id: r.id as string,
      name: r.name as string,
      plan: r.plan as Account["plan"],
      framesAnalyzedThisMonth: r.frames_analyzed_this_month as number,
      periodStart: (r.period_start as Date).toISOString(),
    };
  }

  async saveAccount(account: Account): Promise<void> {
    await this.query(
      `INSERT INTO accounts (id, name, plan, frames_analyzed_this_month, period_start)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         plan = EXCLUDED.plan,
         frames_analyzed_this_month = EXCLUDED.frames_analyzed_this_month,
         period_start = EXCLUDED.period_start`,
      [
        account.id,
        account.name,
        account.plan,
        account.framesAnalyzedThisMonth,
        account.periodStart,
      ],
    );
  }

  async listCameras(accountId = DEMO_ACCOUNT_ID): Promise<Camera[]> {
    const rows = await this.query(
      `SELECT * FROM cameras WHERE account_id = $1 ORDER BY created_at`,
      [accountId],
    );
    return rows.map(toCamera);
  }

  async getCamera(id: string): Promise<Camera | undefined> {
    const rows = await this.query(`SELECT * FROM cameras WHERE id = $1`, [id]);
    return rows[0] ? toCamera(rows[0]) : undefined;
  }

  async createCamera(data: Omit<Camera, "id" | "createdAt">): Promise<Camera> {
    const id = newId("cam");
    const rows = await this.query(
      `INSERT INTO cameras
         (id, account_id, name, location, rules, notifications,
          capture_interval_sec, frames_per_analysis, frame_spacing_ms,
          motion_detection_enabled, motion_threshold)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        id,
        data.accountId,
        data.name,
        data.location,
        JSON.stringify(data.rules),
        JSON.stringify(data.notifications),
        data.captureIntervalSec,
        data.framesPerAnalysis,
        data.frameSpacingMs,
        data.motionDetectionEnabled,
        data.motionThreshold,
      ],
    );
    return toCamera(rows[0]);
  }

  async updateCamera(id: string, patch: Partial<Camera>): Promise<Camera | undefined> {
    const current = await this.getCamera(id);
    if (!current) return undefined;
    // Fusiona en memoria y reescribe (los parches son pequeños y poco frecuentes).
    const next: Camera = { ...current, ...patch, id, accountId: current.accountId };
    const rows = await this.query(
      `UPDATE cameras SET
         name = $2, location = $3, rules = $4, notifications = $5,
         capture_interval_sec = $6, frames_per_analysis = $7, frame_spacing_ms = $8,
         motion_detection_enabled = $9, motion_threshold = $10
       WHERE id = $1
       RETURNING *`,
      [
        id,
        next.name,
        next.location,
        JSON.stringify(next.rules),
        JSON.stringify(next.notifications),
        next.captureIntervalSec,
        next.framesPerAnalysis,
        next.frameSpacingMs,
        next.motionDetectionEnabled,
        next.motionThreshold,
      ],
    );
    return rows[0] ? toCamera(rows[0]) : undefined;
  }

  async deleteCamera(id: string): Promise<boolean> {
    const res = await this.query(`DELETE FROM cameras WHERE id = $1 RETURNING id`, [id]);
    return res.length > 0;
  }

  async addEvent(event: DetectionEvent): Promise<void> {
    await this.query(
      `INSERT INTO events
         (id, account_id, camera_id, camera_name, created_at, violation_detected,
          rule_violated, severity, confidence, description, snapshot, notified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        event.id,
        event.accountId,
        event.cameraId,
        event.cameraName,
        event.createdAt,
        event.violationDetected,
        event.ruleViolated,
        event.severity,
        event.confidence,
        event.description,
        event.snapshot ?? null,
        JSON.stringify(event.notified),
      ],
    );
  }

  async listEvents(
    accountId = DEMO_ACCOUNT_ID,
    opts: ListEventsOpts = {},
  ): Promise<DetectionEvent[]> {
    const limit = opts.limit ?? 100;
    const rows = opts.cameraId
      ? await this.query(
          `SELECT * FROM events WHERE account_id = $1 AND camera_id = $2
           ORDER BY created_at DESC LIMIT $3`,
          [accountId, opts.cameraId, limit],
        )
      : await this.query(
          `SELECT * FROM events WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [accountId, limit],
        );
    return rows.map(toEvent);
  }
}

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Pool } from "pg";

/**
 * Runner de migraciones para Postgres. Aplica en orden los archivos
 * db/migrations/*.sql que aún no estén registrados en schema_migrations.
 *
 * - Cada migración corre en su propia transacción.
 * - Un advisory lock de Postgres evita carreras entre instancias.
 */
const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");
const ADVISORY_LOCK_KEY = 472839; // identificador arbitrario y estable

export async function runMigrations(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         id text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );

    const done = new Set(
      (await client.query("SELECT id FROM schema_migrations")).rows.map((r) => r.id as string),
    );

    let files: string[] = [];
    try {
      files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    } catch {
      files = [];
    }

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migración fallida (${file}): ${(err as Error).message}`);
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => {});
    client.release();
  }
  return applied;
}

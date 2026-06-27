// Runner de migraciones para CI/operación: aplica db/migrations/*.sql pendientes.
//   DATABASE_URL=... node scripts/migrate.mjs
import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definido.");
  process.exit(1);
}

const needsSsl = process.env.PGSSL === "true" || /sslmode=require/.test(url);
const pool = new Pool({
  connectionString: url,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

const DIR = path.join(process.cwd(), "db", "migrations");
const LOCK = 472839;

const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock($1)", [LOCK]);
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  );
  const done = new Set(
    (await client.query("SELECT id FROM schema_migrations")).rows.map((r) => r.id),
  );
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(DIR, file), "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log("aplicada:", file);
      applied++;
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Migración fallida (${file}): ${err.message}`);
    }
  }
  console.log(applied === 0 ? "Sin migraciones pendientes." : `${applied} migración(es) aplicada(s).`);
} finally {
  await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
  client.release();
  await pool.end();
}

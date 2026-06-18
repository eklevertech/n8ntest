-- Esquema de referencia para el backend Postgres de VigilAI.
-- La app también crea estas tablas automáticamente en el primer uso
-- (ver src/lib/store/pg.ts). Puedes aplicarlo a mano con:
--   psql "$DATABASE_URL" -f db/schema.sql

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

-- Cuenta de demostración (idempotente).
INSERT INTO accounts (id, name, plan)
VALUES ('acct_demo', 'Cuenta de demostración', 'pro')
ON CONFLICT (id) DO NOTHING;

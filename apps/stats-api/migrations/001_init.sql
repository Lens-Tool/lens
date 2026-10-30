-- LENS statistics database, migration 001.
-- Stores ONLY the fields of UsageEvent (packages/shared). Never add columns for file paths,
-- prompt text, code, project names or user names (see docs/adr/0002 and 0003).

CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_events (
  id            BIGSERIAL PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects (id),
  session_id    TEXT NOT NULL REFERENCES sessions (id),
  tool          TEXT NOT NULL,
  tokens_before INTEGER NOT NULL CHECK (tokens_before >= 0),
  tokens_after  INTEGER NOT NULL CHECK (tokens_after >= 0),
  duration_ms   INTEGER NOT NULL CHECK (duration_ms >= 0),
  occurred_at   TIMESTAMPTZ NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_project_time_idx ON usage_events (project_id, occurred_at);
CREATE INDEX IF NOT EXISTS usage_events_session_idx ON usage_events (session_id);

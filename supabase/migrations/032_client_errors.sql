-- 032: client_errors — captures real user-facing browser errors (uncaught
-- errors, unhandled promise rejections, React error-boundary crashes) posted
-- from /api/client-error. Surfaced + alerted on by the daily health check.
-- (2026-09-20, per Eric — 6 months in, catch errors as users hit them, not
-- only in weekly audits.)
CREATE TABLE IF NOT EXISTS client_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'window',   -- window | promise | boundary
  severity TEXT NOT NULL DEFAULT 'error',  -- error | critical
  url TEXT,
  stack TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_errors_created ON client_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_errors_message ON client_errors(message);
ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;
-- No public policies: only the service role (API route + health check) reads/writes.

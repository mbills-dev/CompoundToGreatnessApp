/*
# Create edge_function_invocations table for AI cost monitoring

## Purpose
Self-logging table that records every edge function invocation, so future
cost spikes (like the Aug 10 2-5 AM event) can be diagnosed by querying
this table instead of digging through Supabase's dashboard. Each edge
function inserts a row at the start of its handler, wrapped in try/catch
so a logging failure never breaks the actual function.

## New Tables
- `edge_function_invocations`
  - `id` (bigserial, primary key) — auto-incrementing ID
  - `function_name` (text, not null) — name of the edge function (e.g. "detect-vague-goals")
  - `invoked_at` (timestamptz, not null, default now()) — when the function was called
  - `request_summary` (text, nullable) — first 100 chars of the key input (goal text, input text, etc.)

## Security
- RLS enabled.
- INSERT only: edge functions use the service role key (bypasses RLS),
  so no anon/authenticated INSERT policy is needed. The service role
  can always insert regardless of RLS.
- SELECT for authenticated users only: allows querying from the app
  or Supabase dashboard to diagnose spikes.
- No UPDATE or DELETE policies: rows are append-only audit logs.

## Notes
1. This table is write-only from edge functions (service role bypasses RLS).
2. Authenticated users can read all rows — this is intentional so the
   app can display cost diagnostics if needed.
3. The table is append-only (no UPDATE/DELETE policies).
*/

CREATE TABLE IF NOT EXISTS edge_function_invocations (
  id bigserial PRIMARY KEY,
  function_name text NOT NULL,
  invoked_at timestamptz NOT NULL DEFAULT now(),
  request_summary text
);

ALTER TABLE edge_function_invocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_invocations" ON edge_function_invocations;
CREATE POLICY "authenticated_read_invocations"
ON edge_function_invocations FOR SELECT
TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_edge_func_invocations_at
ON edge_function_invocations (invoked_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_func_invocations_name
ON edge_function_invocations (function_name, invoked_at DESC);

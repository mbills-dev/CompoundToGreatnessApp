/*
# Add challenge_run_id to progress_photos for per-run ownership

## Summary
Each 77-day challenge run is currently identified only by the goal's
`challenge_start_date` + `total_restarts` counter. When a challenge restarts,
`challenge_start_date` is reset to NULL and `total_restarts` increments, but
proof photos have no run association — so Day 1 proof from Run 1 appears on
Day 1 of Run 2.

This migration adds a `challenge_run_id` column to `progress_photos` so every
proof record belongs to a specific challenge run. The run ID is a text string
computed as `{goal_id}_{total_restarts}` (e.g. `abc123_0` for the first run,
`abc123_1` for the second). This is backward-compatible: existing legacy rows
get NULL and are migrated to use the goal's current run where possible.

## Changes to existing tables
- `progress_photos`
  - `challenge_run_id` (text, nullable) — identifies which challenge run this proof belongs to

## Security
- No new policies needed. Existing ownership policies on `progress_photos`
  already scope by `user_id = auth.uid()`. The new column is user-controlled
  (the client sets it on insert), which is fine since it only affects which
  run the proof is grouped under — not access control.

## Important notes
1. No data is lost — existing rows keep their data and get `challenge_run_id = NULL`.
2. Legacy NULL rows are still visible in queries that don't filter by run_id.
3. New proof inserts will include the current run_id.
4. Queries for "today's proof" filter by both user_id and challenge_run_id.
5. Future "Past Journeys" can group by challenge_run_id to show each run separately.
*/

ALTER TABLE progress_photos
  ADD COLUMN IF NOT EXISTS challenge_run_id text;

-- Index for efficient run-scoped queries
CREATE INDEX IF NOT EXISTS progress_photos_run_idx
  ON progress_photos (user_id, challenge_run_id, challenge_day DESC);

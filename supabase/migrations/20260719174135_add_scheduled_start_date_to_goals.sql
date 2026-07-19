/*
# Add scheduled_start_date to goals

1. Modified Tables
- `goals`
  - New column `scheduled_start_date` (date, nullable) — an optional date a user
    can set when scheduling a goal to begin on a future day. Existing rows get
    NULL (no scheduled start), which preserves current behavior where the
    challenge starts immediately upon first completion.

2. Security
- No RLS changes. The `goals` table already has RLS enabled with existing
  owner-scoped policies; a new nullable column inherits those policies and
  introduces no new access surface.

3. Notes
- Additive only: no columns dropped, renamed, or retyped, so no existing data
  is at risk.
- `IF NOT EXISTS` makes this safe to re-run if the migration is applied again
  after a lost-response timeout.
*/

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS scheduled_start_date date;

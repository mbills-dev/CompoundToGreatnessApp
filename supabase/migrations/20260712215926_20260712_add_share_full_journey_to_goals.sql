/*
# Add share_full_journey column to goals

1. Modified Tables
- `goals`
  - Added `share_full_journey` (boolean, NOT NULL, DEFAULT true)
    Controls whether watchers can see the user's identity statement
    and daily activity checklist. When false, watchers see only the
    streak hero, day count, challenge wall / month view, and badges.

2. Security
- No RLS policy changes — the column is readable by the same policies
  that already govern goal rows (watcher invitations + public watcher page).
- Existing watcher SELECT policies will automatically expose this column.

3. Important Notes
- Default is `true` so existing users keep their current sharing behavior
  with no action required.
- The column is nullable-safe via NOT NULL + DEFAULT, so all existing rows
  backfill to `true` immediately.
*/

ALTER TABLE goals ADD COLUMN IF NOT EXISTS share_full_journey boolean NOT NULL DEFAULT true;

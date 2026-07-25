/*
# Add category column to badges

1. Modified Tables
- `badges` — added `category` (text, NOT NULL, DEFAULT 'milestone').
  - Classifies each badge for grouping/filtering (e.g. milestone, streak,
    completion, lifetime). Existing rows backfill to 'milestone' via the
    column DEFAULT. New badge inserts that omit `category` also default to
    'milestone'.

2. Security
- No RLS or policy changes. The column is covered by the existing
  "Anyone can read badges" SELECT policy on `badges`.

3. Notes
- Additive only — no data loss, no type changes, no renames.
- Idempotent: guarded by an IF NOT EXISTS check so re-running the
  migration is a no-op once the column exists.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badges' AND column_name = 'category'
  ) THEN
    ALTER TABLE badges ADD COLUMN category text NOT NULL DEFAULT 'milestone';
  END IF;
END $$;

-- Verify
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'badges' AND column_name = 'category';
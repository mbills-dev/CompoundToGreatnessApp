/*
# Proof of Progress — multi-photo support

## Summary
Evolves the existing `progress_photos` table from a one-photo-per-day model
into a multi-proof-per-day model. Adds optional caption and source fields,
makes `goal_id` nullable (so "General progress" proof is possible), and adds
a DELETE policy so users can remove their own proof.

## Changes to existing tables
- `progress_photos`
  - `goal_id` — changed from NOT NULL to nullable (allows general/unassociated proof)
  - `source` (text, default 'camera') — 'camera' | 'library'
  - `note` (text, nullable) — optional user caption

## Security
- Adds DELETE policy so authenticated users can delete their own proof rows.
- All existing SELECT/INSERT/UPDATE policies remain unchanged.

## Important notes
1. No data is lost — existing rows keep their goal_id and get source='camera' by default.
2. No unique constraint is added — multiple rows per (goal_id, challenge_day) is intentional.
3. The existing index on (goal_id, challenge_day) remains valid.
*/

-- Make goal_id nullable for "General progress" proof
ALTER TABLE progress_photos ALTER COLUMN goal_id DROP NOT NULL;

-- Add source column: 'camera' or 'library'
ALTER TABLE progress_photos
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'camera';

-- Add optional note/caption column
ALTER TABLE progress_photos
  ADD COLUMN IF NOT EXISTS note text;

-- Add DELETE policy (was intentionally missing for data preservation,
-- but users need to be able to remove their own proof)
DROP POLICY IF EXISTS "Users can delete own progress photos" ON progress_photos;
CREATE POLICY "Users can delete own progress photos"
  ON progress_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add index for user-scoped queries (all proof for a user, ordered by day)
CREATE INDEX IF NOT EXISTS progress_photos_user_day_idx
  ON progress_photos (user_id, challenge_day DESC);

/*
# Add image_url column to badges and update six badge colors

## Purpose
Adds an optional image URL column to the badges table for future image-based
badge artwork, and updates the color of six specific badges to a unified
accent color (#FF4400).

## Schema Changes
1. `badges` table
   - NEW column: `image_url` (text, nullable). Optional URL pointing to a
     badge image asset. No NOT NULL constraint so existing and future badges
     can omit it. No default value.

## Data Changes
2. `badges` table — UPDATE color to '#FF4400' for the following badge keys:
   - milestone_40
   - streak_60
   - evidence_100
   - weekend_warrior
   - watcher_5
   - signed

   These six badges now share a consistent accent color. All other badge
   colors are untouched.

## Security
- No RLS or policy changes. The badges table's existing policies are unchanged.
- No new tables created.

## Idempotency
- `ADD COLUMN IF NOT EXISTS` makes the ALTER safe to re-run.
- The UPDATE is safe to re-run: it simply re-sets the same color on the same
  rows.

## Important Notes
1. This migration does NOT drop, rename, or retype any existing column — no
   data loss is possible.
2. `image_url` is nullable; no backfill is needed for existing rows.
*/

ALTER TABLE badges ADD COLUMN IF NOT EXISTS image_url text;

UPDATE badges
SET color = '#FF4400'
WHERE key IN (
  'milestone_40',
  'streak_60',
  'evidence_100',
  'weekend_warrior',
  'watcher_5',
  'signed'
);

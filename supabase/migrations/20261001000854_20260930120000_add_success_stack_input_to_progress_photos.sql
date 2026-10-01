/*
# Associate proof with a Success Stack input

## Summary
Proof of Progress is assigned to a Success Stack input (a `daily_activities`
row), not a goal. `goals` rows hold the identity statement for a challenge,
so they are the wrong entity for "what does this proof show?".

## Changes to existing tables
- `progress_photos`
  - `daily_activity_id` (uuid, nullable, FK -> daily_activities.id,
    ON DELETE SET NULL) — the input this proof was assigned to.
    NULL = "General progress".
  - `daily_activity_name` (text, nullable) — the input's name at capture time,
    so historical proof keeps its label if the input is later renamed or
    deleted (inputs can be removed from the Success Stack in edit mode).

## Unchanged
- `goal_id` keeps its meaning: the challenge goal the proof belongs to.
- `challenge_run_id`, RLS policies, storage, and existing rows are untouched.
  Existing rows get NULL for both new columns and display as
  "General progress".
*/

ALTER TABLE progress_photos
  ADD COLUMN IF NOT EXISTS daily_activity_id uuid
    REFERENCES daily_activities(id) ON DELETE SET NULL;

ALTER TABLE progress_photos
  ADD COLUMN IF NOT EXISTS daily_activity_name text;

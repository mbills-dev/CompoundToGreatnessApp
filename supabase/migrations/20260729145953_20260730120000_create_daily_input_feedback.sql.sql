/*
# Create daily_input_feedback table

1. Purpose
- Captures analytics data on how users arrive at their final daily-input text
  during the identity/goal-building flow. One row is inserted each time a user
  finalizes a daily input anywhere in the flow.
- Used for internal analysis only — no UI reads or displays this table yet.

2. New Tables
- `daily_input_feedback`
  - `id` (uuid, primary key, auto-generated)
  - `user_id` (uuid, not null, defaults to the authenticated user, references auth.users with cascade delete)
  - `goal_text` (text, not null) — the goal label the input relates to
  - `source` (enum: 'ai_suggested' | 'ai_edited' | 'user_written') — how the final text was produced
    - ai_suggested: user accepted an AI-generated suggestion without modification
    - ai_edited: user started from an AI suggestion but modified the text before finalizing
    - user_written: user typed the input from scratch
  - `final_input_text` (text, not null) — the text the user committed to
  - `specificity_flag_triggered` (boolean, default false) — true if the specificity validator returned specific=false for this input
  - `created_at` (timestamptz, defaults to now)

3. Security
- Enable RLS on `daily_input_feedback`.
- Owner-scoped CRUD: each authenticated user can only insert and read their own rows.
  This is analytics data, so users can read their own history but cannot update or delete
  (insert + select only; update/delete policies are omitted intentionally to protect data integrity).

4. Notes
- The `source` enum is created with IF NOT EXISTS so re-running is safe.
- Only INSERT and SELECT policies are created — no UPDATE or DELETE, because this is
  an append-only analytics table.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'daily_input_source') THEN
    CREATE TYPE daily_input_source AS ENUM ('ai_suggested', 'ai_edited', 'user_written');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS daily_input_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_text text NOT NULL,
  source daily_input_source NOT NULL,
  final_input_text text NOT NULL,
  specificity_flag_triggered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE daily_input_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_own_daily_input_feedback" ON daily_input_feedback;
CREATE POLICY "insert_own_daily_input_feedback"
  ON daily_input_feedback FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_daily_input_feedback" ON daily_input_feedback;
CREATE POLICY "select_own_daily_input_feedback"
  ON daily_input_feedback FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

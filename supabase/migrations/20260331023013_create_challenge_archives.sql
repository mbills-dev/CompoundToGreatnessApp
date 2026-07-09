/*
  # Create challenge_archives table

  ## Summary
  Captures a permanent snapshot of a completed or abandoned challenge so users
  can look back on past runs at any time.

  ## New Tables

  ### challenge_archives
  | Column | Type | Description |
  |--------|------|-------------|
  | id | uuid PK | Auto-generated row identifier |
  | user_id | uuid FK | Owner (auth.users) |
  | goal_id | uuid | Reference to the original goals row (nullable in case goal is later deleted) |
  | goal_title | text | Snapshot of the goal title at archive time |
  | start_date | date | When the challenge began (challenge_start_date) |
  | end_date | date | When the archive was created (today) |
  | days_completed | int | current_challenge_day at archive time |
  | total_activities_completed | int | Count of activity completions across all daily_completions rows |
  | total_restarts | int | total_restarts counter at archive time |
  | best_streak | int | best_streak at archive time |
  | reason | text | 'completed' | 'restarted' | 'started_fresh' |
  | identity_statement | text | Snapshot of identity_statement |
  | identity_dimensions | jsonb | Snapshot of identity_dimensions array |
  | compass_vision | text | Snapshot of compass_vision |
  | compass_declaration | text | Snapshot of compass_declaration |
  | compass_filter_question | text | Snapshot of compass_filter_question |
  | created_at | timestamptz | Row creation timestamp |

  ## Security
  - RLS enabled
  - Authenticated users can only read/insert their own rows
  - No update/delete allowed (archives are immutable)
*/

CREATE TABLE IF NOT EXISTS challenge_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid,
  goal_title text NOT NULL DEFAULT '',
  start_date date,
  end_date date NOT NULL DEFAULT CURRENT_DATE,
  days_completed int NOT NULL DEFAULT 0,
  total_activities_completed int NOT NULL DEFAULT 0,
  total_restarts int NOT NULL DEFAULT 0,
  best_streak int NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT 'restarted',
  identity_statement text,
  identity_dimensions jsonb,
  compass_vision text,
  compass_declaration text,
  compass_filter_question text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_archives_user_id ON challenge_archives(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_archives_created_at ON challenge_archives(user_id, created_at DESC);

ALTER TABLE challenge_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own archives"
  ON challenge_archives FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own archives"
  ON challenge_archives FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

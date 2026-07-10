/*
  # Create progress_photos table

  ## Summary
  Adds a progress_photos table to store per-day challenge progress photos.

  ## New Tables
  - `progress_photos`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references auth.users)
    - `goal_id` (uuid, references goals)
    - `challenge_day` (int) — which day of the 77-day challenge this photo is for
    - `storage_url` (text) — full public URL returned from Supabase Storage
    - `is_milestone` (boolean, default false) — true when challenge_day is 7, 21, 40, 60, or 77
    - `is_shared_with_watchers` (boolean, default false)
    - `created_at` (timestamptz, default now())

  ## Security
  - RLS enabled
  - Authenticated users can insert/select/update their own rows
  - No delete policy (data preservation)

  ## Indexes
  - `(goal_id, challenge_day)` for fast lookups per goal+day
*/

CREATE TABLE IF NOT EXISTS progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL,
  challenge_day int NOT NULL,
  storage_url text NOT NULL,
  is_milestone boolean NOT NULL DEFAULT false,
  is_shared_with_watchers boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS progress_photos_goal_day_idx
  ON progress_photos (goal_id, challenge_day);

CREATE POLICY "Users can insert own progress photos"
  ON progress_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own progress photos"
  ON progress_photos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own progress photos"
  ON progress_photos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

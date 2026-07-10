/*
  # Create Evidence Logs Table

  1. New Tables
    - `evidence_logs`
      - `id` (uuid, primary key)
      - `goal_id` (uuid, foreign key to goals)
      - `completion_date` (date) - The day this log entry is for
      - `content` (text) - The log entry text
      - `created_at` (timestamptz) - When the entry was created
      - `updated_at` (timestamptz) - When the entry was last modified

  2. Security
    - Enable RLS on `evidence_logs` table
    - Add policy for anon access (matching existing app pattern)

  3. Indexes
    - Index on goal_id + completion_date for fast lookups per day
*/

CREATE TABLE IF NOT EXISTS evidence_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  completion_date date NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_logs_goal_date
  ON evidence_logs(goal_id, completion_date);

ALTER TABLE evidence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to evidence_logs"
  ON evidence_logs FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

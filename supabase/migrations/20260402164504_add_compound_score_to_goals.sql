/*
  # Add compound_score to goals

  ## Summary
  Adds a `compound_score` float column to the `goals` table to persist the user's
  cumulative compound score (1.01^streak - 1) * 100. The score only ever grows or holds —
  it never goes backward even if the streak resets.

  ## Changes
  - `goals`: new column `compound_score` (float, default 0.0)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'compound_score'
  ) THEN
    ALTER TABLE goals ADD COLUMN compound_score float DEFAULT 0.0;
  END IF;
END $$;

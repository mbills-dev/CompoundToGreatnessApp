/*
  # Add Total Restarts Tracking

  1. Modified Tables
    - `goals`
      - `total_restarts` (integer, default 0) - Tracks how many times the 77-day challenge has been restarted

  2. Notes
    - This column increments each time a user misses a day or manually resets their challenge
    - Supports the new challenge metrics dashboard feature
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'total_restarts'
  ) THEN
    ALTER TABLE goals ADD COLUMN total_restarts integer DEFAULT 0;
  END IF;
END $$;
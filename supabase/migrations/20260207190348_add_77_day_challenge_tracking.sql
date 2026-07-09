/*
  # Add 77-Day Challenge Tracking

  1. Schema Changes
    - Add `challenge_start_date` to goals table to track when the 77-day challenge started
    - Add `current_challenge_day` to track which day the user is currently on (1-77)
    - Add `challenge_phase` to distinguish between 'challenge' and 'maintenance' modes
    - Add `last_completion_date` to help detect missed days and trigger restarts

  2. Updates
    - Set default values for existing goals
    - Add check constraint to ensure current_challenge_day is between 0 and 77

  3. Notes
    - Phase I: 'challenge' mode (77 days, must complete daily or restart)
    - Phase II: 'maintenance' mode (regular calendar, no restart penalty) - to be implemented later
*/

-- Add new columns to goals table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'challenge_start_date'
  ) THEN
    ALTER TABLE goals ADD COLUMN challenge_start_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'current_challenge_day'
  ) THEN
    ALTER TABLE goals ADD COLUMN current_challenge_day integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'challenge_phase'
  ) THEN
    ALTER TABLE goals ADD COLUMN challenge_phase text DEFAULT 'challenge';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'last_completion_date'
  ) THEN
    ALTER TABLE goals ADD COLUMN last_completion_date date;
  END IF;
END $$;

-- Add check constraint for current_challenge_day
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'goals_current_challenge_day_check'
  ) THEN
    ALTER TABLE goals
    ADD CONSTRAINT goals_current_challenge_day_check
    CHECK (current_challenge_day >= 0 AND current_challenge_day <= 77);
  END IF;
END $$;

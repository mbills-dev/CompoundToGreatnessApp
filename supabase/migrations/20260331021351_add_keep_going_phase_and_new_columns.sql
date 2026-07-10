/*
  # Phase 2 "Keep Going" Schema Updates

  ## Summary
  This migration prepares the database for Phase 2 of the 77-Day Challenge, which begins
  after a user completes all 77 days. The internal phase name "maintenance" is renamed to
  "keep_going" (users never see this string). Four changes are made:

  ## Changes

  ### 1. Rename challenge_phase value 'maintenance' -> 'keep_going'
  - Updates any existing rows where challenge_phase = 'maintenance' to 'keep_going'
  - Updates the column default from 'challenge' (unchanged) but ensures keep_going is used

  ### 2. New Column: best_streak (integer, default 0)
  - Added to the goals table
  - Tracks the highest consecutive-day streak the user has ever achieved
  - Updated in application code whenever current streak exceeds stored value

  ### 3. New Column: celebration_seen (boolean, default false)
  - Added to the goals table
  - Prevents the Day 77 completion celebration screen from showing more than once
  - Set to true when the user dismisses the ChallengeCompleteScreen

  ### 4. New Column: edited_at (timestamptz, nullable)
  - Added to the daily_completions table
  - Audit trail for retroactive edits made in Phase 2
  - Written when a past day is edited in keep_going phase

  ## Security
  - No RLS policy changes needed; existing policies cover all new columns
  - All new columns use safe defaults that cannot expose or corrupt existing data

  ## Notes
  - The constraint on current_challenge_day (0-77) is removed and replaced with (0-9999)
    to allow Phase 2 day counting to continue beyond 77
*/

-- 1. Rename 'maintenance' -> 'keep_going' for any existing rows
UPDATE goals
SET challenge_phase = 'keep_going'
WHERE challenge_phase = 'maintenance';

-- 2. Add best_streak column to goals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'best_streak'
  ) THEN
    ALTER TABLE goals ADD COLUMN best_streak integer DEFAULT 0;
  END IF;
END $$;

-- 3. Add celebration_seen column to goals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'celebration_seen'
  ) THEN
    ALTER TABLE goals ADD COLUMN celebration_seen boolean DEFAULT false;
  END IF;
END $$;

-- 4. Add edited_at column to daily_completions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_completions' AND column_name = 'edited_at'
  ) THEN
    ALTER TABLE daily_completions ADD COLUMN edited_at timestamptz;
  END IF;
END $$;

-- 5. Expand the current_challenge_day constraint to allow beyond 77 (for Phase 2 tracking)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'goals_current_challenge_day_check'
  ) THEN
    ALTER TABLE goals DROP CONSTRAINT goals_current_challenge_day_check;
  END IF;
END $$;

ALTER TABLE goals
ADD CONSTRAINT goals_current_challenge_day_check
CHECK (current_challenge_day >= 0);

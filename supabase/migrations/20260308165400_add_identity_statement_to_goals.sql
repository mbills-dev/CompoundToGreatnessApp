/*
  # Add identity statement to goals

  1. Modified Tables
    - `goals`
      - Added `identity_statement` (text, nullable) - stores the user's identity statement built during onboarding
      - Added `identity_dimensions` (jsonb, nullable) - stores the parsed identity dimensions for reference

  2. Notes
    - Both columns are nullable since existing goals won't have identity data
    - identity_dimensions stores the raw dimension data for display on the dashboard
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'identity_statement'
  ) THEN
    ALTER TABLE goals ADD COLUMN identity_statement text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'identity_dimensions'
  ) THEN
    ALTER TABLE goals ADD COLUMN identity_dimensions jsonb;
  END IF;
END $$;
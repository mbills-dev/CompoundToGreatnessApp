/*
  # Add Grace Period Prompted Date to Goals

  ## Summary
  Adds a `grace_period_prompted_date` column to the `goals` table to track when
  a user was last shown the grace period prompt (the "Keep Going / Start Over" modal).

  ## Changes

  ### Modified Tables
  - `goals`
    - `grace_period_prompted_date` (date, nullable) — Stores the date the grace period
      modal was last shown. Used to prevent showing the same prompt multiple times
      for the same incident. When the user responds (either choice), this is set to
      today's date so the prompt won't reappear until a new missed-day incident occurs.

  ## Notes
  - No destructive operations. This is a purely additive migration.
  - Column is nullable, so existing rows are unaffected (treated as never prompted).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'grace_period_prompted_date'
  ) THEN
    ALTER TABLE goals ADD COLUMN grace_period_prompted_date date DEFAULT NULL;
  END IF;
END $$;

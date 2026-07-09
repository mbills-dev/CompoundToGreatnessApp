/*
# Add raw daily input fields to daily_activities

## Summary
Adds four new columns to `daily_activities` to persist the raw
what/when/where values collected during onboarding, alongside the
existing assembled `activity_name` string.

## New Columns on `daily_activities`
- `what` (text, nullable) — the raw "What will you do?" input
- `when_time` (text, nullable) — the human-readable time/days string
  (e.g. "7:00 AM, weekdays") derived from the WhenPickerModal value
- `where_location` (text, nullable) — the raw "Where?" input
- `schedule` (jsonb, nullable) — the full WhenPickerValue object
  (hour, minute, period, days[], reminder) for programmatic access

## Modified Tables
- `daily_activities`: four new nullable columns added; no existing
  columns are changed; all existing rows get NULL for the new columns,
  which is correct since they were created before this migration.

## Security
No changes to RLS policies — existing policies on `daily_activities`
already cover these new columns automatically.

## Notes
1. All four columns are nullable so existing rows and any inserts that
   omit these fields continue to work unchanged.
2. `activity_name` (the assembled string) is unchanged and still the
   primary field used for display in DailyDashboard tiles.
3. `schedule` is jsonb to preserve the full structured picker value
   for future use (notification rescheduling, calendar sync, etc.).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_activities' AND column_name = 'what'
  ) THEN
    ALTER TABLE daily_activities ADD COLUMN what text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_activities' AND column_name = 'when_time'
  ) THEN
    ALTER TABLE daily_activities ADD COLUMN when_time text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_activities' AND column_name = 'where_location'
  ) THEN
    ALTER TABLE daily_activities ADD COLUMN where_location text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_activities' AND column_name = 'schedule'
  ) THEN
    ALTER TABLE daily_activities ADD COLUMN schedule jsonb;
  END IF;
END $$;

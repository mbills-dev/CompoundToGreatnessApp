/*
  # Add Compass (decision filter) to goals

  1. Modified Tables
    - `goals`
      - Added `compass_vision` (text, nullable) - the user's 12-month vision statement
      - Added `compass_declaration` (text, nullable) - the vision reframed as an identity declaration ("I am building...")
      - Added `compass_filter_question` (text, nullable) - the personalized decision filter question

  2. Notes
    - All columns are nullable since existing goals won't have compass data
    - The compass is a decision-making filter inspired by the "Will it make the boat go faster?" framework
    - Users define their vision, sharpen it into a declaration, and create a filter question
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'compass_vision'
  ) THEN
    ALTER TABLE goals ADD COLUMN compass_vision text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'compass_declaration'
  ) THEN
    ALTER TABLE goals ADD COLUMN compass_declaration text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'compass_filter_question'
  ) THEN
    ALTER TABLE goals ADD COLUMN compass_filter_question text;
  END IF;
END $$;
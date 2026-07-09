/*
  # Update Daily Activities Limit to 10

  ## Changes
  - Drop existing check constraint on `order_position` column in `daily_activities` table
  - Add new check constraint allowing order_position from 1 to 10 (increased from 5)
  
  ## Notes
  This allows users to have up to 10 daily tasks instead of the previous limit of 5.
*/

-- Drop the old constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'daily_activities' 
    AND constraint_name = 'daily_activities_order_position_check'
  ) THEN
    ALTER TABLE daily_activities DROP CONSTRAINT daily_activities_order_position_check;
  END IF;
END $$;

-- Add new constraint with limit of 10
ALTER TABLE daily_activities 
ADD CONSTRAINT daily_activities_order_position_check 
CHECK (order_position >= 1 AND order_position <= 10);
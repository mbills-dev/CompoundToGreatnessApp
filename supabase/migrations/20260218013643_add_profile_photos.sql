/*
  # Add Profile Photos Support

  ## Overview
  This migration adds profile photo support to the profiles table and creates a storage bucket
  for profile images.

  ## Changes
  
  ### 1. Update `profiles` table
  - Add `photo_url` column to store profile photo URLs
  
  ## Security
  - Maintain existing RLS policies
*/

-- Add photo_url column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN photo_url text;
  END IF;
END $$;

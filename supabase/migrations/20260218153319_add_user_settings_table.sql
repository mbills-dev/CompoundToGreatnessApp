/*
  # Add User Settings Table

  1. New Tables
    - `user_settings`
      - `id` (uuid, primary key)
      - `user_id` (text) - Identifier for the user (demo mode uses 'demo-user')
      - `first_name` (text, default '') - User's first name
      - `last_name` (text, default '') - User's last name
      - `email` (text, default '') - User's email address
      - `day_end_time` (text, default '12:00 AM') - When the day resets for tracking
      - `morning_notifications` (boolean, default true) - Enable morning reminder
      - `evening_notifications` (boolean, default true) - Enable evening reminder
      - `save_progress_photos` (boolean, default false) - Toggle saving progress photos to device
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_settings` table
    - Add permissive policy for demo mode (anon access)

  3. Notes
    - day_end_time options: '11:00 PM', '11:30 PM', '11:59 PM', '12:00 AM', '12:30 AM', '1:00 AM'
    - This table stores user preferences for the settings screen
*/

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'demo-user',
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  day_end_time text NOT NULL DEFAULT '12:00 AM',
  morning_notifications boolean NOT NULL DEFAULT true,
  evening_notifications boolean NOT NULL DEFAULT true,
  save_progress_photos boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

CREATE POLICY "Allow all access to user_settings"
  ON user_settings FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
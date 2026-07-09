/*
  # Life Dash - Goal Setting App Database Schema

  ## Overview
  This migration creates the database schema for Life Dash, an app that reverse-engineers goals into daily actionable tasks.

  ## New Tables

  ### 1. `goals`
  Stores user goals with their calculation parameters
  - `id` (uuid, primary key)
  - `user_id` (uuid) - Future auth integration
  - `title` (text) - Goal name
  - `goal_type` (text) - Type: business, fitness, health, personal
  - `target_value` (numeric) - Target amount (e.g., $10,000)
  - `target_date` (date) - When to achieve the goal
  - `calculation_params` (jsonb) - Stores calculation variables (conversion rate, price, etc.)
  - `created_at` (timestamptz)
  - `is_active` (boolean) - Only one active goal at a time

  ### 2. `daily_activities`
  Stores the 5 daily activities calculated from the goal
  - `id` (uuid, primary key)
  - `goal_id` (uuid, foreign key)
  - `activity_name` (text)
  - `activity_type` (text) - custom, diet, reading, exercise
  - `target_count` (integer) - How many times per day
  - `order_position` (integer) - Display order (1-5)
  - `created_at` (timestamptz)

  ### 3. `daily_completions`
  Tracks daily progress and checkoffs
  - `id` (uuid, primary key)
  - `goal_id` (uuid, foreign key)
  - `completion_date` (date)
  - `activities_completed` (jsonb) - Array of activity IDs completed
  - `is_rest_day` (boolean) - True for Sundays
  - `completed_at` (timestamptz)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies for future authenticated user access
*/

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('business', 'fitness', 'health', 'personal')),
  target_value numeric NOT NULL,
  target_date date NOT NULL,
  calculation_params jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Create daily_activities table
CREATE TABLE IF NOT EXISTS daily_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  activity_name text NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('custom', 'diet', 'reading', 'exercise')),
  target_count integer DEFAULT 1,
  order_position integer NOT NULL CHECK (order_position >= 1 AND order_position <= 5),
  created_at timestamptz DEFAULT now()
);

-- Create daily_completions table
CREATE TABLE IF NOT EXISTS daily_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  completion_date date NOT NULL,
  activities_completed jsonb DEFAULT '[]'::jsonb,
  is_rest_day boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(goal_id, completion_date)
);

-- Enable Row Level Security
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_completions ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_goals_active ON goals(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_daily_activities_goal ON daily_activities(goal_id);
CREATE INDEX IF NOT EXISTS idx_daily_completions_goal_date ON daily_completions(goal_id, completion_date);

-- RLS Policies (permissive for now, will be restricted with auth)
CREATE POLICY "Allow all access to goals"
  ON goals FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to daily_activities"
  ON daily_activities FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to daily_completions"
  ON daily_completions FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
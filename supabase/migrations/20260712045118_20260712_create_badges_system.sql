/*
# Badge System: badges + user_badges tables

1. New Tables
- `badges` — catalog of all earnable badges (key, title, description, icon, color).
  - `key` (text, primary key) — stable identifier (e.g. 'milestone_7').
  - `title` (text, not null) — display title.
  - `description` (text, not null) — what the badge means.
  - `icon` (text, not null) — lucide icon name.
  - `color` (text, default '#CCFF00') — brand color for the badge.
- `user_badges` — which user earned which badge, optionally tied to a goal.
  - `id` (uuid, primary key, default gen_random_uuid()).
  - `user_id` (uuid, not null, references profiles(id) on delete cascade).
  - `badge_key` (text, not null, references badges(key)).
  - `goal_id` (uuid, references goals(id) on delete set null) — optional context.
  - `day_number` (integer) — challenge day at time of award, optional.
  - `earned_at` (timestamptz, default now()).
  - UNIQUE(user_id, badge_key) — prevents duplicate awards.

2. Seed Data
- 10 badges seeded: 4 milestone badges (day 7/21/40/60), 1 completion badge
  (day 77), 1 lifetime badge (100 days), 4 streak badges (30/60/100/365).

3. Security
- `badges` table: RLS enabled. SELECT open to all authenticated users
  (badge catalog is shared/read-only).
- `user_badges` table: RLS enabled. Users can read their own badges
  and insert their own badges. No update or delete policies (badges
  are immutable once earned).
*/

CREATE TABLE IF NOT EXISTS badges (
  key text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL DEFAULT '#CCFF00'
);

CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_key text NOT NULL REFERENCES badges(key),
  goal_id uuid REFERENCES goals(id) ON DELETE SET NULL,
  day_number integer,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_key)
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read badges" ON badges;
CREATE POLICY "Anyone can read badges" ON badges
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can read their own badges" ON user_badges;
CREATE POLICY "Users can read their own badges" ON user_badges
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own badges" ON user_badges;
CREATE POLICY "Users can insert their own badges" ON user_badges
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

INSERT INTO badges (key, title, description, icon, color) VALUES
  ('milestone_7', 'Day 7', 'Seven days in.', 'star', '#CCFF00'),
  ('milestone_21', 'Day 21', 'Three weeks strong.', 'star', '#CCFF00'),
  ('milestone_40', 'Day 40', 'Through the Void.', 'star', '#CCFF00'),
  ('milestone_60', 'Day 60', 'Almost there.', 'star', '#CCFF00'),
  ('day_77_complete', '77 Days. Done.', 'The full challenge, completed.', 'shield', '#FF4400'),
  ('lifetime_100', '100 Days Stacked', '100 days of showing up.', 'layers', '#CCFF00'),
  ('streak_30', '30 Day Streak', 'A month unbroken.', 'zap', '#CCFF00'),
  ('streak_60', '60 Day Streak', 'Two months unbroken.', 'zap', '#CCFF00'),
  ('streak_100', '100 Day Streak', 'A hundred days unbroken.', 'zap', '#CCFF00'),
  ('streak_365', '365 Day Streak', 'A full year unbroken.', 'zap', '#CCFF00')
ON CONFLICT (key) DO NOTHING;

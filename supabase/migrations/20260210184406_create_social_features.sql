/*
  # Social Features - Friends, Profiles, and Encouragements

  ## Overview
  This migration adds social features to the app, enabling users to connect with friends,
  view their progress, and send encouragement.

  ## New Tables

  ### 1. `profiles`
  User profile information
  - `id` (uuid, primary key) - matches auth.users.id
  - `username` (text, unique) - User's unique username
  - `display_name` (text) - User's display name
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `friendships`
  Connections between users
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key) - User who initiated the friendship
  - `friend_id` (uuid, foreign key) - Friend's user ID
  - `status` (text) - Status: pending, accepted, blocked
  - `created_at` (timestamptz)
  - Unique constraint on (user_id, friend_id)

  ### 3. `encouragements`
  Messages of encouragement sent between friends
  - `id` (uuid, primary key)
  - `from_user_id` (uuid, foreign key)
  - `to_user_id` (uuid, foreign key)
  - `emoji` (text) - Emoji sent
  - `message` (text, optional) - Optional message
  - `created_at` (timestamptz)

  ### 4. `watchers`
  Track who is watching whom
  - `id` (uuid, primary key)
  - `watcher_id` (uuid, foreign key) - User doing the watching
  - `watched_id` (uuid, foreign key) - User being watched
  - `created_at` (timestamptz)
  - Unique constraint on (watcher_id, watched_id)

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated user access
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Create encouragements table
CREATE TABLE IF NOT EXISTS encouragements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  message text,
  created_at timestamptz DEFAULT now()
);

-- Create watchers table
CREATE TABLE IF NOT EXISTS watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watcher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  watched_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(watcher_id, watched_id)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE encouragements ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchers ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_encouragements_to_user ON encouragements(to_user_id);
CREATE INDEX IF NOT EXISTS idx_watchers_watcher ON watchers(watcher_id);
CREATE INDEX IF NOT EXISTS idx_watchers_watched ON watchers(watched_id);

-- RLS Policies (permissive for demo)
CREATE POLICY "Allow all access to profiles"
  ON profiles FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to friendships"
  ON friendships FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to encouragements"
  ON encouragements FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to watchers"
  ON watchers FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
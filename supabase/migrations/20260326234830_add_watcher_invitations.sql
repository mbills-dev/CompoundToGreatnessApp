/*
  # Add Watcher Invitations System

  ## Overview
  Enables paid users to invite free "watchers" to follow their journey.
  Watchers can view the invited user's progress without a paid subscription.

  ## New Tables
  - `watcher_invitations`
    - `id` (uuid, primary key)
    - `inviter_id` (uuid) - the paid user sending the invite
    - `invite_code` (text, unique) - short unique code used in the share link
    - `invitee_email` (text, nullable) - optional target email
    - `accepted_by` (uuid, nullable) - the watcher user who accepted
    - `accepted_at` (timestamptz, nullable)
    - `created_at` (timestamptz)

  ## Notes
  - Only authenticated users can create invitations
  - Anyone can look up an invitation by code (for the accept flow)
  - Accepted_by is set when a watcher account claims the invite
  - Watchers table already exists from the social features migration
*/

CREATE TABLE IF NOT EXISTS watcher_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code text UNIQUE NOT NULL,
  invitee_email text,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE watcher_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can create their own invitations"
  ON watcher_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Authenticated users can view their own invitations"
  ON watcher_invitations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = accepted_by);

CREATE POLICY "Anyone can look up an invitation by code"
  ON watcher_invitations
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can accept an invitation"
  ON watcher_invitations
  FOR UPDATE
  TO authenticated
  USING (accepted_by IS NULL)
  WITH CHECK (auth.uid() = accepted_by);

CREATE INDEX IF NOT EXISTS watcher_invitations_code_idx ON watcher_invitations(invite_code);
CREATE INDEX IF NOT EXISTS watcher_invitations_inviter_idx ON watcher_invitations(inviter_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_watcher'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_watcher boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

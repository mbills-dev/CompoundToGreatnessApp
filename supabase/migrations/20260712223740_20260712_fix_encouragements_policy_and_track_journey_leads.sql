/*
# Security fix: drop anon ALL policy on encouragements + track journey_leads schema

## 1. Security Fix
- Drops the "Allow all access to encouragements" policy that granted
  the `anon` role full CRUD (cmd = ALL) on the `encouragements` table.
  This was a real privacy leak — any unauthenticated request could
  read, modify, or delete all encouragement messages.
- The legitimate insert path is already covered by the
  "Users can send encouragements to friends" INSERT policy scoped to
  `authenticated`. Friends-tab encourage-sending is unaffected.

## 2. Schema: journey_leads
- Adds `read_at` (timestamptz, nullable) to `journey_leads` so watched
  users can mark leads as read.
- Adds an UPDATE policy so authenticated users can mark leads as read
  on their own journey (auth.uid() = watched_user_id).
- Documents the full current shape of `journey_leads` as
  CREATE TABLE IF NOT EXISTS (safe to run where the table already
  exists live) plus its two existing policies:
    - "Anyone can submit a lead" (INSERT, anon + authenticated)
    - "Users can view leads for their own journey" (SELECT, authenticated)

## 3. Tables
- `journey_leads` (already exists live, now tracked in migration history):
  - id (uuid, primary key)
  - watched_user_id (uuid, the user whose journey was watched)
  - name (text, the lead's name)
  - email (text, the lead's email)
  - message (text, optional message from the lead)
  - created_at (timestamptz)
  - read_at (timestamptz, nullable — NEW)

## 4. Security
- Drops: "Allow all access to encouragements" (anon, ALL)
- Adds: "Users can mark their leads as read" (authenticated, UPDATE)
- Re-creates (idempotent): journey_leads SELECT + INSERT policies
*/

-- 1. Drop the dangerous anon ALL policy on encouragements
DROP POLICY IF EXISTS "Allow all access to encouragements" ON encouragements;

-- 2. Add read_at column to journey_leads
ALTER TABLE journey_leads ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- 3. Document journey_leads table shape (safe — IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS journey_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watched_user_id uuid NOT NULL,
  name text,
  email text,
  message text,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- 4. Re-create existing journey_leads policies (idempotent)
DROP POLICY IF EXISTS "Anyone can submit a lead" ON journey_leads;
CREATE POLICY "Anyone can submit a lead"
  ON journey_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view leads for their own journey" ON journey_leads;
CREATE POLICY "Users can view leads for their own journey"
  ON journey_leads FOR SELECT
  TO authenticated
  USING (auth.uid() = watched_user_id);

-- 5. New UPDATE policy for marking leads as read
DROP POLICY IF EXISTS "Users can mark their leads as read" ON journey_leads;
CREATE POLICY "Users can mark their leads as read"
  ON journey_leads FOR UPDATE
  TO authenticated
  USING (auth.uid() = watched_user_id);

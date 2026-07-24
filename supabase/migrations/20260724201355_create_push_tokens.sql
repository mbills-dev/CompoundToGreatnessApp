/*
# Create push_tokens table

1. New Tables
- `push_tokens`
  - `id` (uuid, primary key, auto-generated)
  - `user_id` (uuid, not null, defaults to the authenticated user, FK to auth.users with cascade delete)
  - `token` (text, not null — the Expo/FCM push notification token)
  - `created_at` (timestamptz, defaults to now)
  - `updated_at` (timestamptz, defaults to now)
  - UNIQUE constraint on (user_id, token) to prevent duplicate token registrations per user

2. Security
- Enable RLS on `push_tokens`.
- Owner-scoped CRUD: each authenticated user can only select, insert, update, and delete their own push token rows.
- Four separate policies (one per CRUD verb) scoped to `TO authenticated` using `auth.uid() = user_id`.

3. Notes
- The `user_id` column defaults to `auth.uid()` so client inserts that omit `user_id` still satisfy the INSERT policy's `WITH CHECK`.
- Deleting a user from `auth.users` cascades and removes all their push tokens.
- The unique (user_id, token) pair ensures a token can be re-registered (upsert) without creating duplicates.
*/

CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_push_tokens" ON push_tokens;
CREATE POLICY "select_own_push_tokens" ON push_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_push_tokens" ON push_tokens;
CREATE POLICY "insert_own_push_tokens" ON push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_push_tokens" ON push_tokens;
CREATE POLICY "update_own_push_tokens" ON push_tokens
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_push_tokens" ON push_tokens;
CREATE POLICY "delete_own_push_tokens" ON push_tokens
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

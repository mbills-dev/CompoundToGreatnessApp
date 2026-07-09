/*
  # Create Subscriptions Table and Update Auth Policies

  1. New Tables
    - `subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users) - The subscriber
      - `status` (text) - active, canceled, expired, trial
      - `plan` (text, default 'monthly') - Subscription plan name
      - `provider` (text, default 'revenuecat') - Payment provider
      - `provider_subscription_id` (text) - External subscription ID from provider
      - `current_period_start` (timestamptz) - Start of current billing period
      - `current_period_end` (timestamptz) - End of current billing period
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `subscriptions` table
    - Users can only read their own subscription data
    - Only service role can insert/update/delete subscriptions (managed by backend/webhooks)

  3. Policy Updates for Existing Tables
    - Update `goals` table policies to use auth.uid()
    - Update `daily_activities` policies to use goal ownership
    - Update `daily_completions` policies to use goal ownership
    - Update `user_settings` policies to use auth.uid()
    - Update `evidence_logs` policies to use goal ownership

  4. Notes
    - Subscriptions are managed server-side via RevenueCat webhooks
    - Users can only view their own subscription status
    - Existing anon policies are replaced with authenticated user policies
    - Goals are now scoped to the authenticated user
*/

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'trial')),
  plan text NOT NULL DEFAULT 'monthly',
  provider text NOT NULL DEFAULT 'revenuecat',
  provider_subscription_id text,
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Subscription policies: users can only read their own
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Drop old permissive policies on goals
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to goals' AND tablename = 'goals') THEN
    DROP POLICY "Allow all access to goals" ON goals;
  END IF;
END $$;

-- New goals policies scoped to auth user
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Drop old permissive policies on daily_activities
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to daily_activities' AND tablename = 'daily_activities') THEN
    DROP POLICY "Allow all access to daily_activities" ON daily_activities;
  END IF;
END $$;

-- New daily_activities policies via goal ownership
CREATE POLICY "Users can view own activities"
  ON daily_activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_activities.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own activities"
  ON daily_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_activities.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own activities"
  ON daily_activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_activities.goal_id
      AND goals.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_activities.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own activities"
  ON daily_activities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_activities.goal_id
      AND goals.user_id = auth.uid()
    )
  );

-- Drop old permissive policies on daily_completions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to daily_completions' AND tablename = 'daily_completions') THEN
    DROP POLICY "Allow all access to daily_completions" ON daily_completions;
  END IF;
END $$;

-- New daily_completions policies via goal ownership
CREATE POLICY "Users can view own completions"
  ON daily_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_completions.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own completions"
  ON daily_completions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_completions.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own completions"
  ON daily_completions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_completions.goal_id
      AND goals.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_completions.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own completions"
  ON daily_completions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_completions.goal_id
      AND goals.user_id = auth.uid()
    )
  );

-- Drop old permissive policies on user_settings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to user_settings' AND tablename = 'user_settings') THEN
    DROP POLICY "Allow all access to user_settings" ON user_settings;
  END IF;
END $$;

-- New user_settings policies
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Drop old permissive policies on evidence_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to evidence_logs' AND tablename = 'evidence_logs') THEN
    DROP POLICY "Allow all access to evidence_logs" ON evidence_logs;
  END IF;
END $$;

-- New evidence_logs policies via goal ownership
CREATE POLICY "Users can view own evidence logs"
  ON evidence_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = evidence_logs.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own evidence logs"
  ON evidence_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = evidence_logs.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own evidence logs"
  ON evidence_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = evidence_logs.goal_id
      AND goals.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = evidence_logs.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own evidence logs"
  ON evidence_logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = evidence_logs.goal_id
      AND goals.user_id = auth.uid()
    )
  );

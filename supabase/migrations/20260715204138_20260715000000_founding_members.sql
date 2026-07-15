/*
# Founding member honoring

1. New table
- founding_members: records of pre-launch Stripe purchases from the marketing site,
  written by that site's Stripe webhook via service-role key. email is unique so
  the marketing site can do a clean upsert.

2. Trigger extension
- handle_new_user() now also checks founding_members by email (case-insensitive)
  at signup time. If a match exists and hasn't been redeemed yet, it creates a
  subscriptions row with provider='stripe_founding' and marks the founding_members
  row redeemed, atomically, in the same trigger that already creates the profile.

3. Security
- RLS enabled on founding_members with zero policies — only the service_role key
  (used by the marketing site's webhook) and this SECURITY DEFINER trigger can
  touch it. No anon or authenticated access at all.
*/

CREATE TABLE IF NOT EXISTS founding_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  stripe_customer_id text,
  stripe_subscription_id text,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  redeemed boolean NOT NULL DEFAULT false,
  redeemed_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE founding_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  base_username text;
  final_username text;
  suffix int := 0;
  full_name text;
  fm_record founding_members%ROWTYPE;
BEGIN
  base_username := 'user_' || replace(new.id::text, '-', '');
  final_username := base_username;

  full_name := COALESCE(
    NULLIF(
      TRIM(
        COALESCE(new.raw_user_meta_data->>'first_name', '') || ' ' ||
        COALESCE(new.raw_user_meta_data->>'last_name', '')
      ),
      ''
    ),
    'New User'
  );

  LOOP
    BEGIN
      INSERT INTO profiles (id, username, display_name)
      VALUES (new.id, final_username, full_name)
      ON CONFLICT (id) DO NOTHING;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      suffix := suffix + 1;
      final_username := base_username || '_' || suffix;
    END;
  END LOOP;

  SELECT * INTO fm_record
  FROM founding_members
  WHERE LOWER(email) = LOWER(new.email)
    AND redeemed = false
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO subscriptions (
      user_id, status, plan, provider, provider_subscription_id,
      current_period_start, current_period_end
    ) VALUES (
      new.id, 'active', 'annual', 'stripe_founding', fm_record.stripe_subscription_id,
      fm_record.purchased_at, fm_record.purchased_at + interval '1 year'
    );

    UPDATE founding_members
    SET redeemed = true, redeemed_user_id = new.id, redeemed_at = now()
    WHERE id = fm_record.id;
  END IF;

  RETURN new;
END;
$function$;

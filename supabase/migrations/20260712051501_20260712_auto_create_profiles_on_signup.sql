-- Auto-create a profiles row whenever a new auth user is created.
-- Fixes the root cause of orphaned goals: goals.user_id pointed at
-- auth users with no matching profiles row, so the FK constraint on
-- user_badges (-> profiles.id) silently rejected every badge insert.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    new.id,
    'user_' || substr(new.id::text, 1, 8),
    COALESCE(new.raw_user_meta_data->>'display_name', 'New User')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill any existing auth users that are missing a profiles row.
INSERT INTO profiles (id, username, display_name)
SELECT u.id,
       'user_' || substr(u.id::text, 1, 8),
       COALESCE(u.raw_user_meta_data->>'display_name', 'New User')
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
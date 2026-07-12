-- Drop the old case-sensitive unique constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_key;

-- Drop the old plain index if it exists
DROP INDEX IF EXISTS idx_profiles_username;

-- Create case-insensitive unique index
CREATE UNIQUE INDEX profiles_username_lower_idx ON profiles (LOWER(username));
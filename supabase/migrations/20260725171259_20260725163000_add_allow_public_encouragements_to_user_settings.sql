ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS allow_public_encouragements boolean NOT NULL DEFAULT true;
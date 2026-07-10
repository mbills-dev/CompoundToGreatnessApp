-- Create storage buckets (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('progress-photos', 'progress-photos', true),
  ('profile-photos',  'profile-photos',  true)
ON CONFLICT (id) DO NOTHING;

-- ── progress-photos RLS ──────────────────────────────────────────────────────

-- Public read
CREATE POLICY "progress_photos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'progress-photos');

-- Authenticated insert: path must start with own uid
CREATE POLICY "progress_photos_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated update: own objects only
CREATE POLICY "progress_photos_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated delete: own objects only
CREATE POLICY "progress_photos_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── profile-photos RLS ───────────────────────────────────────────────────────

-- Public read
CREATE POLICY "profile_photos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'profile-photos');

-- Authenticated insert: path must start with own uid
CREATE POLICY "profile_photos_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated update: own objects only
CREATE POLICY "profile_photos_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated delete: own objects only
CREATE POLICY "profile_photos_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

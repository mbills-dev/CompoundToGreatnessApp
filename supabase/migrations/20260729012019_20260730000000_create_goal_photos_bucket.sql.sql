-- Create goal-photos storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('goal-photos', 'goal-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ── goal-photos RLS ───────────────────────────────────────────────────────────

-- Public read (so the edge function can fetch via signed URL or public URL)
CREATE POLICY "goal_photos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'goal-photos');

-- Authenticated insert: path must start with own uid
CREATE POLICY "goal_photos_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'goal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated update: own objects only
CREATE POLICY "goal_photos_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'goal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated delete: own objects only
CREATE POLICY "goal_photos_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'goal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

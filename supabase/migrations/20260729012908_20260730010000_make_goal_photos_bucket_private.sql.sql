-- Switch goal-photos bucket from public to private
UPDATE storage.buckets
SET public = false
WHERE id = 'goal-photos';

-- Remove the old public-read policy (no longer appropriate for a private bucket)
DROP POLICY IF EXISTS "goal_photos_public_read" ON storage.objects;

-- Authenticated read: own objects only (signed URLs bypass RLS at the storage layer,
-- so the edge function can still fetch via the signed URL without this policy)
CREATE POLICY "goal_photos_auth_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'goal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

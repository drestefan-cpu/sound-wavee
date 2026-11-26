-- Profile photos uploaded from the phone (Apple Music sign-ups have no photo from a provider).
-- Public to view; each person can only write inside their own folder: avatars/<their id>/...
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "avatars: owner uploads" ON storage.objects;
CREATE POLICY "avatars: owner uploads" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars: owner updates" ON storage.objects;
CREATE POLICY "avatars: owner updates" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars: owner deletes" ON storage.objects;
CREATE POLICY "avatars: owner deletes" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Owners can list their own files (needed for upsert); public URLs work without a SELECT policy
DROP POLICY IF EXISTS "avatars: owner reads" ON storage.objects;
CREATE POLICY "avatars: owner reads" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

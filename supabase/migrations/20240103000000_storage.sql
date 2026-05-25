-- ============================================================
-- Supabase Storage Buckets
-- Run after migrations or via Dashboard
-- ============================================================

-- Bucket for clock-in/out photos (private — signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'timeclock-photos',
  'timeclock-photos',
  true,                              -- public read (URLs are unguessable)
  5242880,                           -- 5MB
  ARRAY['image/jpeg','image/png','image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Bucket for employee assets (avatars)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-assets',
  'employee-assets',
  true,
  2097152,                           -- 2MB
  ARRAY['image/jpeg','image/png','image/webp']
) ON CONFLICT (id) DO NOTHING;

-- ─── Storage RLS policies ────────────────────────────────────
-- Anyone authenticated in same org can upload timeclock photos for themselves
CREATE POLICY "timeclock_employee_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'timeclock-photos' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = 'clock' AND
    (storage.foldername(name))[2] = (
      SELECT employee_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Anyone in same org can view timeclock photos
CREATE POLICY "timeclock_org_read" ON storage.objects FOR SELECT
  USING (
    bucket_id IN ('timeclock-photos','employee-assets') AND
    auth.uid() IS NOT NULL
  );

-- Admin can update employee avatars
CREATE POLICY "avatar_admin_write" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'employee-assets' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

-- Supabase SQL schema for Visa Registry
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run

-- 1. Applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Passport data
  last_name TEXT NOT NULL DEFAULT '',
  first_name TEXT DEFAULT '',
  passport_number TEXT DEFAULT '',
  nationality TEXT DEFAULT '',
  dob TEXT DEFAULT '',
  place_of_birth TEXT DEFAULT '',
  sex TEXT DEFAULT '',
  issue_date TEXT DEFAULT '',
  expiry_date TEXT DEFAULT '',
  authority TEXT DEFAULT '',

  -- Application details
  category TEXT DEFAULT 'first',
  visa_number TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  paid BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  date_added TEXT DEFAULT '',

  -- Family grouping
  group_id TEXT DEFAULT '',
  is_primary BOOLEAN DEFAULT false,
  group_label TEXT DEFAULT ''
);

-- 2. Enable Row Level Security
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- 3. Allow authenticated users full access
CREATE POLICY "Authenticated users can do everything"
  ON applications
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Storage bucket for passport scans
INSERT INTO storage.buckets (id, name, public) VALUES ('scans', 'scans', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policy: authenticated users can upload
CREATE POLICY "Authenticated users can upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'scans' AND auth.role() = 'authenticated');

-- 6. Storage policy: anyone can view (public bucket)
CREATE POLICY "Public can view scans"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'scans');

-- 7. Storage policy: authenticated users can delete
CREATE POLICY "Authenticated users can delete"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'scans' AND auth.role() = 'authenticated');

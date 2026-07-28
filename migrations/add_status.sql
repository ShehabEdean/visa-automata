-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run

ALTER TABLE applications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

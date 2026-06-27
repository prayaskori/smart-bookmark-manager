-- Supabase Schema Migration: Add new columns to bookmarks table
-- Run this in your Supabase SQL Editor to support the premium features!

ALTER TABLE public.bookmarks 
ADD COLUMN IF NOT EXISTS tag text DEFAULT 'Other',
ADD COLUMN IF NOT EXISTS favicon_url text,
ADD COLUMN IF NOT EXISTS page_title text;

-- Add index on tag for quick filtering
CREATE INDEX IF NOT EXISTS idx_bookmarks_tag ON public.bookmarks(tag);

-- Add AI summary column
ALTER TABLE public.bookmarks ADD COLUMN IF NOT EXISTS ai_summary text;

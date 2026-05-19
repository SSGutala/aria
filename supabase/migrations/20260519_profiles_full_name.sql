-- Add full_name to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

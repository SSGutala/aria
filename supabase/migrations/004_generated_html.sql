-- Add generated_html column to store the custom-generated React app per tool
ALTER TABLE generated_apps ADD COLUMN IF NOT EXISTS generated_html TEXT;

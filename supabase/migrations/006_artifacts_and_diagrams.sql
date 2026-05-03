-- Create artifacts table if it doesn't exist
CREATE TABLE IF NOT EXISTS artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users,
  related_app_id uuid REFERENCES generated_apps ON DELETE SET NULL,
  artifact_type text NOT NULL,
  title text NOT NULL,
  content jsonb DEFAULT '{}',
  raw_content text,
  source_prompt text,
  version integer DEFAULT 1,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'superseded', 'deleted')),
  mermaid_source text,
  file_urls jsonb DEFAULT '{}',
  files_generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add deleted columns to conversations and generated_apps if not already added
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE generated_apps ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false;
ALTER TABLE generated_apps ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add generated_html to generated_apps if missing
ALTER TABLE generated_apps ADD COLUMN IF NOT EXISTS generated_html text;
ALTER TABLE generated_apps ADD COLUMN IF NOT EXISTS slug text;

-- RLS for artifacts
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their artifacts" ON artifacts;
CREATE POLICY "Users see their artifacts" ON artifacts
  FOR ALL USING (
    conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role full access to artifacts" ON artifacts;
-- Service role bypasses RLS automatically

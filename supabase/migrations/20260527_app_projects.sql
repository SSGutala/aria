-- ─────────────────────────────────────────────────────────────────────────────
-- app_projects — real multi-file projects from the new staged generation engine.
--
-- Separate from the legacy `generated_apps` table (which has NOT NULL/CHECK
-- constraints for the old template engine: workflow_type, table_name, schema,
-- slug). This keeps the new engine fully additive and non-breaking.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users,
  title text NOT NULL DEFAULT 'Untitled App',
  source_prompt text,
  app_plan jsonb DEFAULT '{}',          -- the architecture plan from the plan stage
  file_tree jsonb DEFAULT '[]',         -- [{ path, purpose, type }]
  files jsonb DEFAULT '{}',             -- { "/path": "content" } — the project itself
  summary text,                         -- user-facing summary of what was built
  entry text DEFAULT '/App.js',         -- entry file for the preview runtime
  runtime text DEFAULT 'sandpack-react',
  engine text DEFAULT 'staged-pipeline-v1',
  provider_config jsonb DEFAULT '{}',   -- which provider ran each stage
  generation_errors jsonb DEFAULT '[]', -- per-file generation errors, if any
  edit_history jsonb DEFAULT '[]',      -- [{ at, request, changedFiles, summary }]
  validation jsonb DEFAULT '{}',        -- build/validation results (Phase 3+)
  version integer DEFAULT 1,
  status text DEFAULT 'draft' CHECK (status IN ('generating', 'draft', 'ready', 'error', 'deleted')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_projects_conversation_idx ON app_projects (conversation_id);

-- RLS — mirror the artifacts policy: users see projects in their own conversations.
ALTER TABLE app_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their app projects" ON app_projects;
CREATE POLICY "Users see their app projects" ON app_projects
  FOR ALL USING (
    conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );
-- Service role bypasses RLS automatically (used by the server-side generator).

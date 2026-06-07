-- ─────────────────────────────────────────────────────────────────────────────
-- app_projects enhancements: language selection, build checkpointing, downloadable status
-- ─────────────────────────────────────────────────────────────────────────────

-- Add language field (default 'js')
ALTER TABLE app_projects
ADD COLUMN IF NOT EXISTS language text DEFAULT 'js' CHECK (language IN ('js', 'python', 'java', 'html'));

-- Add build checkpoint tracking (stage, progress, partial files)
ALTER TABLE app_projects
ADD COLUMN IF NOT EXISTS build_checkpoint jsonb DEFAULT '{}';

-- Schema: {
--   "lastSuccessfulStage": "codegen",
--   "progress": 65,
--   "timestamp": "2026-06-07T12:34:56Z",
--   "partialFiles": { "/App.js": "..." },
--   "retryCount": 0
-- }

-- Add downloadable flag (true if build succeeded at least once)
ALTER TABLE app_projects
ADD COLUMN IF NOT EXISTS is_downloadable boolean DEFAULT false;

-- Create index on language for quick filtering
CREATE INDEX IF NOT EXISTS app_projects_language_idx ON app_projects (language);

-- Create index on downloadable status
CREATE INDEX IF NOT EXISTS app_projects_downloadable_idx ON app_projects (is_downloadable);

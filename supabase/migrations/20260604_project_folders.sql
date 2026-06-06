-- ─────────────────────────────────────────────────────────────────────────────
-- project_folders — user-defined folders that organize chats and app projects.
--
-- A folder can hold both conversations (chats) and app_projects (apps). Items
-- with a NULL folder_id are "unfiled" and render under Recent Chats / Recent Apps.
-- Fully additive: every column added below is nullable or defaulted, so existing
-- rows and the existing UI keep working if this migration hasn't run yet.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL DEFAULT 'New project',
  pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_folders_user_idx ON project_folders (user_id);

ALTER TABLE project_folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their folders" ON project_folders;
CREATE POLICY "Users manage their folders" ON project_folders
  FOR ALL USING (user_id = auth.uid());

-- ── Membership + pinning columns on the two organizable item types ───────────

-- conversations: folder membership, pin, and a `kind` discriminator so the
-- "New app" flow can create a backing conversation that does NOT show up in the
-- Chats list (kind = 'app' shell), while normal chats stay kind = 'chat'.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES project_folders ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'chat';

-- app_projects: folder membership + pin.
ALTER TABLE app_projects
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES project_folders ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS conversations_folder_idx ON conversations (folder_id);
CREATE INDEX IF NOT EXISTS app_projects_folder_idx ON app_projects (folder_id);

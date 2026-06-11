-- ─────────────────────────────────────────────────────────────────────────────
-- artifacts.folder_id — file generated documents into a project folder (the
-- "Aria drive" for a project). Mirrors conversations.folder_id /
-- app_projects.folder_id: ON DELETE SET NULL un-files docs rather than deleting
-- them when a folder is removed. Fully additive + nullable: existing artifacts
-- get NULL (unfiled) until first filed. The app reads/writes this best-effort,
-- so doc generation keeps working even before this migration is applied.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES project_folders ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS artifacts_folder_idx ON artifacts (folder_id);

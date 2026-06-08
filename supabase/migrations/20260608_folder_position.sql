-- ─────────────────────────────────────────────────────────────────────────────
-- project_folders.position — explicit, user-controlled ordering of folders so the
-- sidebar can support drag-to-reorder. Fully additive + nullable: existing rows
-- get NULL and fall back to created_at ordering until they're first reordered.
-- The app reads/writes this best-effort, so the UI keeps working even if this
-- migration hasn't been applied yet (reorder just won't survive a reload).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE project_folders
  ADD COLUMN IF NOT EXISTS position integer;

CREATE INDEX IF NOT EXISTS project_folders_position_idx ON project_folders (user_id, position);

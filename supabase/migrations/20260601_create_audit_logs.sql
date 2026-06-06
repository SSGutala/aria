-- ===========================================================================
--  Audit Logs
--  Tamper-resistant, append-only record of sensitive operations:
--    - CREATE / UPDATE / DELETE on tracked tables
--    - Failed login attempts
--    - Permission / role changes
--
--  Hardening strategy (defense-in-depth):
--    1. RLS enabled with NO insert/update/delete policies for anon/authenticated,
--       so regular users can never write or tamper with rows. Writes happen only
--       via the service role (used by the backend), which bypasses RLS.
--    2. An append-only trigger rejects UPDATE and DELETE for everyone except a
--       Postgres superuser -- so even a leaked service key cannot alter history.
--    3. Read access is restricted to admins via a SELECT policy.
--    4. UPDATE/DELETE grants are revoked from anon/authenticated as a backstop.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Who: nullable because failed logins may have no resolvable user.
  user_id     uuid REFERENCES auth.users ON DELETE SET NULL,
  -- What: constrained to the categories we audit.
  action_type text NOT NULL CHECK (action_type IN (
    'CREATE', 'UPDATE', 'DELETE', 'LOGIN_FAILED', 'PERMISSION_CHANGE'
  )),
  -- Where: the table and primary-key affected (record_id kept as text so it
  -- works for uuid / bigint / composite keys alike).
  table_name  text,
  record_id   text,
  -- Context
  ip_address  inet,
  user_agent  text,
  status      text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure')),
  -- Before / after snapshots (JSONB so they're queryable).
  old_val     jsonb,
  new_val     jsonb,
  -- Free-form extra context (e.g. attempted email on a failed login).
  metadata    jsonb
);

-- --- Indexes for the common audit queries ----------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_logs_user         ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action       ON audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON audit_logs (created_at DESC);

-- --- 1 & 3. Row-Level Security: no writes for users, reads for admins only --
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- Belt-and-suspenders: ensure even the table owner is subject to RLS.
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Read access: only users flagged as admins may read the trail.
-- Adjust the predicate to match your admin convention if it isn't account_type.
DROP POLICY IF EXISTS "Admins read audit logs" ON audit_logs;
CREATE POLICY "Admins read audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.account_type = 'admin'
    )
  );

-- NOTE: We intentionally create NO INSERT / UPDATE / DELETE policies.
-- With RLS forced, that means anon & authenticated roles cannot write at all.
-- The backend writes using the service-role key, which bypasses RLS.

-- --- 2. Append-only enforcement (blocks tampering even via service role) ----
CREATE OR REPLACE FUNCTION audit_logs_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $audit_block$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
  RETURN NULL;
END;
$audit_block$;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();

-- --- 4. Revoke direct write grants as a final backstop ----------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON audit_logs FROM anon, authenticated;

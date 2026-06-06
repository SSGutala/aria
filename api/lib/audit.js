/**
 * Aria Audit Logger
 *
 * Persists a tamper-resistant trail of sensitive operations to the
 * `audit_logs` table (see supabase/migrations/20260601_audit_logs.sql).
 *
 * What to record:
 *   - CREATE / UPDATE / DELETE on tracked tables
 *   - Failed login attempts (LOGIN_FAILED)
 *   - Permission / role changes (PERMISSION_CHANGE)
 *
 * Design notes:
 *   - Writes use the Supabase service-role key, which bypasses RLS. Regular
 *     users can never insert/alter audit rows (RLS + append-only trigger).
 *   - recordAudit() is fire-and-forget and NEVER throws — auditing must not
 *     break the business operation it's observing. Failures are surfaced via
 *     devlogError so they're still visible to developers.
 *
 * Usage (direct import, same pattern as devlog):
 *   import { recordAudit, AUDIT } from './lib/audit.js'
 *   await recordAudit({ req, userId, action: AUDIT.DELETE,
 *                       table: 'artifacts', recordId: id, oldVal: row })
 *
 * Usage (middleware — attaches req.audit and auto-resolves userId from JWT):
 *   import { auditMiddleware } from './api/lib/audit.js'
 *   app.use(auditMiddleware())
 *   // then inside any handler: await req.audit({ action: AUDIT.UPDATE, ... })
 */

import { createClient } from '@supabase/supabase-js'
import { devlog, devlogError } from './devlog.js'

export const AUDIT = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY

// Lazy singleton — avoids creating a client per request (mirrors getSupabase()).
let _client = null
function client() {
  if (_client) return _client
  _client = createClient(SUPABASE_URL, SERVICE_KEY)
  return _client
}

/**
 * Best-effort client IP extraction. Honors the first hop in X-Forwarded-For
 * (Render/Netlify/proxies sit in front of this server) and falls back to the
 * socket address. Returns null if nothing usable — `inet` accepts null.
 */
export function getClientIp(req) {
  if (!req) return null
  const xff = req.headers?.['x-forwarded-for']
  if (xff) {
    const first = String(xff).split(',')[0].trim()
    if (first) return first
  }
  return req.ip || req.socket?.remoteAddress || null
}

/**
 * Resolve the acting user's id from the Authorization: Bearer <jwt> header.
 * Returns null if there's no valid session (e.g. anonymous/public routes).
 * Never throws.
 */
export async function resolveUserId(req) {
  try {
    const authHeader = req?.headers?.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return null
    const { data, error } = await client().auth.getUser(token)
    if (error || !data?.user) return null
    return data.user.id
  } catch {
    return null
  }
}

/**
 * Write a single audit entry. Fire-and-forget; resolves to true/false but
 * never rejects.
 *
 * @param {object}  opts
 * @param {object}  [opts.req]       Express request — used for ip + user-agent.
 * @param {string}  [opts.userId]    Acting user id. If omitted and `req` is
 *                                   given, it's resolved from the JWT.
 * @param {string}   opts.action     One of AUDIT.* (action_type).
 * @param {string}  [opts.table]     Affected table name.
 * @param {string|number} [opts.recordId] Affected primary key.
 * @param {object}  [opts.oldVal]    Snapshot before the change.
 * @param {object}  [opts.newVal]    Snapshot after the change.
 * @param {'success'|'failure'} [opts.status='success']
 * @param {object}  [opts.metadata]  Extra context (e.g. attempted email).
 */
export async function recordAudit({
  req = null,
  userId = undefined,
  action,
  table = null,
  recordId = null,
  oldVal = null,
  newVal = null,
  status = 'success',
  metadata = null,
} = {}) {
  try {
    if (!action) {
      devlogError('audit.missing_action', { table })
      return false
    }

    const resolvedUserId =
      userId !== undefined ? userId : req ? await resolveUserId(req) : null

    const row = {
      user_id: resolvedUserId || null,
      action_type: action,
      table_name: table,
      record_id: recordId != null ? String(recordId) : null,
      ip_address: getClientIp(req),
      user_agent: req?.headers?.['user-agent'] || null,
      status,
      old_val: oldVal,
      new_val: newVal,
      metadata,
    }

    const { error } = await client().from('audit_logs').insert(row)
    if (error) {
      devlogError('audit.write_failed', { action, table, recordId: row.record_id, error: error.message })
      return false
    }

    devlog('audit.recorded', { action, table, recordId: row.record_id, userId: row.user_id, status })
    return true
  } catch (err) {
    devlogError('audit.write_exception', { action, table, error: err.message })
    return false
  }
}

/**
 * Express middleware that attaches a bound `req.audit(opts)` helper to every
 * request, so handlers can audit without importing anything. The acting user
 * is resolved lazily from the JWT unless you pass an explicit userId.
 */
export function auditMiddleware() {
  return (req, _res, next) => {
    req.audit = (opts = {}) => recordAudit({ req, ...opts })
    next()
  }
}

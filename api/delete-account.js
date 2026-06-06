/**
 * /api/delete-account — Permanently delete the authenticated user.
 *
 * Flow:
 *   1. Verify the caller's JWT (Authorization: Bearer <token>) to resolve userId.
 *   2. Delete the user's rows from public.conversations (cascades to messages,
 *      artifacts, and other conversation-scoped tables via existing FKs).
 *   3. Delete the user's profile row.
 *   4. Delete the auth.users row via the Supabase admin API.
 *
 * This is irreversible.
 */

import { createClient } from '@supabase/supabase-js'
import { devlog, devlogError } from './lib/devlog.js'
import { recordAudit, AUDIT } from './lib/audit.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

// Admin client (service role) — required to delete auth users.
const admin = createClient(SUPABASE_URL, SERVICE_KEY || ANON_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // ── 1. Resolve userId from the caller's JWT ──────────────────────────────
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' })

    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid or expired session' })
    const userId = userData.user.id

    // ── 2. Confirmation phrase guard (defense-in-depth alongside UI) ─────────
    const { confirmation } = req.body || {}
    if (typeof confirmation !== 'string' || confirmation.trim().toLowerCase() !== 'delete') {
      return res.status(400).json({ error: 'Confirmation phrase missing or incorrect' })
    }

    // ── 3. Delete user's public-schema data ──────────────────────────────────
    // conversations.id cascades to messages/artifacts via existing FKs.
    const { error: convErr } = await admin.from('conversations').delete().eq('user_id', userId)
    if (convErr) devlogError('delete_account.conversations_failed', { userId, error: convErr.message })

    // Profile row (also cascades from auth.users, but explicit is fine)
    const { error: profErr } = await admin.from('profiles').delete().eq('id', userId)
    if (profErr) devlogError('delete_account.profile_failed', { userId, error: profErr.message })

    // ── 4. Delete the auth user (irreversible) ───────────────────────────────
    if (!SERVICE_KEY) {
      return res.status(500).json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY — cannot delete auth user' })
    }
    const { error: authErr } = await admin.auth.admin.deleteUser(userId)
    if (authErr) {
      devlogError('delete_account.auth_delete_failed', { userId, error: authErr.message })
      return res.status(500).json({ error: `Auth deletion failed: ${authErr.message}` })
    }

    devlog('delete_account.success', { userId })

    // userId is passed explicitly because the auth.users row is now gone —
    // resolving it from the (revoked) JWT afterwards would yield null.
    recordAudit({
      req,
      userId,
      action: AUDIT.DELETE,
      table: 'auth.users',
      recordId: userId,
      metadata: { reason: 'user_requested_account_deletion' },
    })

    return res.json({ ok: true })
  } catch (err) {
    devlogError('delete_account.unexpected_error', { error: err.message })
    return res.status(500).json({ error: err.message })
  }
}

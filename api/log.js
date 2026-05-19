/**
 * POST /api/log — receives frontend action events and logs them to terminal.
 * Fire-and-forget from the browser. Never blocks UI.
 */
import { devlog, devlogError } from './lib/devlog.js'

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { event, metadata = {}, failed = false } = req.body || {}
  if (!event) return res.status(400).json({ error: 'event required' })
  if (failed) {
    devlogError(event, metadata)
  } else {
    devlog(event, metadata)
  }
  res.json({ ok: true })
}

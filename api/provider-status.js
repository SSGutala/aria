/**
 * GET /api/provider-status
 *
 * Returns live token usage, current active provider, rate-limit proximity,
 * and any new provider-switch events since the client's last poll.
 *
 * Query param: ?since=<timestamp_ms>  — returns only switch events after this
 */

import { getStatus } from './lib/tokenTracker.js'

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const since = req.query.since ? Number(req.query.since) : null
  const status = getStatus(since)

  res.setHeader('Cache-Control', 'no-store')
  return res.json(status)
}

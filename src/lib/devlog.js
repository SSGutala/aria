/**
 * Frontend action logger — fires events to /api/log (fire-and-forget).
 * Never throws, never blocks. Safe to call anywhere.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function fire(event, metadata, failed = false) {
  try {
    fetch(`${API_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, metadata, failed }),
    }).catch(() => {})
  } catch {}
}

export const logAction = (event, metadata = {}) => fire(event, metadata, false)
export const logFailed = (event, metadata = {}) => fire(event, metadata, true)

/**
 * Provider health + automatic failover for the app-generation engine.
 *
 * Policy (set by the user):
 *   - Primary: Gemini (generous free tier). Fallbacks: Groq, Claude, Ollama.
 *   - When the active cloud provider is rate-limited / out of quota, switch to
 *     the next in the chain automatically.
 *   - When ALL cloud providers are exhausted, fall back to local Ollama for the
 *     duration — and make it a PRIORITY to switch back to the first available
 *     cloud provider the moment it resets.
 *
 * How the "timer" works: when a provider returns a rate-limit / quota error, we
 * record a cooldown-until timestamp (parsed from the provider's own "try again
 * in …" hint when present) and arm a one-shot timer that logs the recovery. All
 * provider selection reads these timestamps live, so the instant a cooldown
 * expires the provider re-enters the candidate list ahead of Ollama — i.e. the
 * switch-back happens on the very next call with zero manual intervention.
 *
 * State is in-memory (per server process), which is the right scope for a
 * single-node localhost dev server.
 */

import { devlog, devlogError } from './devlog.js'

export const CLOUD_PROVIDERS = ['gemini', 'groq', 'claude']

// provider -> { until: epochMs, reason, timer }
const cooldowns = Object.create(null)

const CREDITS_COOLDOWN_MS = 30 * 60 * 1000 // credit exhaustion doesn't reset on a short timer
const DAILY_COOLDOWN_MS = 15 * 60 * 1000   // per-day limit with no parseable hint
const DEFAULT_COOLDOWN_MS = 60 * 1000      // per-minute limit fallback

/** True when an error is a rate-limit / quota / credits exhaustion (i.e. failover-worthy). */
export function isRateLimitError(err) {
  if (!err) return false
  const status = err.status || err.statusCode
  if (status === 429) return true
  const msg = String(err.message || '')
  return /rate[ _-]?limit|rate_limit_exceeded|too many requests|quota|tokens per day|\bTPD\b|requests per day|\bRPD\b|Both Anthropic and Groq failed|credit balance|insufficient.*credit|billing|low to access/i.test(msg)
}

function isCreditsError(err) {
  const msg = String(err?.message || '')
  return /credit balance|insufficient.*credit|billing|low to access/i.test(msg)
}

/** Parse how long to cool a provider down, honoring the provider's own hint when present. */
function cooldownMsFor(err) {
  const msg = String(err?.message || '')
  // Groq/Anthropic style: "Please try again in 1h13m31.584s" / "32m11.904s" / "11.9s"
  const m = msg.match(/try again in (?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*([\d.]+)\s*s/i)
  if (m && (m[1] || m[2] || m[3])) {
    const hrs = m[1] ? parseInt(m[1], 10) : 0
    const mins = m[2] ? parseInt(m[2], 10) : 0
    const secs = parseFloat(m[3]) || 0
    return Math.ceil((hrs * 3600 + mins * 60 + secs) * 1000) + 1000
  }
  // Standard Retry-After header (seconds), if the SDK surfaced it on the error.
  const ra = err?.headers?.['retry-after'] || err?.response?.headers?.['retry-after']
  if (ra != null) {
    const s = parseFloat(ra)
    if (!Number.isNaN(s)) return Math.ceil(s * 1000) + 1000
  }
  if (isCreditsError(err)) return CREDITS_COOLDOWN_MS
  if (/per day|\bTPD\b|\bRPD\b|daily/i.test(msg)) return DAILY_COOLDOWN_MS
  return DEFAULT_COOLDOWN_MS
}

/** Mark a cloud provider as cooling down after a rate-limit error, and arm the recovery timer. */
export function markCoolingDown(provider, err) {
  if (!CLOUD_PROVIDERS.includes(provider)) return
  const ms = cooldownMsFor(err)
  const until = Date.now() + ms
  const prev = cooldowns[provider]
  if (prev?.timer) clearTimeout(prev.timer)
  const timer = setTimeout(() => {
    delete cooldowns[provider]
    devlog('provider.recovered', { provider, note: 'cooldown elapsed — eligible again (priority over Ollama)' })
  }, ms)
  if (timer.unref) timer.unref() // don't keep the process alive just for this
  cooldowns[provider] = { until, reason: isCreditsError(err) ? 'credits' : 'rate_limit', timer }
  devlogError('provider.cooldown', {
    provider,
    reason: cooldowns[provider].reason,
    cooldownMs: ms,
    resumesAt: new Date(until).toISOString(),
  })
}

/** Clear cooldown after a successful call (the provider is demonstrably healthy). */
export function markHealthy(provider) {
  const c = cooldowns[provider]
  if (c) {
    if (c.timer) clearTimeout(c.timer)
    delete cooldowns[provider]
  }
}

export function isCoolingDown(provider) {
  const c = cooldowns[provider]
  if (!c) return false
  if (Date.now() >= c.until) { // lazily expire even if the timer hasn't fired
    if (c.timer) clearTimeout(c.timer)
    delete cooldowns[provider]
    return false
  }
  return true
}

export function msUntilAvailable(provider) {
  const c = cooldowns[provider]
  return c ? Math.max(0, c.until - Date.now()) : 0
}

/**
 * Build the ordered list of providers to try for one generation call.
 *
 *   - If the caller explicitly wants Ollama, honor it (local, no quota).
 *   - Otherwise prefer the requested cloud provider, falling back through the chain:
 *     Gemini (primary) → Groq → Claude, skipping any that are currently cooling down.
 *   - Ollama is appended as the final safety net. If ALL cloud providers are
 *     cooling down, Ollama is the only candidate — until a cloud cooldown
 *     expires, at which point that provider re-appears here automatically.
 */
export function buildFailoverChain(preferred) {
  if (preferred === 'ollama') return ['ollama']
  // Determine the base order (default is Gemini first)
  let ordered = ['gemini', 'groq', 'claude']
  if (preferred === 'groq') {
    ordered = ['groq', 'gemini', 'claude']
  } else if (preferred === 'claude') {
    ordered = ['claude', 'gemini', 'groq']
  }
  const available = ordered.filter((p) => !isCoolingDown(p))
  if (available.length) return [...available, 'ollama']
  return ['ollama'] // all cloud providers exhausted — bridge on local Ollama
}

/** Snapshot for telemetry / UI (e.g. GET /api/provider-health). */
export function getProviderHealth() {
  const now = Date.now()
  const providers = {}
  for (const p of CLOUD_PROVIDERS) {
    const c = cooldowns[p]
    const cooling = isCoolingDown(p)
    providers[p] = {
      available: !cooling,
      coolingDown: cooling,
      reason: cooling ? c?.reason : null,
      resumesInSec: cooling ? Math.ceil((c.until - now) / 1000) : 0,
      resumesAt: cooling ? new Date(c.until).toISOString() : null,
    }
  }
  // The provider the next call would actually use (default to gemini-first chain).
  const active = buildFailoverChain('gemini')[0]
  return { active, providers }
}

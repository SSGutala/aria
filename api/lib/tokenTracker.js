/**
 * tokenTracker.js — Real-time token usage tracking + provider switch events.
 *
 * Accumulates token counts from every AI call across all providers.
 * Exposes usage totals and switch history so the frontend can show
 * a live "X / Y tokens used" counter and a toast on provider switch.
 *
 * Provider limits (free / default tier):
 *   Gemini 2.5 Flash  – 1,000,000 tokens/min, 500 req/day (free)
 *   Gemini 2.5 Pro    – 25,000 tokens/min (free)
 *   Groq Llama 3.3    – 6,000 tokens/min, 14,400 req/day
 *   Claude Sonnet     – rate-limited by credits
 */

const PROVIDER_LIMITS = {
  gemini: {
    label: 'Gemini',
    minuteLimit: 1_000_000,  // Flash free tier
    dayLimit: null,           // effectively unlimited for dev
    color: '#1A73E8',
  },
  'gemini-pro': {
    label: 'Gemini Pro',
    minuteLimit: 25_000,
    dayLimit: null,
    color: '#1A73E8',
  },
  groq: {
    label: 'Groq',
    minuteLimit: 6_000,
    dayLimit: 500_000,
    color: '#2563EB',
  },
  claude: {
    label: 'Claude',
    minuteLimit: null,        // credit-based
    dayLimit: null,
    color: '#D97706',
  },
  ollama: {
    label: 'Ollama',
    minuteLimit: null,        // local, no limit
    dayLimit: null,
    color: '#737373',
  },
}

// Rolling per-minute window + cumulative session totals
const state = {
  currentProvider: process.env.APP_ENGINE_PROVIDER || 'gemini',
  sessionStart: Date.now(),

  // Per-provider session totals
  usage: {
    gemini: { inputTokens: 0, outputTokens: 0, calls: 0 },
    groq:   { inputTokens: 0, outputTokens: 0, calls: 0 },
    claude: { inputTokens: 0, outputTokens: 0, calls: 0 },
    ollama: { inputTokens: 0, outputTokens: 0, calls: 0 },
  },

  // Sliding 60s window for rate-limit awareness
  minuteWindow: [],   // [{ provider, tokens, at }]

  // Last N switch events for the frontend toast queue
  switchEvents: [],   // [{ at, from, to, reason }]
  lastSwitchSeenAt: null,
}

/** Record a completed AI call's token usage. */
export function trackUsage(provider, { inputTokens = 0, outputTokens = 0 } = {}) {
  const key = provider === 'gemini-pro' ? 'gemini' : (provider || 'gemini')
  if (!state.usage[key]) state.usage[key] = { inputTokens: 0, outputTokens: 0, calls: 0 }

  state.usage[key].inputTokens  += inputTokens
  state.usage[key].outputTokens += outputTokens
  state.usage[key].calls        += 1

  // Sliding minute window
  const total = inputTokens + outputTokens
  if (total > 0) {
    state.minuteWindow.push({ provider: key, tokens: total, at: Date.now() })
  }

  // Prune window to last 60s
  const cutoff = Date.now() - 60_000
  state.minuteWindow = state.minuteWindow.filter(e => e.at >= cutoff)
}

/** Record a provider switch (called from modelRouter when failover happens). */
export function trackSwitch(from, to, reason = 'rate_limit') {
  state.currentProvider = to
  const event = { at: Date.now(), from, to, reason }
  state.switchEvents.push(event)
  // Keep only last 20 switch events
  if (state.switchEvents.length > 20) state.switchEvents.shift()
}

/** Update current active provider (called when a call succeeds). */
export function setCurrentProvider(provider) {
  state.currentProvider = provider === 'gemini-pro' ? 'gemini' : provider
}

/** Get unseen switch events since the frontend last polled. */
function getNewSwitchEvents(since) {
  if (!since) return state.switchEvents.slice(-3)
  return state.switchEvents.filter(e => e.at > since)
}

/** Tokens used in the last 60 seconds per provider. */
function minuteTokensPerProvider() {
  const cutoff = Date.now() - 60_000
  const fresh = state.minuteWindow.filter(e => e.at >= cutoff)
  const map = {}
  for (const e of fresh) {
    map[e.provider] = (map[e.provider] || 0) + e.tokens
  }
  return map
}

/** Full status snapshot for /api/provider-status. */
export function getStatus(since = null) {
  const minuteUsage = minuteTokensPerProvider()
  const limits = PROVIDER_LIMITS

  // Build per-provider status
  const providers = {}
  for (const [key, limit] of Object.entries(limits)) {
    if (key === 'gemini-pro') continue
    const usage = state.usage[key] || { inputTokens: 0, outputTokens: 0, calls: 0 }
    const tokensThisMinute = minuteUsage[key] || 0
    const minuteLimit = limit.minuteLimit

    providers[key] = {
      label:            limit.label,
      color:            limit.color,
      active:           state.currentProvider === key,
      calls:            usage.calls,
      sessionInputs:    usage.inputTokens,
      sessionOutputs:   usage.outputTokens,
      sessionTotal:     usage.inputTokens + usage.outputTokens,
      tokensThisMinute,
      minuteLimit,
      minutePercent:    minuteLimit ? Math.round((tokensThisMinute / minuteLimit) * 100) : null,
      // Warning thresholds
      nearLimit:        minuteLimit ? tokensThisMinute > minuteLimit * 0.75 : false,
      atLimit:          minuteLimit ? tokensThisMinute >= minuteLimit * 0.95 : false,
    }
  }

  // Grand total across all providers
  const totals = Object.values(state.usage).reduce(
    (acc, u) => ({ inputs: acc.inputs + u.inputTokens, outputs: acc.outputs + u.outputTokens, calls: acc.calls + u.calls }),
    { inputs: 0, outputs: 0, calls: 0 }
  )

  return {
    currentProvider: state.currentProvider,
    sessionStart:    state.sessionStart,
    providers,
    totals,
    newSwitchEvents: getNewSwitchEvents(since),
    timestamp: Date.now(),
  }
}

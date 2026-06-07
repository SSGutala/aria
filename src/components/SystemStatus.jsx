import React, { useEffect, useState, useRef, useCallback } from 'react'

/**
 * SystemStatus — live AI provider indicator + token usage counter.
 *
 * Polls /api/provider-status every 15s (instantly on mount).
 * Shows:
 *   • Green/amber/red connection dot
 *   • Active provider name (live — updates on switch)
 *   • Tokens used this session / rate-limit bar
 *   • Toast popup when provider switches due to rate limits
 */

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const POLL_MS = 15_000

const PROVIDER_META = {
  gemini: { label: 'Gemini', color: '#1A73E8', bg: '#0D1B2A' },
  groq:   { label: 'Groq',   color: '#2563EB', bg: '#0D1226' },
  claude: { label: 'Claude', color: '#D97706', bg: '#1C1100' },
  ollama: { label: 'Ollama', color: '#737373', bg: '#141414' },
}

function fmt(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function StatusDot({ state }) {
  const color = state === 'error' ? '#F87171' : state === 'running' ? '#FBBF24' : '#34D399'
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}88` }} />
      {state === 'running' && (
        <span style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: color, opacity: 0.18, animation: 'aria-pulse 1.2s ease-in-out infinite' }} />
      )}
    </span>
  )
}

// Floating toast for provider switch
function SwitchToast({ event, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const fromMeta = PROVIDER_META[event.from] || { label: event.from, color: '#737373' }
  const toMeta   = PROVIDER_META[event.to]   || { label: event.to,   color: '#737373' }

  return (
    <div style={{
      position: 'fixed', top: 56, right: 16, zIndex: 9999,
      background: '#1A1A1A', border: '0.5px solid #333', borderRadius: 10,
      padding: '12px 16px', maxWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', gap: 6,
      animation: 'slideInRight 0.25s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#E5E5E5', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          ⚡ Provider Switch
        </span>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#525252', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ fontSize: 12, color: '#A3A3A3', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: fromMeta.color, fontWeight: 600 }}>{fromMeta.label}</span>
        <span style={{ color: '#525252' }}>→</span>
        <span style={{ color: toMeta.color, fontWeight: 600 }}>{toMeta.label}</span>
      </div>
      <div style={{ fontSize: 11, color: '#737373' }}>
        {event.reason === 'rate_limit'
          ? `${fromMeta.label} hit a rate limit. Switched to ${toMeta.label} automatically. Will switch back when ${fromMeta.label} cools down.`
          : `Switched to ${toMeta.label} (${event.reason}).`}
      </div>
    </div>
  )
}

export default function SystemStatus({ isRunning, phaseLabel, lastError, lastLatencyMs }) {
  const [status, setStatus] = useState(null)
  const [toasts, setToasts] = useState([])
  const [elapsed, setElapsed] = useState(0)
  const lastPollRef = useRef(null)
  const pollTimerRef = useRef(null)

  // Track elapsed time while running
  useEffect(() => {
    if (!isRunning) { setElapsed(0); return }
    const start = Date.now()
    const interval = setInterval(() => setElapsed(Date.now() - start), 200)
    return () => clearInterval(interval)
  }, [isRunning, phaseLabel])

  const poll = useCallback(async () => {
    try {
      const since = lastPollRef.current || null
      const url = `${API}/api/provider-status${since ? `?since=${since}` : ''}`
      const res = await fetch(url)
      if (!res.ok) return
      const data = await res.json()
      setStatus(data)
      lastPollRef.current = data.timestamp

      // Show toasts for any new switch events
      if (data.newSwitchEvents?.length) {
        setToasts(prev => [
          ...prev,
          ...data.newSwitchEvents.map(e => ({ ...e, id: `${e.at}-${e.from}-${e.to}` }))
        ])
      }
    } catch { /* network error — silently ignore */ }
  }, [])

  useEffect(() => {
    poll()
    pollTimerRef.current = setInterval(poll, POLL_MS)
    return () => clearInterval(pollTimerRef.current)
  }, [poll])

  // Poll immediately when a generation starts or ends
  useEffect(() => { poll() }, [isRunning, poll])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const dotState = lastError ? 'error' : isRunning ? 'running' : 'idle'
  const currentProvider = status?.currentProvider || (import.meta.env.VITE_DEFAULT_AI_MODEL || 'gemini')
  const meta = PROVIDER_META[currentProvider] || { label: currentProvider, color: '#737373', bg: '#141414' }
  const providerStatus = status?.providers?.[currentProvider]
  const sessionTotal = providerStatus?.sessionTotal || 0
  const minuteTokens = providerStatus?.tokensThisMinute || 0
  const minuteLimit = providerStatus?.minuteLimit
  const nearLimit = providerStatus?.nearLimit
  const atLimit = providerStatus?.atLimit

  return (
    <>
      <style>{`
        @keyframes aria-pulse { 0%, 100% { transform: scale(1); opacity: 0.18 } 50% { transform: scale(1.5); opacity: 0 } }
        @keyframes slideInRight { from { transform: translateX(20px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      `}</style>

      {/* Switch toasts */}
      {toasts.map(t => (
        <SwitchToast key={t.id} event={t} onDismiss={() => dismissToast(t.id)} />
      ))}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 10px', height: 26,
        background: '#0F0F0F', border: '0.5px solid #1F1F1F', borderRadius: 6,
        fontFamily: 'inherit', fontSize: 10, color: '#737373',
        letterSpacing: 0.3, whiteSpace: 'nowrap',
      }}>
        <StatusDot state={dotState} />

        {/* Provider dot + label */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: atLimit ? '#F87171' : nearLimit ? '#FBBF24' : meta.color }} />
          <span style={{ color: '#A3A3A3', textTransform: 'uppercase', fontWeight: 600 }}>
            {meta.label}
          </span>
        </span>

        {/* Token counter: session total */}
        <span style={{ color: '#2A2A2A' }}>·</span>
        <span
          title={`Session: ${fmt(sessionTotal)} tokens\nThis minute: ${fmt(minuteTokens)}${minuteLimit ? ` / ${fmt(minuteLimit)}` : ''}`}
          style={{ color: atLimit ? '#F87171' : nearLimit ? '#FBBF24' : '#525252', fontVariantNumeric: 'tabular-nums', cursor: 'default' }}
        >
          {fmt(sessionTotal)}
          {minuteLimit && (
            <span style={{ color: atLimit ? '#F87171' : nearLimit ? '#FBBF24' : '#3A3A3A' }}>
              {' '}· {fmt(minuteTokens)}/{fmt(minuteLimit)}
            </span>
          )}
        </span>

        {/* Rate-limit bar (only when approaching limit) */}
        {minuteLimit && minuteTokens > 0 && (
          <>
            <span style={{ color: '#1A1A1A' }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{
                width: 40, height: 3, borderRadius: 2, background: '#1A1A1A', overflow: 'hidden', display: 'inline-block',
              }}>
                <span style={{
                  display: 'block', height: '100%', borderRadius: 2,
                  width: `${Math.min(100, Math.round((minuteTokens / minuteLimit) * 100))}%`,
                  background: atLimit ? '#F87171' : nearLimit ? '#FBBF24' : meta.color,
                  transition: 'width 0.5s ease',
                }} />
              </span>
            </span>
          </>
        )}

        {/* Running phase */}
        {isRunning && (
          <>
            <span style={{ color: '#2A2A2A' }}>·</span>
            <span style={{ color: '#FBBF24' }}>
              {phaseLabel || 'Working'}
              <span style={{ color: '#525252', marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>
                {(elapsed / 1000).toFixed(1)}s
              </span>
            </span>
          </>
        )}

        {/* Latency (idle) */}
        {!isRunning && lastLatencyMs != null && (
          <>
            <span style={{ color: '#2A2A2A' }}>·</span>
            <span style={{ color: '#525252', fontVariantNumeric: 'tabular-nums' }}>
              {lastLatencyMs < 1000 ? `${Math.round(lastLatencyMs)}ms` : `${(lastLatencyMs / 1000).toFixed(1)}s`}
            </span>
          </>
        )}

        {/* Error */}
        {!isRunning && lastError && (
          <>
            <span style={{ color: '#2A2A2A' }}>·</span>
            <span style={{ color: '#F87171' }} title={lastError}>FAULT</span>
          </>
        )}
      </div>
    </>
  )
}

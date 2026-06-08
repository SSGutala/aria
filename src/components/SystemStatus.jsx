import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useToast } from '../contexts/ToastContext'

/**
 * SystemStatus — live AI provider indicator + token usage counter.
 *
 * Polls /api/provider-status every 15s (instantly on mount).
 * Shows:
 *   • Green/amber/red connection dot
 *   • Active provider name (live — updates on switch)
 *   • Tokens used this session / rate-limit bar
 *   • Provider-switch notifications — routed through the shared macOS-style
 *     toast system (slide in + out, dismissable) so every notification in the
 *     app behaves identically.
 */

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const POLL_MS = 15_000

const PROVIDER_META = {
  gemini: { label: 'Gemini', color: '#1A73E8', bg: '#0D1B2A' },
  groq:   { label: 'Groq',   color: '#2563EB', bg: '#0D1226' },
  claude: { label: 'Claude', color: '#D97706', bg: '#1C1100' },
  ollama: { label: 'Ollama', color: '#737373', bg: '#141414' },
}

// The providers the user can choose to prefer. Aria tries the chosen one first;
// automatic failover still kicks in if it's rate-limited.
const MODEL_OPTIONS = [
  { id: 'gemini', label: 'Gemini',         desc: 'Google · free tier · fast (default)' },
  { id: 'groq',   label: 'Groq',           desc: 'Llama 3 · free · very fast, tighter limit' },
  { id: 'claude', label: 'Claude',         desc: 'Anthropic · needs API credits' },
  { id: 'ollama', label: 'Ollama (Local)', desc: 'Runs on your machine · no limits' },
]

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

export default function SystemStatus({ isRunning, phaseLabel, lastError, lastLatencyMs, currentModel, onModelChange, lockModel, onLockChange }) {
  const toast = useToast()
  const [status, setStatus] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const lastPollRef = useRef(null)
  const pollTimerRef = useRef(null)
  const pickerRef = useRef(null)

  // Close the model picker on outside click / Escape.
  useEffect(() => {
    if (!pickerOpen) return
    const onDown = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setPickerOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [pickerOpen])

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

      // Surface any new provider-switch events through the shared macOS-style
      // toast system (slide in + out, dismissable) — same as every other
      // notification in the app.
      if (data.newSwitchEvents?.length) {
        for (const e of data.newSwitchEvents) {
          const fromLabel = (PROVIDER_META[e.from] || {}).label || e.from
          const toLabel = (PROVIDER_META[e.to] || {}).label || e.to
          const message = e.reason === 'rate_limit'
            ? `${fromLabel} hit a rate limit, so Aria switched to ${toLabel} automatically. It'll switch back when ${fromLabel} cools down.`
            : `Switched to ${toLabel}${e.reason ? ` (${e.reason})` : ''}.`
          toast.warning(message, { title: `Switched ${fromLabel} → ${toLabel}`, duration: 7000 })
        }
      }
    } catch { /* network error — silently ignore */ }
  }, [toast])

  useEffect(() => {
    poll()
    pollTimerRef.current = setInterval(poll, POLL_MS)
    return () => clearInterval(pollTimerRef.current)
  }, [poll])

  // Poll immediately when a generation starts or ends
  useEffect(() => { poll() }, [isRunning, poll])

  const dotState = lastError ? 'error' : isRunning ? 'running' : 'idle'
  // The provider Aria is actually running on right now (reported by the server
  // after each call — may differ from the user's pick only during failover).
  const currentProvider = status?.currentProvider || (import.meta.env.VITE_DEFAULT_AI_MODEL || 'gemini')
  // What the user selected — this is what the top tag shows, so the change is
  // reflected the instant they pick it (no waiting for the next poll).
  const preferred = currentModel || 'gemini'
  const canPick = typeof onModelChange === 'function'
  const meta = PROVIDER_META[preferred] || { label: preferred, color: '#737373', bg: '#141414' }
  // Token/limit stats follow the selected provider so the counter matches the tag.
  const providerStatus = status?.providers?.[preferred]
  const sessionTotal = providerStatus?.sessionTotal || 0
  const minuteTokens = providerStatus?.tokensThisMinute || 0
  const minuteLimit = providerStatus?.minuteLimit
  const nearLimit = providerStatus?.nearLimit
  const atLimit = providerStatus?.atLimit

  return (
    <>
      <style>{`
        @keyframes aria-pulse { 0%, 100% { transform: scale(1); opacity: 0.18 } 50% { transform: scale(1.5); opacity: 0 } }
      `}</style>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 10px', height: 26,
        background: '#0F0F0F', border: '0.5px solid #1F1F1F', borderRadius: 6,
        fontFamily: 'inherit', fontSize: 10, color: '#737373',
        letterSpacing: 0.3, whiteSpace: 'nowrap',
      }}>
        <StatusDot state={dotState} />

        {/* Provider dot + label — click to switch the preferred model */}
        <span ref={pickerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <button
            onClick={() => canPick && setPickerOpen(o => !o)}
            disabled={!canPick}
            title={canPick ? 'Click to switch the preferred model' : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: pickerOpen ? '#1A1A1A' : 'transparent', border: '0.5px solid',
              borderColor: pickerOpen ? '#2E2E2E' : 'transparent', borderRadius: 5,
              padding: '2px 5px', margin: '-2px 0', cursor: canPick ? 'pointer' : 'default',
              fontFamily: 'inherit', fontSize: 10, letterSpacing: 0.3, color: '#A3A3A3',
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: atLimit ? '#F87171' : nearLimit ? '#FBBF24' : meta.color }} />
            <span style={{ color: '#A3A3A3', textTransform: 'uppercase', fontWeight: 600 }}>
              {meta.label}
            </span>
            {canPick && (
              <span style={{ color: '#525252', fontSize: 8, marginLeft: 1, transform: pickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
            )}
          </button>

          {pickerOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 9999,
              minWidth: 220, maxWidth: 'calc(100vw - 24px)', background: '#141414', border: '0.5px solid #2A2A2A',
              borderRadius: 10, boxShadow: '0 12px 36px rgba(0,0,0,0.6)', overflow: 'hidden',
              textTransform: 'none', letterSpacing: 0,
            }}>
              <div style={{ padding: '8px 12px 6px', fontSize: 9, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700, borderBottom: '0.5px solid #1F1F1F' }}>
                Preferred model
              </div>
              {MODEL_OPTIONS.map(opt => {
                const om = PROVIDER_META[opt.id] || { color: '#737373' }
                const isPreferred = opt.id === preferred
                const isLive = opt.id === currentProvider
                return (
                  <button
                    key={opt.id}
                    onClick={() => { onModelChange(opt.id); setPickerOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%',
                      background: isPreferred ? '#1A1A1A' : 'transparent', border: 'none',
                      borderBottom: '0.5px solid #1A1A1A', padding: '9px 12px', cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { if (!isPreferred) e.currentTarget.style.background = '#1C1C1C' }}
                    onMouseLeave={e => { if (!isPreferred) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: om.color, marginTop: 4, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#E5E5E5', fontWeight: 600 }}>
                        {opt.label}
                        {isLive && (
                          <span style={{ fontSize: 8, color: '#34D399', border: '0.5px solid #1F4030', background: '#0C1A12', borderRadius: 4, padding: '0 4px', fontWeight: 700, letterSpacing: 0.4 }}>LIVE</span>
                        )}
                      </span>
                      <span style={{ display: 'block', fontSize: 10, color: '#6A6A6A', marginTop: 2 }}>{opt.desc}</span>
                    </span>
                    {isPreferred && <span style={{ color: '#34D399', fontSize: 12, marginTop: 2 }}>✓</span>}
                  </button>
                )
              })}
              {typeof onLockChange === 'function' && (
                <button
                  onClick={() => onLockChange(!lockModel)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                    background: 'transparent', border: 'none', borderTop: '0.5px solid #1F1F1F',
                    padding: '10px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#1C1C1C' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Toggle pill */}
                  <span style={{
                    flexShrink: 0, width: 30, height: 17, borderRadius: 999, position: 'relative',
                    background: lockModel ? '#1F4030' : '#2A2A2A', border: '0.5px solid',
                    borderColor: lockModel ? '#2E5C42' : '#3A3A3A', transition: 'background 0.15s',
                  }}>
                    <span style={{
                      position: 'absolute', top: 1.5, left: lockModel ? 14 : 1.5, width: 12, height: 12,
                      borderRadius: '50%', background: lockModel ? '#34D399' : '#737373', transition: 'left 0.15s',
                    }} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12, color: '#E5E5E5', fontWeight: 600 }}>
                      Stay on this model
                    </span>
                    <span style={{ display: 'block', fontSize: 10, color: '#6A6A6A', marginTop: 2, lineHeight: 1.45 }}>
                      {lockModel
                        ? 'Locked. No auto-switching — a rate limit shows an error instead.'
                        : 'Off. Aria auto-switches providers if your pick is rate-limited.'}
                    </span>
                  </span>
                </button>
              )}
            </div>
          )}
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

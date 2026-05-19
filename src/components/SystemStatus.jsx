import React, { useEffect, useState } from 'react'

/**
 * SystemStatus — the "command center" indicator strip in the Topbar.
 *
 * Renders, left to right:
 *   1. Connection status dot (green = idle, amber pulse = running, red = error)
 *   2. Active AI provider name
 *   3. Current workflow phase (when running)
 *   4. Last operation latency (when set)
 *
 * Subtle, dense, enterprise. Mission-control texture, not chatbot UX.
 */

const MODEL_LABELS = {
  claude: 'Claude',
  groq:   'Groq',
  ollama: 'Ollama',
}

const MODEL_DOTS = {
  // Color reflects the provider class — Claude=warm, Groq=cool, Ollama=neutral
  claude: '#D97706',
  groq:   '#2563EB',
  ollama: '#737373',
}

function StatusDot({ state }) {
  // state: 'idle' | 'running' | 'error'
  const color = state === 'error' ? '#F87171' : state === 'running' ? '#FBBF24' : '#34D399'
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: color,
        boxShadow: `0 0 6px ${color}88`,
      }} />
      {state === 'running' && (
        <span style={{
          position: 'absolute', width: 14, height: 14, borderRadius: '50%',
          background: color, opacity: 0.18, animation: 'aria-pulse 1.2s ease-in-out infinite',
        }} />
      )}
    </span>
  )
}

export default function SystemStatus({ currentModel, isRunning, phaseLabel, lastError, lastLatencyMs }) {
  // Track elapsed time while a phase is running
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!isRunning) { setElapsed(0); return }
    const start = Date.now()
    const interval = setInterval(() => setElapsed(Date.now() - start), 200)
    return () => clearInterval(interval)
  }, [isRunning, phaseLabel])

  const state = lastError ? 'error' : isRunning ? 'running' : 'idle'
  const modelLabel = MODEL_LABELS[currentModel] || currentModel || 'Default'
  const modelDot = MODEL_DOTS[currentModel] || '#737373'

  return (
    <>
      <style>{`@keyframes aria-pulse { 0%, 100% { transform: scale(1); opacity: 0.18 } 50% { transform: scale(1.5); opacity: 0 } }`}</style>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 10px', height: 26,
        background: '#0F0F0F', border: '0.5px solid #1F1F1F', borderRadius: 6,
        fontFamily: 'inherit', fontSize: 10, color: '#737373',
        letterSpacing: 0.3, whiteSpace: 'nowrap',
      }}>
        <StatusDot state={state} />

        {/* Provider */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: modelDot,
          }} />
          <span style={{ color: '#A3A3A3', textTransform: 'uppercase', fontWeight: 500 }}>
            {modelLabel}
          </span>
        </span>

        {/* Phase indicator (while running) */}
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

        {/* Last latency (when idle and we have a value) */}
        {!isRunning && lastLatencyMs != null && (
          <>
            <span style={{ color: '#2A2A2A' }}>·</span>
            <span style={{ color: '#525252', fontVariantNumeric: 'tabular-nums' }}>
              {lastLatencyMs < 1000
                ? `${Math.round(lastLatencyMs)}ms`
                : `${(lastLatencyMs / 1000).toFixed(1)}s`}
            </span>
          </>
        )}

        {/* Error indicator (when last operation failed) */}
        {!isRunning && lastError && (
          <>
            <span style={{ color: '#2A2A2A' }}>·</span>
            <span style={{ color: '#F87171' }} title={lastError}>
              FAULT
            </span>
          </>
        )}
      </div>
    </>
  )
}

import React, { useCallback, useEffect, useState } from 'react'

const LEVEL_STYLES = {
  success: { accent: '#34D399', icon: '✓', label: 'Success' },
  info:    { accent: '#60A5FA', icon: 'i', label: 'Info' },
  warning: { accent: '#FBBF24', icon: '!', label: 'Warning' },
  error:   { accent: '#F87171', icon: '✕', label: 'Error' },
}

// How long the slide-in / slide-out animation runs. Kept in sync with the CSS
// transition below so the item finishes animating out before it unmounts.
const ANIM_MS = 280

/**
 * A single toast that slides in from the right on mount and slides back out
 * before it's removed — the macOS notification feel. The item owns its own
 * auto-dismiss timer so the exit animation always plays (the context just keeps
 * it in the list until the item asks to be removed).
 */
function ToastItem({ toast, onDismiss }) {
  const meta = LEVEL_STYLES[toast.level] || LEVEL_STYLES.info
  const [entered, setEntered] = useState(false)   // false → off-screen right
  const [leaving, setLeaving] = useState(false)   // true → animating out

  // Animate IN on the frame after mount.
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(r)
  }, [])

  // Begin the slide-out, then actually remove once the animation completes.
  const close = useCallback(() => {
    setLeaving(true)
    setTimeout(() => onDismiss(toast.id), ANIM_MS)
  }, [toast.id, onDismiss])

  // Auto-dismiss timer (skipped when duration is 0 / persistent).
  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return
    const t = setTimeout(close, toast.duration)
    return () => clearTimeout(t)
  }, [toast.duration, close])

  const shown = entered && !leaving

  return (
    <div
      role={toast.level === 'error' || toast.level === 'warning' ? 'alert' : 'status'}
      style={{
        pointerEvents: 'auto',
        background: '#181818',
        border: '0.5px solid #2A2A2A',
        borderLeft: `3px solid ${meta.accent}`,
        borderRadius: 8,
        padding: '12px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        color: '#F5F5F5',
        fontSize: 13,
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        // Slide + fade. Off-screen to the right when not shown.
        transform: shown ? 'translateX(0)' : 'translateX(120%)',
        opacity: shown ? 1 : 0,
        transition: `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${ANIM_MS}ms ease`,
        willChange: 'transform, opacity',
      }}
    >
      <span
        aria-hidden="true"
        style={{ color: meta.accent, fontSize: 13, fontWeight: 600, lineHeight: '18px', width: 14, textAlign: 'center' }}
      >
        {meta.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div style={{ fontWeight: 600, marginBottom: 2, color: '#F5F5F5' }}>
            {toast.title}
          </div>
        )}
        <div style={{ color: '#C9C9C9', lineHeight: 1.45, wordBreak: 'break-word' }}>
          {toast.message}
        </div>
        {toast.onRetry && (
          <button
            onClick={() => { toast.onRetry(); close() }}
            style={{
              marginTop: 8,
              background: 'linear-gradient(135deg, #2A2A2A, #484848)',
              border: '0.5px solid #525252',
              color: '#F5F5F5',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {toast.retryLabel}
          </button>
        )}
      </div>
      <button
        onClick={close}
        aria-label="Dismiss notification"
        style={{ background: 'transparent', border: 'none', color: '#5A5A5A', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}
      >
        ×
      </button>
    </div>
  )
}

export default function Toast({ toasts, onDismiss }) {
  if (!toasts?.length) return null

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 'min(420px, calc(100vw - 32px))',
        pointerEvents: 'none',
        overflow: 'hidden',     // clip items while they sit off-screen to the right
      }}
    >
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

import React from 'react'

const LEVEL_STYLES = {
  success: { accent: '#34D399', icon: '✓', label: 'Success' },
  info:    { accent: '#60A5FA', icon: 'i', label: 'Info' },
  warning: { accent: '#FBBF24', icon: '!', label: 'Warning' },
  error:   { accent: '#F87171', icon: '✕', label: 'Error' },
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
      }}
    >
      {toasts.map(t => {
        const meta = LEVEL_STYLES[t.level] || LEVEL_STYLES.info
        return (
          <div
            key={t.id}
            role={t.level === 'error' || t.level === 'warning' ? 'alert' : 'status'}
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
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: meta.accent,
                fontSize: 13,
                fontWeight: 600,
                lineHeight: '18px',
                width: 14,
                textAlign: 'center',
              }}
            >
              {meta.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {t.title && (
                <div style={{ fontWeight: 600, marginBottom: 2, color: '#F5F5F5' }}>
                  {t.title}
                </div>
              )}
              <div style={{ color: '#C9C9C9', lineHeight: 1.45, wordBreak: 'break-word' }}>
                {t.message}
              </div>
              {t.onRetry && (
                <button
                  onClick={() => { t.onRetry(); onDismiss(t.id) }}
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
                  {t.retryLabel}
                </button>
              )}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#5A5A5A',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                padding: '2px 4px',
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}

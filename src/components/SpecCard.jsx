import React, { useState } from 'react'

const THEME_ICONS = {
  ocean: '🌊', forest: '🌿', violet: '✦', rose: '◆', amber: '⬡', slate: '▣'
}

const FIELD_TYPE_LABELS = {
  text: 'Short text', textarea: 'Long text', email: 'Email',
  number: 'Number', date: 'Date', select: 'Dropdown'
}

export default function SpecCard({ spec, onBuild }) {
  const [building, setBuilding] = useState(false)

  async function handleBuild() {
    setBuilding(true)
    await onBuild()
  }

  const primary = spec.colorTheme?.primary || '#8B5CF6'
  const light = spec.colorTheme?.light || '#F5F3FF'
  const textColor = spec.colorTheme?.text || '#1E1B4B'
  const themeName = spec.colorTheme?.name || 'violet'

  return (
    <div style={{
      background: '#fff',
      border: '0.5px solid #E5E7EB',
      borderRadius: 12,
      overflow: 'hidden',
      maxWidth: '92%',
      boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    }}>
      {/* Header strip */}
      <div style={{
        background: primary,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>{THEME_ICONS[themeName] || '◆'}</span>
        <div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px' }}>
            {spec.appTitle}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 }}>
            {spec.tagline}
          </div>
        </div>
        <div style={{
          marginLeft: 'auto',
          background: 'rgba(255,255,255,0.2)',
          color: '#fff',
          padding: '3px 10px',
          borderRadius: 20,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          Spec ready
        </div>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Purpose */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            What this builds
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
            {spec.purpose}
          </p>
        </div>

        {/* Features + Fields side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Features
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(spec.features || []).map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: primary, flexShrink: 0, marginTop: 4,
                  }} />
                  <span style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Form fields
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(spec.fields || []).slice(0, 6).map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#4B5563' }}>{f.label}</span>
                  <span style={{
                    fontSize: 9, color: primary,
                    background: light, borderRadius: 4,
                    padding: '1px 5px', fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}>
                    {FIELD_TYPE_LABELS[f.type] || f.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status flow */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Status flow
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {(spec.statusFlow || []).map((s, i) => (
              <React.Fragment key={s}>
                <div style={{
                  background: i === 0 ? primary : light,
                  color: i === 0 ? '#fff' : textColor,
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}>{s}</div>
                {i < spec.statusFlow.length - 1 && (
                  <div style={{ color: '#D1D5DB', fontSize: 12, padding: '0 4px' }}>→</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Color swatch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Color theme
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: primary, border: '0.5px solid rgba(0,0,0,0.1)' }} />
            <div style={{ width: 16, height: 16, borderRadius: 4, background: light, border: '0.5px solid rgba(0,0,0,0.1)' }} />
            <div style={{ width: 16, height: 16, borderRadius: 4, background: textColor, border: '0.5px solid rgba(0,0,0,0.1)' }} />
          </div>
          <span style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'capitalize' }}>{themeName}</span>
        </div>

        {/* Build button */}
        <button
          onClick={handleBuild}
          disabled={building}
          style={{
            background: building ? '#E5E7EB' : primary,
            color: building ? '#9CA3AF' : '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: 600,
            cursor: building ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            letterSpacing: '-0.2px',
          }}
        >
          {building ? (
            <>
              <span style={{ opacity: 0.6 }}>Building</span>
              <span style={{ opacity: 0.4 }}>...</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M7 2l5 5-5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Build this app
            </>
          )}
        </button>
      </div>
    </div>
  )
}

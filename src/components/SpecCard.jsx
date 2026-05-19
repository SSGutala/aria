import React, { useState, useRef, useEffect } from 'react'

const THEME_ICONS = {
  ocean: '🌊', forest: '🌿', violet: '✦', rose: '◆', amber: '⬡', slate: '▣',
  default: '◆',
}

const FIELD_TYPE_LABELS = {
  text: 'Text', textarea: 'Long text', email: 'Email',
  number: 'Number', date: 'Date', select: 'Dropdown',
}

// Curated vibrant color presets
const COLOR_PRESETS = [
  { name: 'violet',  primary: '#7C3AED', light: '#F5F3FF', text: '#2E1065' },
  { name: 'purple',  primary: '#9333EA', light: '#FAF5FF', text: '#3B0764' },
  { name: 'indigo',  primary: '#4F46E5', light: '#EEF2FF', text: '#312E81' },
  { name: 'blue',    primary: '#2563EB', light: '#EFF6FF', text: '#1E3A8A' },
  { name: 'sky',     primary: '#0284C7', light: '#F0F9FF', text: '#0C4A6E' },
  { name: 'cyan',    primary: '#0891B2', light: '#ECFEFF', text: '#164E63' },
  { name: 'teal',    primary: '#0D9488', light: '#F0FDFA', text: '#134E4A' },
  { name: 'emerald', primary: '#059669', light: '#ECFDF5', text: '#064E3B' },
  { name: 'green',   primary: '#16A34A', light: '#F0FDF4', text: '#14532D' },
  { name: 'rose',    primary: '#E11D48', light: '#FFF1F2', text: '#4C0519' },
  { name: 'pink',    primary: '#DB2777', light: '#FDF2F8', text: '#500724' },
  { name: 'red',     primary: '#DC2626', light: '#FEF2F2', text: '#7F1D1D' },
  { name: 'orange',  primary: '#EA580C', light: '#FFF7ED', text: '#7C2D12' },
  { name: 'amber',   primary: '#D97706', light: '#FFFBEB', text: '#78350F' },
  { name: 'slate',   primary: '#334155', light: '#F8FAFC', text: '#0F172A' },
]

function ColorPicker({ current, onChange, onClose, anchorRect }) {
  const ref = useRef(null)
  const [hexInput, setHexInput] = useState(current.primary || '#7C3AED')
  const [hexError, setHexError] = useState(false)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function handleHexInput(val) {
    setHexInput(val)
    const hex = val.startsWith('#') ? val : '#' + val
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setHexError(false)
      onChange({ name: 'custom', primary: hex, light: hex + '18', text: '#111827' })
    } else {
      setHexError(true)
    }
  }

  const top = anchorRect ? anchorRect.bottom + 6 : 0
  const left = anchorRect ? anchorRect.left : 0

  return (
    <div ref={ref} style={{
      position: 'fixed', top, left, zIndex: 9999,
      background: '#fff', border: '1px solid #E5E7EB',
      borderRadius: 12, padding: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Choose color
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
        {COLOR_PRESETS.map(preset => (
          <button
            key={preset.name}
            onClick={() => { onChange(preset); onClose() }}
            title={preset.name}
            style={{
              width: 24, height: 24, borderRadius: 6,
              background: preset.primary, border: 'none', cursor: 'pointer',
              outline: current.primary === preset.primary ? `2px solid ${preset.primary}` : 'none',
              outlineOffset: 2,
              transition: 'transform 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          />
        ))}
      </div>
      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
        <label style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>Custom hex</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="color"
            value={hexInput.startsWith('#') && hexInput.length >= 4 ? hexInput : current.primary}
            onChange={e => handleHexInput(e.target.value)}
            style={{ width: 32, height: 28, border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', padding: 2, flexShrink: 0 }}
          />
          <input
            type="text"
            value={hexInput}
            onChange={e => handleHexInput(e.target.value)}
            placeholder="#7C3AED"
            maxLength={7}
            spellCheck={false}
            style={{
              width: 90, fontSize: 11, fontFamily: 'monospace',
              border: `1px solid ${hexError ? '#F87171' : '#E5E7EB'}`,
              borderRadius: 6, padding: '4px 8px', outline: 'none',
              color: hexError ? '#EF4444' : '#374151',
              background: hexError ? '#FEF2F2' : '#fff',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default function SpecCard({ spec, onBuild, onSpecChange }) {
  const [building, setBuilding] = useState(false)
  const [localSpec, setLocalSpec] = useState(spec)
  const [showPicker, setShowPicker] = useState(false)
  const pickerAnchorRef = useRef(null)

  const primary   = localSpec.colorTheme?.primary || '#7C3AED'
  const light     = localSpec.colorTheme?.light   || '#F5F3FF'
  const textColor = localSpec.colorTheme?.text    || '#2E1065'
  const themeName = localSpec.colorTheme?.name    || 'violet'

  function updateColor(colorTheme) {
    const updated = { ...localSpec, colorTheme }
    setLocalSpec(updated)
    onSpecChange?.(updated)
  }

  async function handleBuild() {
    setBuilding(true)
    await onBuild()
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: 14,
      overflow: 'hidden',
      maxWidth: '90%',
      boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{ background: primary, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          {THEME_ICONS[themeName] || THEME_ICONS.default}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1.2 }}>{localSpec.appTitle}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>{localSpec.tagline}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
          Spec ready
        </div>
      </div>

      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Purpose */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>What this builds</div>
          <p style={{ margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.65 }}>{localSpec.purpose}</p>
        </div>

        {/* Features + Fields grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Features</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(localSpec.features || []).map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: primary, flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.55 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Form fields</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(localSpec.fields || []).slice(0, 6).map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#4B5563' }}>{f.label}</span>
                  <span style={{ fontSize: 9, color: primary, background: light, borderRadius: 5, padding: '2px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {FIELD_TYPE_LABELS[f.type] || f.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status flow */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Status flow</div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            {(localSpec.statusFlow || []).map((s, i) => (
              <React.Fragment key={s}>
                <div style={{
                  background: i === 0 ? primary : light,
                  color: i === 0 ? '#fff' : textColor,
                  padding: '4px 11px', borderRadius: 6,
                  fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                }}>{s}</div>
                {i < localSpec.statusFlow.length - 1 && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5h6M5.5 2.5l2.5 2.5-2.5 2.5" stroke="#D1D5DB" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Color theme with picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Color theme</div>
            <div style={{ display: 'flex', gap: 5, position: 'relative' }}>
            <button
              ref={pickerAnchorRef}
              onClick={() => setShowPicker(v => !v)}
              title="Click to change color theme"
              style={{ display: 'flex', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, alignItems: 'center' }}
            >
              <div style={{ width: 18, height: 18, borderRadius: 5, background: primary, border: '2px solid rgba(0,0,0,0.12)', transition: 'transform 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              />
              <div style={{ width: 18, height: 18, borderRadius: 5, background: light, border: '1px solid #E5E7EB' }} />
              <div style={{ width: 18, height: 18, borderRadius: 5, background: textColor, border: '1px solid rgba(0,0,0,0.12)' }} />
            </button>
            {showPicker && (
              <ColorPicker
                current={localSpec.colorTheme || {}}
                onChange={updateColor}
                onClose={() => setShowPicker(false)}
                anchorRect={pickerAnchorRef.current?.getBoundingClientRect()}
              />
            )}
          </div>
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{themeName}</span>
          <span style={{ fontSize: 10, color: '#C4C4C4', marginLeft: 2 }}>— click swatches to change</span>
        </div>

        {/* Build button */}
        <button
          onClick={handleBuild}
          disabled={building}
          style={{
            background: building ? '#E5E7EB' : primary,
            color: building ? '#9CA3AF' : '#fff',
            border: 'none', borderRadius: 9,
            padding: '11px 20px',
            fontSize: 13, fontWeight: 700,
            cursor: building ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            letterSpacing: '-0.2px',
            transition: 'opacity 0.15s',
          }}
        >
          {building ? (
            <>
              <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid #9CA3AF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              Building your app...
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M7 2l5 5-5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Build this app
            </>
          )}
        </button>
      </div>
    </div>
  )
}

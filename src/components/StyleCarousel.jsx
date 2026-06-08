import React, { useState } from 'react'
import AppPreview from './AppPreview'

/**
 * StyleCarousel — shows 3 AI-generated design directions for the app the user
 * described, so they can SEE what their product could look like before Aria
 * builds it for real. The user flips through the previews, picks one, optionally
 * types tweaks/opinions, then clicks Build — which kicks off the real generation
 * with the chosen style threaded in as a hard design constraint.
 *
 * Props:
 *   styles: [{ id, label, vibe, files: { '/App.js': '...' } }]
 *   prompt: the app description (shown as context)
 *   onBuild: (chosenStyle, opinion) => void
 *   onRegenerate: (feedback) => void   (re-create the 3 designs with the typed changes)
 *   onCancel: () => void
 *   building: boolean       (disables controls while the real build runs)
 *   regenerating: boolean   (disables controls while new designs are generating)
 */
export default function StyleCarousel({ styles = [], prompt = '', onBuild, onRegenerate, onCancel, building = false, regenerating = false }) {
  const [active, setActive] = useState(0)
  const [opinion, setOpinion] = useState('')
  const count = styles.length
  if (!count) return null
  const current = styles[Math.min(active, count - 1)]

  const busy = building || regenerating
  const go = (dir) => setActive(a => (a + dir + count) % count)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#0B0B0B' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 10px', borderBottom: '0.5px solid #1A1A1A' }}>
        <div style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 600 }}>Pick a design direction</div>
        <div style={{ fontSize: 12, color: '#8A8A8A', marginTop: 3 }}>
          Three looks for “{prompt.length > 70 ? prompt.slice(0, 70) + '…' : prompt}”. Choose one, add any tweaks, then build.
        </div>
      </div>

      {/* Preview area */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 600 }}>{current.label}</span>
            <span style={{ fontSize: 11, color: '#6A6A6A' }}>{active + 1} / {count}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => go(-1)} disabled={busy} style={navBtn}>‹</button>
            <button onClick={() => go(1)} disabled={busy} style={navBtn}>›</button>
          </div>
        </div>
        {current.vibe && (
          <div style={{ padding: '0 20px 8px', fontSize: 11, color: '#7A7A7A' }}>{current.vibe}</div>
        )}
        <div style={{ flex: 1, minHeight: 0, margin: '0 20px 12px', borderRadius: 10, overflow: 'hidden', border: '0.5px solid #1F1F1F', background: '#FFFFFF', position: 'relative' }}>
          <AppPreview files={current.files} entry="/App.js" />
          {regenerating && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,11,11,0.72)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#E5E5E5', fontSize: 12 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#60A5FA', animation: 'pulse 1.4s ease-in-out infinite' }} />
              <span>Regenerating designs with your changes…</span>
            </div>
          )}
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 8 }}>
          {styles.map((s, i) => (
            <button
              key={s.id || i}
              onClick={() => setActive(i)}
              disabled={busy}
              title={s.label}
              style={{ width: 7, height: 7, borderRadius: '50%', border: 0, cursor: 'pointer', padding: 0, background: i === active ? '#60A5FA' : '#2E2E2E' }}
            />
          ))}
        </div>
      </div>

      {/* Design changes + actions */}
      <div style={{ padding: '12px 20px 16px', borderTop: '0.5px solid #1A1A1A', background: '#0B0B0B' }}>
        <textarea
          value={opinion}
          onChange={e => setOpinion(e.target.value)}
          disabled={busy}
          placeholder="Describe design changes (e.g. ‘make it feel more playful’, ‘add a sidebar’, ‘use green accents’) — then Regenerate to see the updated designs, or Build to apply them to your pick."
          rows={2}
          style={{ width: '100%', resize: 'none', background: '#141414', color: '#E5E5E5', border: '0.5px solid #2A2A2A', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
          <button onClick={onCancel} disabled={busy} style={{ background: '#1C1C1C', color: '#B5B5B5', border: '0.5px solid #2A2A2A', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => onRegenerate?.(opinion.trim())}
              disabled={busy || !opinion.trim()}
              title={opinion.trim() ? 'Recreate the 3 designs with your changes' : 'Type your design changes first'}
              style={{ background: '#15233A', color: (busy || !opinion.trim()) ? '#5A6B82' : '#9EC5FF', border: '0.5px solid #24405E', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: (busy || !opinion.trim()) ? 'default' : 'pointer', fontFamily: 'inherit' }}
            >
              {regenerating ? 'Regenerating…' : '↻ Regenerate designs'}
            </button>
            <button
              onClick={() => onBuild?.(current, opinion.trim())}
              disabled={busy}
              style={{ background: busy ? '#1F3A2E' : 'linear-gradient(90deg, #34D399, #60A5FA)', color: busy ? '#9CA3AF' : '#06281C', border: 0, borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}
            >
              {building ? 'Building…' : `Build in “${current.label}” →`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const navBtn = {
  background: '#1C1C1C', color: '#E5E5E5', border: '0.5px solid #2A2A2A',
  borderRadius: 6, width: 28, height: 24, fontSize: 14, lineHeight: '1', cursor: 'pointer', fontFamily: 'inherit',
}

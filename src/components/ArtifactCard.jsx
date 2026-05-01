import React, { useState } from 'react'

const TYPE_META = {
  intake_summary:    { label: 'Intake Summary',    icon: '📋', color: '#60A5FA', bg: '#0D1A2A', border: '#1E3A5F' },
  product_brief:     { label: 'Product Brief',     icon: '📄', color: '#A78BFA', bg: '#1A0D2A', border: '#3A1E5F' },
  workflow_map:      { label: 'Workflow Map',       icon: '🔀', color: '#34D399', bg: '#0D1F16', border: '#1E5F3A' },
  data_model:        { label: 'Data Model',         icon: '🗂️', color: '#FBBF24', bg: '#1F1A0D', border: '#5F4A1E' },
  automation_model:  { label: 'Automation Model',   icon: '⚡', color: '#F87171', bg: '#2A0D0D', border: '#5F1E1E' },
  ux_recommendation: { label: 'UX Recommendation',  icon: '🎨', color: '#F472B6', bg: '#2A0D1A', border: '#5F1E3A' },
  app_spec:          { label: 'App Spec',            icon: '⚙️', color: '#94A3B8', bg: '#161616', border: '#2A2A2A' },
}

const STATUS_STYLES = {
  draft:      { color: '#737373', bg: '#1A1A1A', label: 'Draft' },
  approved:   { color: '#34D399', bg: '#0D1F16', label: 'Approved' },
  built:      { color: '#60A5FA', bg: '#0D1A2A', label: 'Built' },
  superseded: { color: '#525252', bg: '#111',    label: 'Superseded' },
}

const EXPORT_FORMATS = [
  { id: 'json',     label: 'JSON',     ext: '.json' },
  { id: 'markdown', label: 'Markdown', ext: '.md' },
  { id: 'txt',      label: 'Text',     ext: '.txt' },
]

// ── Markdown formatter ──────────────────────────────────────────────────────
function toMarkdown(artifact) {
  const { title, artifact_type, version, content } = artifact
  const lines = [`# ${title}`, `**Type:** ${TYPE_META[artifact_type]?.label || artifact_type}  **Version:** ${version}`, '']

  function renderValue(key, val, depth = 0) {
    const indent = '  '.repeat(depth)
    const heading = '#'.repeat(Math.min(depth + 2, 6))
    if (val === null || val === undefined) return
    if (typeof val === 'string') {
      lines.push(`${indent}**${key}:** ${val}`)
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      lines.push(`${indent}**${key}:** ${val}`)
    } else if (Array.isArray(val)) {
      lines.push(`${indent}**${key}:**`)
      val.forEach(item => {
        if (typeof item === 'string') lines.push(`${indent}- ${item}`)
        else if (typeof item === 'object') {
          lines.push('')
          Object.entries(item).forEach(([k, v]) => renderValue(k, v, depth + 1))
        }
      })
    } else if (typeof val === 'object') {
      lines.push(`${indent}${heading} ${key}`)
      Object.entries(val).forEach(([k, v]) => renderValue(k, v, depth + 1))
    }
    lines.push('')
  }

  if (content && typeof content === 'object') {
    Object.entries(content).forEach(([k, v]) => renderValue(k, v))
  }
  return lines.join('\n')
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function ArtifactCard({ artifact, onOpen, onApprove, compact = false }) {
  const [showExport, setShowExport] = useState(false)
  if (!artifact) return null

  const meta   = TYPE_META[artifact.artifact_type] || TYPE_META.app_spec
  const status = STATUS_STYLES[artifact.status] || STATUS_STYLES.draft
  const title  = artifact.title || meta.label

  function handleExport(format) {
    setShowExport(false)
    const safeName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    if (format === 'json') {
      downloadBlob(JSON.stringify(artifact.content, null, 2), `${safeName}_v${artifact.version}.json`, 'application/json')
    } else if (format === 'markdown') {
      downloadBlob(toMarkdown(artifact), `${safeName}_v${artifact.version}.md`, 'text/markdown')
    } else if (format === 'txt') {
      downloadBlob(toMarkdown(artifact).replace(/[#*`]/g, ''), `${safeName}_v${artifact.version}.txt`, 'text/plain')
    }
  }

  return (
    <div style={{
      background: '#111111',
      border: `0.5px solid ${meta.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      maxWidth: compact ? '100%' : '88%',
      minWidth: compact ? 0 : 320,
      position: 'relative',
    }}>
      {/* Top accent line */}
      <div style={{ height: 2, background: meta.color, opacity: 0.6 }} />

      <div style={{ padding: '10px 13px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{meta.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 600, color: '#D4D4D4', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, color: meta.color, background: meta.bg, border: `0.5px solid ${meta.border}`, borderRadius: 3, padding: '1px 5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {meta.label}
              </span>
              <span style={{ fontSize: 9, color: '#3D3D3D' }}>v{artifact.version || 1}</span>
              <span style={{ fontSize: 9, color: status.color, background: status.bg, borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>
                {status.label}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', position: 'relative' }}>
          <ActionBtn label="Open" icon="↗" primary onClick={onOpen} />
          {artifact.status !== 'approved' && (
            <ActionBtn label="Approve" icon="✓" onClick={onApprove} green />
          )}
          {artifact.status === 'approved' && (
            <span style={{ fontSize: 10, color: '#34D399', display: 'flex', alignItems: 'center', gap: 3, padding: '4px 0' }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Approved
            </span>
          )}
          <div style={{ position: 'relative' }}>
            <ActionBtn label="Export" icon="⬇" onClick={() => setShowExport(v => !v)} />
            {showExport && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 7,
                overflow: 'hidden', zIndex: 50, minWidth: 100,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {EXPORT_FORMATS.map(fmt => (
                  <button key={fmt.id} onClick={() => handleExport(fmt.id)}
                    style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: 'left', fontSize: 11, color: '#A3A3A3', cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1E1E1E'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    {fmt.label} <span style={{ color: '#525252' }}>{fmt.ext}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ label, icon, onClick, primary, green }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: primary ? '#1C1C1C' : 'transparent',
        color: green ? '#34D399' : '#737373',
        border: `0.5px solid ${green ? '#34D39933' : '#2A2A2A'}`,
        borderRadius: 5, padding: '4px 9px', fontSize: 10,
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 3,
        transition: 'all 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = green ? '#6EE7B7' : '#D4D4D4'; e.currentTarget.style.borderColor = green ? '#34D39966' : '#3D3D3D' }}
      onMouseLeave={e => { e.currentTarget.style.color = green ? '#34D399' : '#737373'; e.currentTarget.style.borderColor = green ? '#34D39933' : '#2A2A2A' }}
    >
      <span style={{ fontSize: 9 }}>{icon}</span> {label}
    </button>
  )
}

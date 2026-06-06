import React, { useState, useRef, useEffect } from 'react'
import AppPreview from './AppPreview'
import AppProjectViewer from './AppProjectViewer'

/**
 * AppProjectPanel — the surface for a generated app project, laid out Lovable-style:
 * a LEFT edit bar (title, status, an expanded multiline "describe changes" box, and
 * a generation-errors / auto-fix indicator) and a RIGHT preview area with Preview /
 * Code tabs. Additive — does not replace any existing Aria UI.
 *
 * Props: { project: { title, summary, files, entry, fileTree, generation_errors },
 *          onEdit?(request), editing?: bool, onRuntimeError?, autoFixing?: bool }
 */
export default function AppProjectPanel({ project, onEdit, editing = false, onRuntimeError, autoFixing = false, editProgress = { percent: 0, message: '' }, editLog = [], editElapsedMs = 0 }) {
  const [tab, setTab] = useState('preview')
  const [editText, setEditText] = useState('')
  const logRef = useRef(null)
  // Keep the narration scrolled to the newest line.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [editLog])
  if (!project) return null

  const files = project.files || {}
  const entry = project.entry || '/App.js'
  const genErrors = project.generation_errors || project.errors || []
  const busy = editing || autoFixing

  const submitEdit = () => {
    if (editText.trim() && !editing) { onEdit(editText.trim()); setEditText('') }
  }

  // Rough "time left" from current percent + elapsed (smooths between events).
  const pct = Math.min(99, Math.max(0, editProgress.percent || 0))
  const elapsedSec = editElapsedMs / 1000
  const etaSec = pct > 5 && pct < 100 ? Math.max(0, (elapsedSec / pct) * (100 - pct)) : 0
  const fmt = (s) => s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '6px 14px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
        background: tab === id ? '#1C1C1C' : 'transparent',
        color: tab === id ? '#E5E5E5' : '#737373',
        border: '0.5px solid', borderColor: tab === id ? '#2A2A2A' : 'transparent',
        borderRadius: 7,
      }}
    >{label}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', minHeight: 0, gap: 12 }}>
      {/* ── LEFT: edit bar ─────────────────────────────────────────────── */}
      {onEdit && (
        <div style={{
          width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: '#0D0D0D', border: '0.5px solid #1E1E1E', borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #1E1E1E' }}>
            <div style={{ fontSize: 14, color: '#E5E5E5', fontWeight: 500, lineHeight: 1.3, wordBreak: 'break-word' }}>
              {project.title || 'Untitled App'}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: genErrors.length ? '#F59E0B' : '#525252' }}>
              {Object.keys(files).length} files{genErrors.length ? ` · ${genErrors.length} warnings` : ''}
            </div>
          </div>

          {genErrors.length > 0 && !busy && (
            <div style={{ padding: '10px 16px', borderBottom: '0.5px solid #1E1E1E', background: '#120D04' }}>
              <div style={{ fontSize: 11, color: '#F5C451', marginBottom: 8 }}>
                {genErrors.length} build {genErrors.length === 1 ? 'issue' : 'issues'} detected
              </div>
              <button
                onClick={() => onEdit('Fix the build/generation issues in the app.', { isRepair: true, errorText: JSON.stringify(genErrors) })}
                style={{ width: '100%', background: '#1A1407', color: '#F5C451', border: '0.5px solid #3A2A0A', borderRadius: 7, padding: '7px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                title="Regenerate the files that failed"
              >✦ Fix with AI</button>
            </div>
          )}

          {busy ? (
            /* ── Live progress + narration of the edit (pure logging) ─────── */
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: autoFixing ? '#34D399' : '#737373', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: autoFixing ? '#34D399' : '#E5E5E5', animation: 'pulse 1.4s ease-in-out infinite' }} />
                  {autoFixing ? 'Auto-fixing' : 'Applying changes'}
                </span>
                <span style={{ fontSize: 11, color: '#737373', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(elapsedSec)}{etaSec > 0 ? ` · ~${fmt(etaSec)} left` : ''}
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 5, borderRadius: 3, background: '#1A1A1A', overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', width: `${Math.max(4, editProgress.percent || 0)}%`, background: autoFixing ? '#34D399' : '#E5E5E5', borderRadius: 3, transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ fontSize: 11, color: '#A3A3A3', marginBottom: 10 }}>{editProgress.message || 'Working…'}</div>

              {/* Narration — Aria describing each step */}
              <div ref={logRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#0A0A0A', border: '0.5px solid #1A1A1A', borderRadius: 9, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {editLog.map((line, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.45, color: line.stage === 'error' ? '#F87171' : line.stage === 'done' || line.stage === 'summary' ? '#34D399' : '#C4C4C4' }}>
                    <span style={{ color: '#404040', flexShrink: 0 }}>{line.stage === 'error' ? '✕' : line.stage === 'done' || line.stage === 'summary' ? '✓' : '›'}</span>
                    <span style={{ wordBreak: 'break-word' }}>{line.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── Describe changes — expanded multiline box ───────────────── */
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '14px 16px' }}>
              <label style={{ fontSize: 11, color: '#737373', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Describe changes
              </label>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitEdit() } }}
                placeholder={'Describe a change, e.g.\n• "Add a Kanban view"\n• "Make the header sticky and dark"\n• "Add finance approval after manager"'}
                style={{
                  flex: 1, minHeight: 120, resize: 'none', width: '100%',
                  background: '#141414', border: '0.5px solid #2A2A2A', borderRadius: 9,
                  color: '#F5F5F5', padding: '10px 12px', fontSize: 13, lineHeight: 1.5,
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={submitEdit}
                disabled={!editText.trim()}
                style={{
                  marginTop: 10, background: '#E5E5E5',
                  color: '#111', border: 'none', borderRadius: 8,
                  padding: '10px 16px', fontSize: 13, cursor: !editText.trim() ? 'default' : 'pointer',
                  fontFamily: 'inherit', fontWeight: 500, opacity: editText.trim() ? 1 : 0.5,
                }}
              >Apply changes</button>
              <div style={{ marginTop: 8, fontSize: 10, color: '#404040', textAlign: 'center' }}>
                ⌘↵ to apply
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RIGHT: preview / code ──────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#0D0D0D', border: '0.5px solid #1E1E1E', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '0.5px solid #1E1E1E' }}>
          <div style={{ display: 'flex', gap: 4, background: '#0A0A0A', padding: 3, borderRadius: 9, border: '0.5px solid #1A1A1A' }}>
            {tabBtn('preview', '▶ Preview')}
            {tabBtn('code', '⬡ Code')}
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 12, color: '#A3A3A3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {project.title}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          {tab === 'preview'
            ? <AppPreview files={files} entry={entry} onRuntimeError={onRuntimeError} />
            : <AppProjectViewer files={files} entry={entry} title={project.title} summary={project.summary} />}
        </div>
      </div>
    </div>
  )
}

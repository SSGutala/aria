import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import SystemStatus from './SystemStatus'
import { logAction } from '../lib/devlog'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

function Toast({ message }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 8,
      padding: '8px 16px', fontSize: 12, color: '#A3A3A3', zIndex: 9999,
    }}>
      {message}
    </div>
  )
}

function EditableTitle({ value, placeholder, onSave, dim }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const inputRef = useRef(null)

  // Sync if parent value changes (e.g. from sidebar rename)
  useEffect(() => { if (!editing) setDraft(value || '') }, [value, editing])

  function startEdit() { setDraft(value || ''); setEditing(true); logAction('conversation.rename_started', {}) }

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      logAction('conversation.renamed', { title: trimmed })
      onSave(trimmed)
    }
  }

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value || '') } }}
        style={{
          background: 'transparent', border: 'none',
          borderBottom: '0.5px solid #3D3D3D',
          outline: 'none',
          color: '#F5F5F5', fontSize: 13, fontWeight: 500,
          fontFamily: 'inherit', padding: '0 2px', minWidth: 60,
          width: Math.max(120, draft.length * 8),
        }}
      />
    )
  }

  return (
    <span
      onDoubleClick={startEdit}
      title="Double-click to rename"
      style={{
        color: dim ? '#525252' : '#F5F5F5',
        fontSize: 13, fontWeight: 500,
        cursor: 'default', userSelect: 'none',
      }}
    >
      {value || placeholder}
    </span>
  )
}

export default function Topbar({ conversation, app, onTitleChange, onAppTitleChange, artifactCount = 0, onToggleArtifacts, showArtifactPanel, onMenuToggle, isMobile, currentModel, isRunning, phaseLabel, lastError, lastLatencyMs }) {
  const [toast, setToast] = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2000) }

  async function saveConvTitle(title) {
    if (!conversation) return
    await supabase.from('conversations').update({ title }).eq('id', conversation.id)
    onTitleChange(title)
  }

  async function saveAppTitle(title) {
    if (!app) return
    await supabase.from('generated_apps').update({ title }).eq('id', app.id)
    onAppTitleChange(title)
  }

  function copyShareLink() {
    if (!app) return
    logAction('app.link_copied', { slug: app?.slug })
    const url = `${window.location.origin}/app/${app.slug}`
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!'))
  }

  return (
    <>
      {toast && <Toast message={toast} />}
      <div style={{
        height: 46, borderBottom: '0.5px solid #1A1A1A',
        padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        {/* Hamburger — mobile/tablet only */}
        {onMenuToggle && (
          <button onClick={() => { logAction('sidebar.toggled', {}); onMenuToggle() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#525252', padding: '4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = '#A3A3A3'}
            onMouseLeave={e => e.currentTarget.style.color = '#525252'}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        {/* Conversation title — always shown */}
        <EditableTitle
          value={conversation?.title}
          placeholder="New conversation"
          onSave={saveConvTitle}
          dim={false}
        />

        {/* App title separator + name */}
        {app && (
          <>
            <span style={{ color: '#2A2A2A', fontSize: 14 }}>/</span>
            <EditableTitle
              value={app.title}
              placeholder="Untitled app"
              onSave={saveAppTitle}
              dim={false}
            />
            <span style={{
              background: '#1F1F1F', color: '#A3A3A3', border: '0.5px solid #2E2E2E',
              padding: '3px 10px', borderRadius: 20, fontSize: 10,
            }}>
              Deployed
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={copyShareLink}
                style={{ background: '#1A1A1A', color: '#525252', border: '0.5px solid #2A2A2A', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Share link
              </button>
              <button
                onClick={() => { logAction('app.viewed', { slug: app?.slug }); window.open(`/app/${app.slug}`, '_blank') }}
                style={{ background: glareGradient, color: '#111111', border: '0.5px solid #484848', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                View app
              </button>
            </div>
          </>
        )}

        {/* Hint when no app yet — hide on mobile */}
        {!app && conversation && !isMobile && (
          <span style={{ fontSize: 11, color: '#2A2A2A', marginLeft: 4 }}>double-click to rename</span>
        )}

        {/* System status — always visible, command-center texture */}
        {!isMobile && (
          <div style={{ marginLeft: app ? 8 : 'auto' }}>
            <SystemStatus
              currentModel={currentModel}
              isRunning={isRunning}
              phaseLabel={phaseLabel}
              lastError={lastError}
              lastLatencyMs={lastLatencyMs}
            />
          </div>
        )}

        {/* Artifacts toggle — shown when there are artifacts */}
        {artifactCount > 0 && onToggleArtifacts && (
          <button
            onClick={() => { logAction('artifacts.panel_toggled', {}); onToggleArtifacts() }}
            style={{
              marginLeft: app ? 0 : 'auto',
              background: showArtifactPanel ? '#1A2A1A' : '#1A1A1A',
              color: showArtifactPanel ? '#34D399' : '#525252',
              border: `0.5px solid ${showArtifactPanel ? '#34D39933' : '#2A2A2A'}`,
              borderRadius: 6, padding: '4px 10px', fontSize: 11,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <span style={{ fontSize: 10 }}>📁</span>
            Artifacts
            <span style={{
              background: showArtifactPanel ? '#34D39922' : '#222',
              color: showArtifactPanel ? '#34D399' : '#737373',
              borderRadius: 8, padding: '0 5px', fontSize: 9, fontWeight: 700,
            }}>{artifactCount}</span>
          </button>
        )}
      </div>
    </>
  )
}

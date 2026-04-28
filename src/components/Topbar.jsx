import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

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

export default function Topbar({ conversation, app, onTitleChange }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  function startEdit() {
    setTitle(conversation?.title || '')
    setEditing(true)
  }

  async function saveTitle() {
    setEditing(false)
    if (!title.trim() || title === conversation?.title) return
    await supabase.from('conversations').update({ title: title.trim() }).eq('id', conversation.id)
    onTitleChange(title.trim())
  }

  function copyShareLink() {
    if (!app) return
    const url = `${window.location.origin}/app/${app.slug}`
    navigator.clipboard.writeText(url).then(() => showToast('Copied!'))
  }

  return (
    <>
      {toast && <Toast message={toast} />}
      <div style={{
        height: 46,
        borderBottom: '0.5px solid #1A1A1A',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => e.key === 'Enter' && saveTitle()}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#F5F5F5',
              fontSize: 13,
              fontWeight: 500,
            }}
          />
        ) : (
          <span
            onDoubleClick={startEdit}
            style={{ flex: 1, color: '#F5F5F5', fontSize: 13, fontWeight: 500, cursor: 'default', userSelect: 'none' }}
          >
            {conversation?.title || 'New conversation'}
          </span>
        )}

        {app && (
          <>
            <span style={{
              background: '#1F1F1F',
              color: '#A3A3A3',
              border: '0.5px solid #2E2E2E',
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 10,
            }}>
              Deployed
            </span>
            <button
              onClick={copyShareLink}
              style={{
                background: '#1A1A1A',
                color: '#525252',
                border: '0.5px solid #2A2A2A',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Share link
            </button>
            <button
              onClick={() => window.open(`/app/${app.slug}`, '_blank')}
              style={{
                background: glareGradient,
                color: '#111111',
                border: '0.5px solid #484848',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              View app
            </button>
          </>
        )}
      </div>
    </>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

function Dot({ variant }) {
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
      background: variant === 'deployed' ? '#34D399' : variant === 'active' ? '#A3A3A3' : '#2A2A2A',
      border: variant === 'deployed' ? '1px solid #34D39966' : variant === 'active' ? '1px solid #3D3D3D' : '1px solid #2A2A2A',
    }} />
  )
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M1.5 3h9M4.5 3V2h3v1M2.5 3l.5 7h6l.5-7H2.5z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function Tag({ label, color }) {
  const colors = {
    chat: { bg: '#0D1A2A', text: '#60A5FA', border: '#1E3A5F' },
    app:  { bg: '#0D2A1A', text: '#34D399', border: '#1E5F3A' },
  }
  const c = colors[color] || colors.chat
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: c.bg, color: c.text, border: `0.5px solid ${c.border}`,
      borderRadius: 4, padding: '1px 5px', flexShrink: 0,
    }}>{label}</span>
  )
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 12,
        padding: '24px', maxWidth: 340, width: '90vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ margin: '0 0 8px', color: '#F5F5F5', fontSize: 14, fontWeight: 600 }}>{title}</h3>
        <p style={{ margin: '0 0 20px', color: '#737373', fontSize: 12, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ background: '#FFFFFF', color: '#111111', border: '0.5px solid #D1D5DB', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={onConfirm} style={{ background: '#991B1B', color: '#FFFFFF', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

function InlineRename({ value, onSave, onCancel }) {
  const [val, setVal] = useState(value)
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  function commit() {
    const trimmed = val.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    else onCancel()
  }

  return (
    <input
      ref={ref}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel() }}
      onClick={e => e.stopPropagation()}
      style={{
        flex: 1, background: 'transparent', border: 'none', outline: 'none',
        borderBottom: '0.5px solid #3D3D3D',
        color: '#F5F5F5', fontSize: 12, fontFamily: 'inherit',
        padding: '0 2px', minWidth: 0,
      }}
    />
  )
}

export default function Sidebar({ user, conversations, apps, onConversationsChange, onAppsChange, onConversationRename, onAppRename }) {
  const navigate = useNavigate()
  const { convId } = useParams()

  const [hoveredId, setHoveredId]       = useState(null)
  const [renamingId, setRenamingId]     = useState(null)
  const [confirmDelete, setConfirmDelete]         = useState(null)
  const [showTrash, setShowTrash]                 = useState(false)
  const [trashedItems, setTrashedItems]           = useState([]) // { id, title, type, deleted_at }
  const [confirmClearTrash, setConfirmClearTrash] = useState(false)
  const [confirmPermDelete, setConfirmPermDelete] = useState(null)

  useEffect(() => { if (showTrash && user) loadTrash() }, [showTrash, user])

  async function loadTrash() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: convs }, { data: appsData }] = await Promise.all([
      supabase.from('conversations').select('id,title,deleted_at').eq('user_id', user.id).eq('deleted', true).gte('deleted_at', cutoff).order('deleted_at', { ascending: false }),
      supabase.from('generated_apps').select('id,title,deleted_at').eq('user_id', user.id).eq('deleted', true).gte('deleted_at', cutoff).order('deleted_at', { ascending: false }),
    ])

    const all = [
      ...(convs || []).map(c => ({ ...c, type: 'chat' })),
      ...(appsData || []).map(a => ({ ...a, type: 'app' })),
    ].sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at))

    setTrashedItems(all)
  }

  async function createConversation() {
    const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, title: 'New conversation' }).select().single()
    if (!error && data) { onConversationsChange(); navigate(`/workspace/${data.id}`) }
  }

  function requestDelete(id, title, type) {
    setConfirmDelete({ id, title, type })
  }

  async function confirmDoDelete() {
    if (!confirmDelete) return
    const { id, type } = confirmDelete
    setConfirmDelete(null)
    const table = type === 'app' ? 'generated_apps' : 'conversations'
    await supabase.from(table).update({ deleted: true, deleted_at: new Date().toISOString() }).eq('id', id)
    if (type === 'chat') {
      if (convId === id) navigate('/workspace')
      onConversationsChange()
    } else {
      onAppsChange()
    }
  }

  async function restoreItem(item) {
    const table = item.type === 'app' ? 'generated_apps' : 'conversations'
    await supabase.from(table).update({ deleted: false, deleted_at: null }).eq('id', item.id)
    await loadTrash()
    if (item.type === 'chat') onConversationsChange(); else onAppsChange()
  }

  async function permanentlyDeleteItem(item) {
    const table = item.type === 'app' ? 'generated_apps' : 'conversations'
    await supabase.from(table).delete().eq('id', item.id)
    setConfirmPermDelete(null)
    await loadTrash()
  }

  async function clearTrash() {
    const chatIds = trashedItems.filter(i => i.type === 'chat').map(i => i.id)
    const appIds  = trashedItems.filter(i => i.type === 'app').map(i => i.id)
    await Promise.all([
      chatIds.length && supabase.from('conversations').delete().in('id', chatIds),
      appIds.length  && supabase.from('generated_apps').delete().in('id', appIds),
    ])
    setConfirmClearTrash(false)
    setTrashedItems([])
    onConversationsChange(); onAppsChange()
  }

  async function renameConversation(id, title) {
    await supabase.from('conversations').update({ title }).eq('id', id)
    onConversationRename(id, title)
    setRenamingId(null)
  }

  async function renameApp(id, title) {
    await supabase.from('generated_apps').update({ title }).eq('id', id)
    onAppRename(id, title)
    setRenamingId(null)
  }

  const daysLeft = (deletedAt) => Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt)) / 86400000))
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : '??'

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.type === 'app' ? 'app' : 'conversation'}?`}
          message={`"${confirmDelete.title}" will be moved to Trash. You can recover it within 30 days.`}
          onConfirm={confirmDoDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {confirmClearTrash && (
        <ConfirmDialog
          title="Clear Trash?"
          message="All items in Trash will be permanently deleted. This cannot be undone."
          onConfirm={clearTrash}
          onCancel={() => setConfirmClearTrash(false)}
        />
      )}
      {confirmPermDelete && (
        <ConfirmDialog
          title="Delete permanently?"
          message={`"${confirmPermDelete.title}" will be gone forever. This cannot be undone.`}
          onConfirm={() => permanentlyDeleteItem(confirmPermDelete)}
          onCancel={() => setConfirmPermDelete(null)}
        />
      )}

      <div style={{ width: 220, flexShrink: 0, background: '#0A0A0A', borderRight: '0.5px solid #1A1A1A', display: 'flex', flexDirection: 'column', height: '100vh' }}>

        {/* Logo + New app */}
        <div style={{ padding: '18px 16px 12px' }}>
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.4px', background: glareGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>aria.</span>
          </div>
          <button
            onClick={createConversation}
            style={{ width: '100%', background: glareGradient, color: '#111111', border: '0.5px solid #484848', borderRadius: 7, fontSize: 12, fontWeight: 500, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="#E8E8E8" strokeWidth="1.5" strokeLinecap="round"/></svg>
            New app
          </button>
        </div>

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>

          {/* Chats */}
          {conversations.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ padding: '6px 8px', fontSize: 10, color: '#3D3D3D', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Chats</div>
              {conversations.map(conv => {
                const isActive  = conv.id === convId
                const isHovered = hoveredId === conv.id
                const hasApp    = apps.some(a => a.conversation_id === conv.id)
                const isRenaming = renamingId === conv.id

                return (
                  <div
                    key={conv.id}
                    onMouseEnter={() => setHoveredId(conv.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => !isRenaming && navigate(`/workspace/${conv.id}`)}
                    onDoubleClick={() => setRenamingId(conv.id)}
                    style={{
                      padding: '7px 10px', borderRadius: 6, fontSize: 12,
                      display: 'flex', alignItems: 'center', gap: 8,
                      cursor: isRenaming ? 'text' : 'pointer',
                      background: isActive ? '#1F1F1F' : isHovered ? '#141414' : 'transparent',
                      color: isActive ? '#D4D4D4' : '#525252',
                      border: isActive ? '0.5px solid #2E2E2E' : '0.5px solid transparent',
                      marginBottom: 1,
                    }}
                  >
                    <Dot variant={hasApp ? 'deployed' : isActive ? 'active' : 'default'} />
                    {isRenaming ? (
                      <InlineRename
                        value={conv.title}
                        onSave={title => renameConversation(conv.id, title)}
                        onCancel={() => setRenamingId(null)}
                      />
                    ) : (
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title}</span>
                    )}
                    {isHovered && !isRenaming && (
                      <button
                        onClick={e => { e.stopPropagation(); requestDelete(conv.id, conv.title, 'chat') }}
                        style={{ background: 'transparent', border: 'none', color: '#525252', cursor: 'pointer', padding: '2px', borderRadius: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
                        onMouseLeave={e => e.currentTarget.style.color = '#525252'}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Apps */}
          {apps.length > 0 && (
            <div>
              <div style={{ padding: '6px 8px', fontSize: 10, color: '#3D3D3D', letterSpacing: '0.06em', textTransform: 'uppercase' }}>My Apps</div>
              {apps.map(app => {
                const isHovered  = hoveredId === `app-${app.id}`
                const isRenaming = renamingId === `app-${app.id}`
                return (
                  <div
                    key={app.id}
                    onMouseEnter={() => setHoveredId(`app-${app.id}`)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => !isRenaming && window.open(`/app/${app.slug}`, '_blank')}
                    onDoubleClick={() => setRenamingId(`app-${app.id}`)}
                    style={{
                      padding: '7px 10px', borderRadius: 6, fontSize: 12,
                      display: 'flex', alignItems: 'center', gap: 8,
                      cursor: isRenaming ? 'text' : 'pointer',
                      color: '#525252', marginBottom: 1,
                      background: isHovered ? '#141414' : 'transparent',
                      border: '0.5px solid transparent',
                    }}
                  >
                    <Dot variant="deployed" />
                    {isRenaming ? (
                      <InlineRename
                        value={app.title}
                        onSave={title => renameApp(app.id, title)}
                        onCancel={() => setRenamingId(null)}
                      />
                    ) : (
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.title}</span>
                    )}
                    {isHovered && !isRenaming && (
                      <button
                        onClick={e => { e.stopPropagation(); requestDelete(app.id, app.title, 'app') }}
                        style={{ background: 'transparent', border: 'none', color: '#525252', cursor: 'pointer', padding: '2px', borderRadius: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
                        onMouseLeave={e => e.currentTarget.style.color = '#525252'}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Trash */}
        <div style={{ padding: '0 8px 4px' }}>
          <button
            onClick={() => { setShowTrash(v => !v); if (!showTrash) loadTrash() }}
            style={{ width: '100%', background: 'transparent', border: 'none', borderRadius: 6, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#3D3D3D', fontSize: 12, fontFamily: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#141414'; e.currentTarget.style.color = '#737373' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3D3D3D' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M4.5 3V2h3v1M2.5 3l.5 7h6l.5-7H2.5z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Trash
            {trashedItems.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 10, background: '#1F1F1F', color: '#525252', borderRadius: 10, padding: '1px 6px' }}>
                {trashedItems.length}
              </span>
            )}
          </button>

          {showTrash && (
            <div style={{ background: '#111', border: '0.5px solid #1E1E1E', borderRadius: 8, padding: '8px', marginBottom: 4, maxHeight: 240, overflowY: 'auto' }}>
              {trashedItems.length === 0 ? (
                <p style={{ margin: 0, fontSize: 11, color: '#3D3D3D', textAlign: 'center', padding: '12px 0' }}>Trash is empty</p>
              ) : (
                <>
                  {trashedItems.map(item => (
                    <div key={`${item.type}-${item.id}`} style={{ padding: '7px 8px', borderRadius: 5, marginBottom: 3, background: '#161616', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Tag label={item.type === 'app' ? 'App' : 'Chat'} color={item.type} />
                        <span style={{ fontSize: 11, color: '#737373', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: '#3D3D3D' }}>{daysLeft(item.deleted_at)}d left</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => restoreItem(item)}
                            style={{ background: 'transparent', border: 'none', color: '#525252', fontSize: 10, cursor: 'pointer', padding: '1px 4px', fontFamily: 'inherit' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#34D399'}
                            onMouseLeave={e => e.currentTarget.style.color = '#525252'}
                          >Restore</button>
                          <button
                            onClick={() => setConfirmPermDelete(item)}
                            style={{ background: 'transparent', border: 'none', color: '#525252', fontSize: 10, cursor: 'pointer', padding: '1px 4px', fontFamily: 'inherit' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
                            onMouseLeave={e => e.currentTarget.style.color = '#525252'}
                          >Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setConfirmClearTrash(true)}
                    style={{ width: '100%', background: 'transparent', border: '0.5px solid #2A2A2A', borderRadius: 5, color: '#F87171', fontSize: 10, cursor: 'pointer', padding: '6px', marginTop: 4, fontFamily: 'inherit' }}
                  >
                    Clear Trash
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Profile */}
        <div style={{ borderTop: '0.5px solid #1A1A1A', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #2A2A2A, #4A4A4A)', border: '0.5px solid #3D3D3D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 600, color: '#D4D4D4' }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#A3A3A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
            <div style={{ fontSize: 10, color: '#525252' }}>Pro plan</div>
          </div>
        </div>
      </div>
    </>
  )
}

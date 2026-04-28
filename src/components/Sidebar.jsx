import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

function Dot({ variant }) {
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
      background: variant === 'deployed' ? '#34D399'
        : variant === 'active' ? '#A3A3A3'
        : '#2A2A2A',
      border: variant === 'deployed' ? '1px solid #34D39966'
        : variant === 'active' ? '1px solid #3D3D3D'
        : '1px solid #2A2A2A',
    }} />
  )
}

function TrashIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 3h8M5 3V2h2v1M4 3v7h4V3H4z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#161616',
          border: '0.5px solid #2A2A2A',
          borderRadius: 12,
          padding: '24px',
          maxWidth: 340,
          width: '90vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <h3 style={{ margin: '0 0 8px', color: '#F5F5F5', fontSize: 14, fontWeight: 600 }}>{title}</h3>
        <p style={{ margin: '0 0 20px', color: '#737373', fontSize: 12, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: '#FFFFFF', color: '#111111',
              border: '0.5px solid #D1D5DB',
              borderRadius: 7, padding: '8px 16px',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: '#991B1B', color: '#FFFFFF',
              border: 'none',
              borderRadius: 7, padding: '8px 16px',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({ user, conversations, apps, onConversationsChange }) {
  const navigate = useNavigate()
  const { convId } = useParams()
  const [hoveredId, setHoveredId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, title, type }
  const [showTrash, setShowTrash] = useState(false)
  const [trashedConvs, setTrashedConvs] = useState([])
  const [confirmClearTrash, setConfirmClearTrash] = useState(false)
  const [confirmRestoreAll, setConfirmRestoreAll] = useState(null) // { id, title }
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(null)

  useEffect(() => {
    if (showTrash && user) loadTrash()
  }, [showTrash, user])

  async function loadTrash() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('deleted', true)
      .gte('deleted_at', thirtyDaysAgo)
      .order('deleted_at', { ascending: false })
    setTrashedConvs(data || [])
  }

  async function createConversation() {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, title: 'New conversation' })
      .select()
      .single()
    if (!error && data) {
      onConversationsChange()
      navigate(`/workspace/${data.id}`)
    }
  }

  function requestDelete(conv) {
    setConfirmDelete({ id: conv.id, title: conv.title })
  }

  async function confirmDeleteConv() {
    if (!confirmDelete) return
    const { id } = confirmDelete
    setConfirmDelete(null)

    await supabase.from('conversations').update({
      deleted: true,
      deleted_at: new Date().toISOString(),
    }).eq('id', id)

    if (convId === id) navigate('/workspace')
    onConversationsChange()
  }

  async function restoreConversation(id) {
    await supabase.from('conversations').update({
      deleted: false,
      deleted_at: null,
    }).eq('id', id)
    await loadTrash()
    onConversationsChange()
  }

  async function permanentlyDelete(id) {
    await supabase.from('conversations').delete().eq('id', id)
    setConfirmPermanentDelete(null)
    await loadTrash()
    onConversationsChange()
  }

  async function clearTrash() {
    const ids = trashedConvs.map(c => c.id)
    if (ids.length > 0) {
      await supabase.from('conversations').delete().in('id', ids)
    }
    setConfirmClearTrash(false)
    setTrashedConvs([])
  }

  const daysLeft = (deletedAt) => {
    const diff = 30 - Math.floor((Date.now() - new Date(deletedAt)) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : '??'

  return (
    <>
      {/* Confirmation dialogs */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete conversation?"
          message={`"${confirmDelete.title}" will be moved to Trash. You can recover it within 30 days.`}
          onConfirm={confirmDeleteConv}
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
      {confirmPermanentDelete && (
        <ConfirmDialog
          title="Delete permanently?"
          message={`"${confirmPermanentDelete.title}" will be gone forever. This cannot be undone.`}
          onConfirm={() => permanentlyDelete(confirmPermanentDelete.id)}
          onCancel={() => setConfirmPermanentDelete(null)}
        />
      )}

      <div style={{
        width: 220, flexShrink: 0,
        background: '#0A0A0A',
        borderRight: '0.5px solid #1A1A1A',
        display: 'flex', flexDirection: 'column',
        height: '100vh',
      }}>
        <div style={{ padding: '18px 16px 12px' }}>
          <div style={{ marginBottom: 14 }}>
            <span style={{
              fontSize: 16, fontWeight: 500, letterSpacing: '-0.4px',
              background: glareGradient,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>aria.</span>
          </div>
          <button
            onClick={createConversation}
            style={{
              width: '100%', background: glareGradient, color: '#111111',
              border: '0.5px solid #484848', borderRadius: 7,
              fontSize: 12, fontWeight: 500, padding: '7px 10px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="#E8E8E8" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            New app
          </button>
        </div>

        {/* Main scrollable area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {conversations.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ padding: '6px 8px', fontSize: 10, color: '#3D3D3D', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Recent
              </div>
              {conversations.map(conv => {
                const isActive = conv.id === convId
                const hasApp = apps.some(a => a.conversation_id === conv.id)
                const isHovered = hoveredId === conv.id
                return (
                  <div
                    key={conv.id}
                    onMouseEnter={() => setHoveredId(conv.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      background: isActive ? '#1F1F1F' : isHovered ? '#141414' : 'transparent',
                      color: isActive ? '#D4D4D4' : '#525252',
                      border: isActive ? '0.5px solid #2E2E2E' : '0.5px solid transparent',
                      marginBottom: 1,
                      position: 'relative',
                    }}
                    onClick={() => navigate(`/workspace/${conv.id}`)}
                  >
                    <Dot variant={hasApp ? 'deployed' : isActive ? 'active' : 'default'} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.title}
                    </span>
                    {isHovered && (
                      <button
                        onClick={e => { e.stopPropagation(); requestDelete(conv) }}
                        title="Delete"
                        style={{
                          background: 'transparent', border: 'none',
                          color: '#525252', cursor: 'pointer',
                          padding: '2px 4px', borderRadius: 4,
                          display: 'flex', alignItems: 'center',
                          flexShrink: 0,
                          transition: 'color 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
                        onMouseLeave={e => e.currentTarget.style.color = '#525252'}
                      >
                        <TrashIcon size={11} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {apps.length > 0 && (
            <div>
              <div style={{ padding: '6px 8px', fontSize: 10, color: '#3D3D3D', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                My Apps
              </div>
              {apps.map(app => (
                <div
                  key={app.id}
                  onClick={() => window.open(`/app/${app.slug}`, '_blank')}
                  style={{
                    padding: '7px 10px', borderRadius: 6, fontSize: 12,
                    display: 'flex', alignItems: 'center', gap: 8,
                    cursor: 'pointer', color: '#525252', marginBottom: 1,
                  }}
                >
                  <Dot variant="deployed" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {app.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trash section */}
        <div style={{ padding: '0 8px 4px' }}>
          <button
            onClick={() => setShowTrash(v => !v)}
            style={{
              width: '100%', background: 'transparent', border: 'none',
              borderRadius: 6, padding: '7px 10px',
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', color: '#3D3D3D',
              fontSize: 12, fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#141414'; e.currentTarget.style.color = '#737373' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3D3D3D' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1.5 3h9M4.5 3V2h3v1M2.5 3l.5 7h6l.5-7H2.5z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Trash</span>
            {trashedConvs.length > 0 && showTrash && (
              <span style={{
                marginLeft: 'auto', fontSize: 10,
                background: '#1F1F1F', color: '#525252',
                borderRadius: 10, padding: '1px 6px',
              }}>{trashedConvs.length}</span>
            )}
          </button>

          {showTrash && (
            <div style={{
              background: '#111', border: '0.5px solid #1E1E1E',
              borderRadius: 8, padding: '8px',
              marginBottom: 4, maxHeight: 220, overflowY: 'auto',
            }}>
              {trashedConvs.length === 0 ? (
                <p style={{ margin: 0, fontSize: 11, color: '#3D3D3D', textAlign: 'center', padding: '12px 0' }}>
                  Trash is empty
                </p>
              ) : (
                <>
                  {trashedConvs.map(conv => (
                    <div key={conv.id} style={{
                      padding: '6px 8px', borderRadius: 5, marginBottom: 2,
                      display: 'flex', flexDirection: 'column', gap: 3,
                      background: '#161616',
                    }}>
                      <span style={{ fontSize: 11, color: '#737373', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.title}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: '#3D3D3D' }}>
                          {daysLeft(conv.deleted_at)}d left
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => restoreConversation(conv.id)}
                            style={{
                              background: 'transparent', border: 'none',
                              color: '#525252', fontSize: 10, cursor: 'pointer',
                              padding: '1px 4px', fontFamily: 'inherit',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#34D399'}
                            onMouseLeave={e => e.currentTarget.style.color = '#525252'}
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => setConfirmPermanentDelete({ id: conv.id, title: conv.title })}
                            style={{
                              background: 'transparent', border: 'none',
                              color: '#525252', fontSize: 10, cursor: 'pointer',
                              padding: '1px 4px', fontFamily: 'inherit',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
                            onMouseLeave={e => e.currentTarget.style.color = '#525252'}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setConfirmClearTrash(true)}
                    style={{
                      width: '100%', background: 'transparent',
                      border: '0.5px solid #2A2A2A', borderRadius: 5,
                      color: '#F87171', fontSize: 10, cursor: 'pointer',
                      padding: '6px', marginTop: 4, fontFamily: 'inherit',
                    }}
                  >
                    Clear Trash
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Profile footer */}
        <div style={{
          borderTop: '0.5px solid #1A1A1A', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #2A2A2A, #4A4A4A)',
            border: '0.5px solid #3D3D3D',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 10, fontWeight: 600, color: '#D4D4D4',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#A3A3A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
            <div style={{ fontSize: 10, color: '#525252' }}>Pro plan</div>
          </div>
        </div>
      </div>
    </>
  )
}

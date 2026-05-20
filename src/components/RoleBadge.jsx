import React, { useState, useEffect } from 'react'
import { ROLES, SENIORITY_LEVELS, getRole, getSeniority } from '../lib/roles'
import { logAction } from '../lib/devlog'

/**
 * RoleBadge — shows the active role for the current chat, with a click-to-
 * override modal. Overrides write back to the conversation row so the chat
 * keeps using the new role until explicitly changed again.
 */
export default function RoleBadge({ conversation, onOverride }) {
  const [open, setOpen] = useState(false)
  const [draftRole, setDraftRole] = useState('')
  const [draftSeniority, setDraftSeniority] = useState('')
  const [draftCustom, setDraftCustom] = useState('')

  useEffect(() => {
    if (!conversation) return
    setDraftRole(conversation.role_context || '')
    setDraftSeniority(conversation.seniority_context || '')
    setDraftCustom(conversation.custom_role_context || '')
  }, [conversation])

  if (!conversation) return null

  const roleId = conversation.role_context
  const role = getRole(roleId)
  const seniority = getSeniority(conversation.seniority_context)
  const label = (roleId === 'other' && conversation.custom_role_context)
    ? conversation.custom_role_context
    : (role?.label || 'No role')

  async function save() {
    await onOverride?.({
      role_context: draftRole || null,
      custom_role_context: draftRole === 'other' ? (draftCustom.trim() || null) : null,
      seniority_context: draftSeniority || null,
      role_overridden: true,
    })
    logAction('chat.role_overridden', {
      conversationId: conversation.id,
      newRole: draftRole, newSeniority: draftSeniority,
    })
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Change role for this chat"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#141414', border: '0.5px solid #2A2A2A',
          borderRadius: 6, padding: '3px 9px',
          fontSize: 11, color: '#A3A3A3',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#3D3D3D'; e.currentTarget.style.color = '#E5E5E5' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A2A'; e.currentTarget.style.color = '#A3A3A3' }}
      >
        <span style={{ fontSize: 12 }}>{role?.icon || '✦'}</span>
        <span>{label}</span>
        {seniority && <span style={{ color: '#525252' }}>· {seniority.label}</span>}
        {conversation.role_overridden && (
          <span style={{ color: '#F59E0B', fontSize: 10 }}>override</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#0D0D0D', border: '0.5px solid #2A2A2A',
            borderRadius: 12, padding: 22, maxWidth: 460, width: '100%',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div>
              <h3 style={{ color: '#F5F5F5', fontSize: 16, fontWeight: 500, margin: '0 0 4px' }}>Role for this chat</h3>
              <p style={{ color: '#525252', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                Override the role context for this chat only. Your profile role stays unchanged.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#A3A3A3', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Role</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {ROLES.map(r => {
                  const isSelected = draftRole === r.id
                  return (
                    <button key={r.id} onClick={() => setDraftRole(r.id)}
                      style={{
                        background: isSelected ? '#1A1A1A' : '#141414',
                        border: `0.5px solid ${isSelected ? '#3D3D3D' : '#222'}`,
                        borderRadius: 6, padding: '7px 10px',
                        display: 'flex', alignItems: 'center', gap: 7,
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      }}>
                      <span style={{ fontSize: 12 }}>{r.icon}</span>
                      <span style={{ fontSize: 11, color: isSelected ? '#E5E5E5' : '#737373' }}>{r.label}</span>
                    </button>
                  )
                })}
              </div>
              {draftRole === 'other' && (
                <input
                  type="text" value={draftCustom}
                  onChange={e => setDraftCustom(e.target.value)}
                  placeholder="Describe the role"
                  style={{
                    width: '100%', marginTop: 8,
                    background: '#141414', border: '0.5px solid #2A2A2A',
                    borderRadius: 7, color: '#F5F5F5', padding: '8px 12px',
                    fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#A3A3A3', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Seniority</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SENIORITY_LEVELS.map(s => {
                  const isSelected = draftSeniority === s.id
                  return (
                    <button key={s.id} onClick={() => setDraftSeniority(s.id)}
                      style={{
                        background: isSelected ? '#1E1E1E' : '#141414',
                        border: `0.5px solid ${isSelected ? '#3D3D3D' : '#222'}`,
                        borderRadius: 6, padding: '5px 11px',
                        fontSize: 11, color: isSelected ? '#D4D4D4' : '#737373',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setOpen(false)} style={{
                background: 'transparent', color: '#737373',
                border: '0.5px solid #2A2A2A', borderRadius: 7,
                padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button onClick={save}
                disabled={!draftRole || (draftRole === 'other' && !draftCustom.trim())}
                style={{
                  background: '#E5E5E5', color: '#111', borderRadius: 7,
                  border: '0.5px solid #484848',
                  padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: (!draftRole || (draftRole === 'other' && !draftCustom.trim())) ? 0.4 : 1,
                }}>Save override</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

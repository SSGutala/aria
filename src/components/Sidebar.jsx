import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

function Dot({ variant }) {
  const styles = {
    deployed: { background: '#0A2A1A', border: '1px solid #34D399' },
    active: { background: glareGradient },
    default: { background: '#1A1A1A', border: '1px solid #2A2A2A' },
  }
  const s = styles[variant] || styles.default
  return (
    <div style={{
      width: 6, height: 6,
      borderRadius: '50%',
      flexShrink: 0,
      ...(variant === 'active'
        ? { background: glareGradient }
        : { background: s.background, border: s.border }),
    }} />
  )
}

export default function Sidebar({ user, conversations, apps, onConversationsChange }) {
  const navigate = useNavigate()
  const { convId } = useParams()

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

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : '??'

  return (
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
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '-0.4px',
            background: glareGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>aria.</span>
        </div>
        <button
          onClick={createConversation}
          style={{
            width: '100%',
            background: glareGradient,
            color: '#111111',
            border: '0.5px solid #484848',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 500,
            padding: '7px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="#E8E8E8" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          New app
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {conversations.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ padding: '6px 8px', fontSize: 10, color: '#3D3D3D', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Recent
            </div>
            {conversations.map(conv => {
              const isActive = conv.id === convId
              const hasApp = apps.some(a => a.conversation_id === conv.id)
              return (
                <div
                  key={conv.id}
                  onClick={() => navigate(`/workspace/${conv.id}`)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    background: isActive ? '#1F1F1F' : 'transparent',
                    color: isActive ? '#D4D4D4' : '#525252',
                    border: isActive ? '0.5px solid #2E2E2E' : '0.5px solid transparent',
                    marginBottom: 1,
                  }}
                >
                  <Dot variant={hasApp ? 'deployed' : isActive ? 'active' : 'default'} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.title}
                  </span>
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
                  padding: '7px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  color: '#525252',
                  marginBottom: 1,
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

      <div style={{
        borderTop: '0.5px solid #1A1A1A',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #2A2A2A, #4A4A4A)',
          border: '0.5px solid #3D3D3D',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontSize: 10, fontWeight: 600, color: '#D4D4D4',
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
  )
}

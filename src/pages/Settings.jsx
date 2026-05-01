import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { API_URL } from '../lib/api'

const API = API_URL

export default function Settings() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState(null)
  const [m365Status, setM365Status] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) loadM365Status(user.id)
    })
  }, [])

  // Handle redirect back from OAuth
  useEffect(() => {
    const m365Param = searchParams.get('m365')
    if (m365Param === 'connected') {
      showToast('Microsoft 365 connected successfully!', 'success')
      if (user) loadM365Status(user.id)
    } else if (m365Param === 'error') {
      const msg = searchParams.get('msg') || 'Connection failed'
      showToast(msg, 'error')
    }
  }, [searchParams, user])

  async function loadM365Status(userId) {
    setLoadingStatus(true)
    try {
      const res = await fetch(`${API}/api/m365/status?userId=${userId}`)
      const data = await res.json()
      setM365Status(data)
    } catch {
      setM365Status({ connected: false })
    } finally {
      setLoadingStatus(false)
    }
  }

  function connectM365() {
    if (!user) return
    window.location.href = `${API}/api/m365/auth?userId=${user.id}`
  }

  async function disconnectM365() {
    if (!user) return
    setDisconnecting(true)
    try {
      await fetch(`${API}/api/m365/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      setM365Status({ connected: false })
      showToast('Microsoft 365 disconnected.', 'info')
    } catch {
      showToast('Failed to disconnect.', 'error')
    } finally {
      setDisconnecting(false)
    }
  }

  function showToast(message, type = 'info') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div style={{ background: '#111111', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#E5E5E5' }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 100,
          background: toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#DC2626' : '#374151',
          color: '#fff', borderRadius: 10, padding: '12px 18px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'fadeIn 0.2s ease', maxWidth: 320,
        }}>
          {toast.message}
        </div>
      )}

      {/* Topbar */}
      <div style={{ background: '#161616', borderBottom: '1px solid #1E1E1E', padding: '0 28px', height: 54, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#525252', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <span style={{ color: '#2A2A2A' }}>·</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#E5E5E5' }}>Settings</span>
      </div>

      <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F5F5F5', marginBottom: 6, letterSpacing: '-0.4px' }}>Integrations</h1>
        <p style={{ fontSize: 13, color: '#525252', margin: '0 0 32px' }}>Connect external services so Aria-generated apps can write to SharePoint, send via Outlook, and post to Teams.</p>

        {/* M365 Integration Card */}
        <div style={{ background: '#161616', border: '1px solid #1E1E1E', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          {/* Card header */}
          <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Microsoft logo */}
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="1" y="1" width="9.5" height="9.5" fill="#F25022"/>
                <rect x="11.5" y="1" width="9.5" height="9.5" fill="#7FBA00"/>
                <rect x="1" y="11.5" width="9.5" height="9.5" fill="#00A4EF"/>
                <rect x="11.5" y="11.5" width="9.5" height="9.5" fill="#FFB900"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F5' }}>Microsoft 365</div>
              <div style={{ fontSize: 12, color: '#525252', marginTop: 2 }}>Outlook · SharePoint · Teams · OneDrive</div>
            </div>
            {loadingStatus ? (
              <div style={{ width: 16, height: 16, border: '2px solid #2A2A2A', borderTopColor: '#525252', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : m365Status?.connected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#052e16', border: '1px solid #14532d', borderRadius: 20, padding: '4px 12px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ fontSize: 11, color: '#86efac', fontWeight: 600 }}>Connected</span>
              </div>
            ) : (
              <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 20, padding: '4px 12px' }}>
                <span style={{ fontSize: 11, color: '#525252', fontWeight: 600 }}>Not connected</span>
              </div>
            )}
          </div>

          {/* Connected state details */}
          {m365Status?.connected && (
            <div style={{ borderTop: '1px solid #1A1A1A', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 20 }}>
                <InfoField label="Account" value={m365Status.displayName || '—'} />
                <InfoField label="Email" value={m365Status.email || '—'} />
                <InfoField label="Connected" value={m365Status.connectedAt ? new Date(m365Status.connectedAt).toLocaleDateString() : '—'} />
              </div>

              {/* What's enabled */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#2A2A2A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Available capabilities</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Send emails via Outlook', 'Write to SharePoint lists', 'Post to Teams channels', 'Generate & deliver documents'].map(cap => (
                    <div key={cap} style={{ background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {cap}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={connectM365} style={{ background: '#1A1A1A', color: '#A3A3A3', border: '1px solid #2A2A2A', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                  Reconnect
                </button>
                <button onClick={disconnectM365} disabled={disconnecting} style={{ background: 'none', color: '#525252', border: '1px solid #1E1E1E', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>
          )}

          {/* Not connected CTA */}
          {!loadingStatus && !m365Status?.connected && (
            <div style={{ borderTop: '1px solid #1A1A1A', padding: '16px 22px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: '#525252', lineHeight: 1.6 }}>
                Connect your M365 account so Aria can send emails via Outlook, write submissions to SharePoint, post notifications to Teams, and deliver generated documents — all within your Microsoft tenant.
              </p>
              <button onClick={connectM365} style={{ background: '#0078d4', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
                Connect Microsoft 365
              </button>
            </div>
          )}
        </div>

        {/* Coming soon cards */}
        {[
          { name: 'Google Workspace', desc: 'Gmail · Drive · Sheets · Calendar', icon: '🔵', soon: true },
          { name: 'Slack', desc: 'Channel notifications · DM alerts', icon: '💬', soon: true },
          { name: 'Salesforce', desc: 'Create records · Update opportunities', icon: '☁️', soon: true },
        ].map(item => (
          <div key={item.name} style={{ background: '#161616', border: '1px solid #1A1A1A', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, opacity: 0.5 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#A3A3A3' }}>{item.name}</div>
              <div style={{ fontSize: 11, color: '#2A2A2A', marginTop: 2 }}>{item.desc}</div>
            </div>
            <div style={{ background: '#1A1A1A', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#525252', fontWeight: 600 }}>Coming soon</div>
          </div>
        ))}

        {/* Azure AD setup guide */}
        {!m365Status?.connected && (
          <div style={{ background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 14, padding: '20px 22px', marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd', marginBottom: 12 }}>Setting up Microsoft 365 connection</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { step: '1', text: 'Go to portal.azure.com → Azure Active Directory → App Registrations → New Registration' },
                { step: '2', text: 'Name it "Aria", set Redirect URI to: http://localhost:3001/api/m365/callback' },
                { step: '3', text: 'Under API Permissions add: User.Read, Mail.Send, Sites.ReadWrite.All, ChannelMessage.Send, Files.ReadWrite.All' },
                { step: '4', text: 'Create a Client Secret under Certificates & Secrets' },
                { step: '5', text: 'Add MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET to your .env.local file' },
              ].map(({ step, text }) => (
                <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1e3a5f', color: '#93c5fd', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{step}</div>
                  <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function InfoField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#2A2A2A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#A3A3A3', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

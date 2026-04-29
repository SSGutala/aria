import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function GeneratedApp() {
  const { slug } = useParams()
  const [app, setApp] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('generated_apps')
        .select('id, title, slug, generated_html, schema, workflow_type')
        .eq('slug', slug)
        .single()
      setApp(data || null)
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) return (
    <div style={{
      background: '#F8FAFC', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 36, height: 36,
          border: '3px solid #E5E7EB',
          borderTopColor: '#7C3AED',
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite',
          margin: '0 auto 14px',
        }} />
        <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500 }}>Loading app...</div>
      </div>
    </div>
  )

  if (!app) return (
    <div style={{
      background: '#F8FAFC', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#374151' }}>App not found</p>
        <p style={{ margin: '6px 0 0', fontSize: 13 }}>This link may be invalid or the app was deleted.</p>
      </div>
    </div>
  )

  // ── New apps: render generated HTML in a full-page iframe ──────────────────
  if (app.generated_html) {
    return (
      <iframe
        srcDoc={app.generated_html}
        title={app.title}
        style={{
          width: '100vw',
          height: '100vh',
          border: 'none',
          display: 'block',
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
      />
    )
  }

  // ── Legacy apps: fall back to old schema-based renderer ───────────────────
  return <LegacyRenderer app={app} />
}

// ─── Legacy renderer for apps built before the HTML generation system ─────────
function LegacyRenderer({ app }) {
  const [submissions, setSubmissions] = useState([])
  const [formData, setFormData] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [ticketId, setTicketId] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('All')

  const schema = app.schema || {}
  const fields = schema.fields || []
  const statusOptions = schema.statusOptions || []
  const displayFields = fields.filter(f => f.name !== 'status')
  const primary = schema.colorTheme?.primary || '#7C3AED'
  const light = schema.colorTheme?.light || '#F5F3FF'

  useEffect(() => {
    supabase.from('app_submissions').select('*').eq('app_id', app.id).order('submitted_at', { ascending: false })
      .then(({ data }) => setSubmissions(data || []))
  }, [app.id])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('http://localhost:3001/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: app.id, formData }),
      })
      const result = await res.json()
      setTicketId(result.ticketId)
      setSubmitted(true)
      const { data } = await supabase.from('app_submissions').select('*').eq('app_id', app.id).order('submitted_at', { ascending: false })
      setSubmissions(data || [])
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  async function handleStatusChange(subId, newStatus) {
    setUpdatingId(subId)
    try {
      await fetch('http://localhost:3001/api/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: subId, status: newStatus, appId: app.id }),
      })
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: newStatus } : s))
    } finally { setUpdatingId(null) }
  }

  const visible = filterStatus === 'All' ? submissions : submissions.filter(s => s.status === filterStatus)

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ background: '#fff', borderBottom: '1px solid #F3F4F6', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: primary, flexShrink: 0 }} />
        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{app.title}</div>
        <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>{submissions.length} entries</span>
      </div>
      <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px', display: 'flex', gap: 20 }}>
        <div style={{ width: 340, flexShrink: 0 }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F3F4F6', overflow: 'hidden' }}>
            <div style={{ background: primary, padding: '16px 20px' }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{schema.primaryActionLabel || 'New Entry'}</div>
            </div>
            <div style={{ padding: '20px' }}>
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Submitted — {ticketId}</div>
                  <button onClick={() => { setFormData({}); setSubmitted(false) }} style={{ background: primary, color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, cursor: 'pointer', marginTop: 12 }}>Submit another</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {displayFields.map(f => (
                    <div key={f.name}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</label>
                      {f.type === 'textarea' ? (
                        <textarea value={formData[f.name] || ''} onChange={e => setFormData(p => ({ ...p, [f.name]: e.target.value }))} rows={3} style={{ width: '100%', boxSizing: 'border-box', background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
                      ) : f.type === 'select' ? (
                        <select value={formData[f.name] || ''} onChange={e => setFormData(p => ({ ...p, [f.name]: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                          <option value="">Select...</option>
                          {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={f.type || 'text'} value={formData[f.name] || ''} onChange={e => setFormData(p => ({ ...p, [f.name]: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                      )}
                    </div>
                  ))}
                  <button type="submit" disabled={submitting} style={{ background: primary, color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {submitting ? 'Submitting...' : schema.primaryActionLabel || 'Submit'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F3F4F6', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F9FAFB', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['All', ...statusOptions].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{ background: filterStatus === s ? primary : '#F9FAFB', color: filterStatus === s ? '#fff' : '#6B7280', border: filterStatus === s ? 'none' : '1px solid #E5E7EB', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
              ))}
            </div>
            {visible.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9CA3AF' }}>No submissions yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#FAFAFA' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>#</th>
                  {displayFields.slice(0, 3).map(f => <th key={f.name} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>{f.label}</th>)}
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Status</th>
                </tr></thead>
                <tbody>
                  {visible.map(sub => (
                    <tr key={sub.id} style={{ borderTop: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: '#9CA3AF' }}>{sub.ticket_id}</td>
                      {displayFields.slice(0, 3).map(f => <td key={f.name} style={{ padding: '12px 14px', fontSize: 13, color: '#374151', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(sub.data?.[f.name] ?? '')}</td>)}
                      <td style={{ padding: '12px 14px' }}>
                        <select value={sub.status} onChange={e => handleStatusChange(sub.id, e.target.value)} disabled={updatingId === sub.id} style={{ background: light, color: primary, border: `1px solid ${primary}44`, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', appearance: 'none' }}>
                          {statusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { submitForm, updateStatus } from '../lib/claude'

/* ─── Theme helpers ───────────────────────────────────────────────────── */
function getTheme(schema) {
  const ct = schema?.colorTheme
  return {
    primary:  ct?.primary  || '#7C3AED',
    light:    ct?.light    || '#F5F3FF',
    text:     ct?.text     || '#2E1065',
    name:     ct?.name     || 'violet',
  }
}

// Map status → semantic color set
const STATUS_PALETTE = [
  { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' }, // blue
  { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' }, // green
  { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' }, // red
  { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' }, // orange
  { bg: '#F5F3FF', text: '#6D28D9', dot: '#8B5CF6' }, // purple
  { bg: '#ECFEFF', text: '#0E7490', dot: '#06B6D4' }, // cyan
]

function statusColors(index) {
  return STATUS_PALETTE[index % STATUS_PALETTE.length]
}

/* ─── Field input ─────────────────────────────────────────────────────── */
function FieldInput({ field, value, onChange, primary }) {
  const base = {
    width: '100%', boxSizing: 'border-box',
    background: '#FAFAFA', border: '1.5px solid #E5E7EB',
    borderRadius: 8, color: '#111827',
    padding: '10px 13px', fontSize: 13, outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.15s, background 0.15s',
  }
  const focusOn  = e => { e.target.style.borderColor = primary; e.target.style.background = '#fff' }
  const focusOff = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.background = '#FAFAFA' }

  if (field.type === 'textarea') {
    return <textarea value={value || ''} onChange={e => onChange(field.name, e.target.value)}
      required={field.required} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
      rows={3} style={{ ...base, resize: 'vertical' }} onFocus={focusOn} onBlur={focusOff} />
  }
  if (field.type === 'select') {
    return (
      <select value={value || ''} onChange={e => onChange(field.name, e.target.value)}
        required={field.required} onFocus={focusOn} onBlur={focusOff}
        style={{ ...base, cursor: 'pointer', appearance: 'none', paddingRight: 36,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%239CA3AF' strokeWidth='1.5' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
        }}>
        <option value="">Select {field.label}...</option>
        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    )
  }
  return <input type={field.type || 'text'} value={value || ''}
    onChange={e => onChange(field.name, e.target.value)} required={field.required}
    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
    style={base} onFocus={focusOn} onBlur={focusOff} />
}

/* ─── Main component ──────────────────────────────────────────────────── */
export default function GeneratedApp() {
  const { slug } = useParams()
  const [app, setApp] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [formData, setFormData] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [ticketId, setTicketId] = useState('')
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('All')

  useEffect(() => {
    async function load() {
      const { data: appData } = await supabase.from('generated_apps').select('*').eq('slug', slug).single()
      if (!appData) { setLoading(false); return }
      setApp(appData)
      const { data: subs } = await supabase.from('app_submissions').select('*').eq('app_id', appData.id).order('submitted_at', { ascending: false })
      setSubmissions(subs || [])
      setLoading(false)
    }
    load()
  }, [slug])

  function handleFieldChange(name, value) { setFormData(prev => ({ ...prev, [name]: value }) )}

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      const result = await submitForm(app.id, formData)
      setTicketId(result.ticketId); setSubmitted(true)
      const { data: subs } = await supabase.from('app_submissions').select('*').eq('app_id', app.id).order('submitted_at', { ascending: false })
      setSubmissions(subs || [])
    } catch (err) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  async function handleStatusChange(submissionId, newStatus) {
    setUpdatingId(submissionId)
    try {
      await updateStatus(submissionId, newStatus, app.id)
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: newStatus } : s))
    } catch (err) { console.error(err) }
    finally { setUpdatingId(null) }
  }

  if (loading) return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #E5E7EB', borderTopColor: '#6B7280', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 13 }}>Loading...</div>
      </div>
    </div>
  )

  if (!app) return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
      App not found
    </div>
  )

  const schema       = app.schema || {}
  const fields       = schema.fields || []
  const statusOptions = schema.statusOptions || []
  const displayFields = fields.filter(f => f.name !== 'status')
  const { primary, light, text: textColor } = getTheme(schema)

  // Status → index for color
  const statusIndex = {}
  statusOptions.forEach((s, i) => { statusIndex[s] = i })

  // Stats per status
  const stats = statusOptions.map((s, i) => ({
    label: s,
    count: submissions.filter(sub => sub.status === s).length,
    colors: statusColors(i),
  }))
  const totalCount = submissions.length

  // Filtered list
  const visible = filterStatus === 'All' ? submissions : submissions.filter(s => s.status === filterStatus)

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .sub-row:hover { background: #FAFAFA !important; }
      `}</style>

      {/* ── Top nav ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F3F4F6', padding: '0 32px', height: 58, display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {'✦'}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', letterSpacing: '-0.3px', lineHeight: 1.1 }}>{app.title}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{schema.workflowType?.replace('_', ' ')}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Live</span>
        </div>
        <span style={{ color: '#9CA3AF', fontSize: 12, marginLeft: 2 }}>{totalCount} submission{totalCount !== 1 ? 's' : ''}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href).then(() => {})}
            style={{ background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
          >
            Share link
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F3F4F6', padding: '14px 32px', display: 'flex', gap: 12 }}>
        {/* Total */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: light, borderRadius: 9, border: `1px solid ${primary}22` }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: primary, lineHeight: 1 }}>{totalCount}</span>
          <span style={{ fontSize: 11, color: textColor, fontWeight: 500, lineHeight: 1.2 }}>Total</span>
        </div>
        {stats.map(({ label, count, colors }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: colors.bg, borderRadius: 9, border: `1px solid ${colors.dot}22` }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.dot, flexShrink: 0 }} />
            <span style={{ fontSize: 20, fontWeight: 800, color: colors.text, lineHeight: 1 }}>{count}</span>
            <span style={{ fontSize: 11, color: colors.text, fontWeight: 500, lineHeight: 1.2, maxWidth: 90, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 1200, margin: '28px auto', padding: '0 24px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* ── Form panel ── */}
        <div style={{ width: 370, flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #F3F4F6', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {/* Form header with colored top border */}
            <div style={{ borderTop: `4px solid ${primary}`, padding: '20px 24px 16px' }}>
              <h2 style={{ margin: '0 0 3px', fontSize: 16, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px' }}>
                {schema.primaryActionLabel || 'New Submission'}
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>Fill in the details below</p>
            </div>

            <div style={{ padding: '0 24px 24px' }}>
              {submitted ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '28px 0', textAlign: 'center', animation: 'fadeIn 0.3s ease' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: light, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke={primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#111827' }}>Submitted successfully</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>Your entry has been recorded</p>
                  </div>
                  <div style={{ background: light, border: `1px solid ${primary}33`, borderRadius: 8, padding: '7px 18px', color: primary, fontSize: 13, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                    {ticketId}
                  </div>
                  <button onClick={() => { setFormData({}); setSubmitted(false); setTicketId('') }}
                    style={{ background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, marginTop: 4 }}>
                    Submit another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {displayFields.map(field => (
                    <div key={field.name}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        {field.label}
                        {field.required && <span style={{ color: primary, marginLeft: 2 }}>*</span>}
                      </label>
                      <FieldInput field={field} value={formData[field.name]} onChange={handleFieldChange} primary={primary} />
                    </div>
                  ))}
                  {error && <p style={{ color: '#EF4444', fontSize: 12, margin: 0, background: '#FEF2F2', padding: '8px 12px', borderRadius: 7 }}>{error}</p>}
                  <button type="submit" disabled={submitting}
                    style={{ background: submitting ? '#E5E7EB' : primary, color: submitting ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', marginTop: 6, fontFamily: 'inherit', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {submitting ? (
                      <><div style={{ width: 12, height: 12, border: '1.5px solid #9CA3AF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Submitting...</>
                    ) : schema.primaryActionLabel || 'Submit'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* ── Submissions panel ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #F3F4F6', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {/* Panel header + filter tabs */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F9FAFB', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Submissions</h2>
              <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexWrap: 'wrap' }}>
                {['All', ...statusOptions].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    style={{
                      background: filterStatus === s ? primary : '#F9FAFB',
                      color: filterStatus === s ? '#fff' : '#6B7280',
                      border: filterStatus === s ? 'none' : '1px solid #E5E7EB',
                      borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                    }}>
                    {s} {s !== 'All' && <span style={{ opacity: 0.75 }}>({stats.find(st => st.label === s)?.count ?? 0})</span>}
                  </button>
                ))}
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' }}>{visible.length} shown</span>
            </div>

            {visible.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '56px 24px', color: '#9CA3AF' }}>
                <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📋</div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#374151' }}>No submissions yet</p>
                <p style={{ margin: '6px 0 0', fontSize: 12 }}>Use the form to submit the first entry</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                      <th style={thStyle}>#</th>
                      {displayFields.slice(0, 4).map(f => <th key={f.name} style={thStyle}>{f.label}</th>)}
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((sub, idx) => {
                      const sIdx = statusIndex[sub.status] ?? 0
                      const sc   = statusColors(sIdx)
                      return (
                        <tr key={sub.id} className="sub-row" style={{ borderBottom: '1px solid #F9FAFB', transition: 'background 0.1s' }}>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>{sub.ticket_id}</td>
                          {displayFields.slice(0, 4).map(f => (
                            <td key={f.name} style={{ ...tdStyle, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {String(sub.data?.[f.name] ?? '')}
                            </td>
                          ))}
                          <td style={tdStyle}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <select
                                value={sub.status || ''}
                                onChange={e => handleStatusChange(sub.id, e.target.value)}
                                disabled={updatingId === sub.id}
                                style={{
                                  background: sc.bg, color: sc.text,
                                  border: `1px solid ${sc.dot}44`,
                                  borderRadius: 6, padding: '4px 24px 4px 9px',
                                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                  fontFamily: 'inherit', outline: 'none',
                                  appearance: 'none',
                                  opacity: updatingId === sub.id ? 0.5 : 1,
                                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 3.5l3 3 3-3' stroke='%23${sc.text.slice(1)}' strokeWidth='1.2' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'right 6px center',
                                }}
                              >
                                {statusOptions.map(opt => <option key={opt} value={opt} style={{ background: '#fff', color: '#111' }}>{opt}</option>)}
                              </select>
                            </div>
                          </td>
                          <td style={{ ...tdStyle, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap' }}>
                            {new Date(sub.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const thStyle = {
  padding: '10px 16px', textAlign: 'left',
  fontSize: 11, color: '#9CA3AF',
  fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.05em', whiteSpace: 'nowrap',
}
const tdStyle = {
  padding: '13px 16px', fontSize: 13, color: '#374151',
}

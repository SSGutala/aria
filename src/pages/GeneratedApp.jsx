import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { submitForm, updateStatus } from '../lib/claude'

const THEME_ICONS = {
  ocean: '🌊', forest: '🌿', violet: '✦', rose: '◆', amber: '⬡', slate: '▣'
}

function getTheme(schema) {
  const ct = schema?.colorTheme
  return {
    primary: ct?.primary || '#8B5CF6',
    light: ct?.light || '#F5F3FF',
    text: ct?.text || '#1E1B4B',
    name: ct?.name || 'violet',
  }
}

function statusBadgeStyle(status, primary, light, text) {
  const s = (status || '').toLowerCase()
  if (['pending review', 'new', 'active'].includes(s))
    return { background: light, color: primary, border: `1px solid ${primary}33` }
  if (['approved', 'resolved', 'complete'].includes(s))
    return { background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }
  if (['rejected', 'closed'].includes(s))
    return { background: '#FFF1F2', color: '#E11D48', border: '1px solid #FDA4AF' }
  if (['in progress'].includes(s))
    return { background: '#FFF7ED', color: '#EA580C', border: '1px solid #FDBA74' }
  if (['on hold'].includes(s))
    return { background: '#F8FAFC', color: '#64748B', border: '1px solid #CBD5E1' }
  return { background: light, color: text, border: `1px solid ${primary}22` }
}

function FieldInput({ field, value, onChange, primary, light }) {
  const base = {
    width: '100%',
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    color: '#111827',
    padding: '9px 12px',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value || ''}
        onChange={e => onChange(field.name, e.target.value)}
        required={field.required}
        placeholder={field.placeholder || field.label}
        rows={3}
        style={{ ...base, resize: 'vertical' }}
        onFocus={e => e.target.style.borderColor = primary}
        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
      />
    )
  }
  if (field.type === 'select') {
    return (
      <select
        value={value || ''}
        onChange={e => onChange(field.name, e.target.value)}
        required={field.required}
        style={{ ...base, cursor: 'pointer', appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%239CA3AF' strokeWidth='1.5' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: 32,
        }}
        onFocus={e => e.target.style.borderColor = primary}
        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
      >
        <option value="">Select...</option>
        {(field.options || []).map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }
  return (
    <input
      type={field.type || 'text'}
      value={value || ''}
      onChange={e => onChange(field.name, e.target.value)}
      required={field.required}
      placeholder={field.placeholder || field.label}
      style={base}
      onFocus={e => e.target.style.borderColor = primary}
      onBlur={e => e.target.style.borderColor = '#E5E7EB'}
    />
  )
}

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

  useEffect(() => {
    async function load() {
      const { data: appData } = await supabase
        .from('generated_apps')
        .select('*')
        .eq('slug', slug)
        .single()
      if (!appData) { setLoading(false); return }
      setApp(appData)

      const { data: subs } = await supabase
        .from('app_submissions')
        .select('*')
        .eq('app_id', appData.id)
        .order('submitted_at', { ascending: false })
      setSubmissions(subs || [])
      setLoading(false)
    }
    load()
  }, [slug])

  function handleFieldChange(name, value) {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const result = await submitForm(app.id, formData)
      setTicketId(result.ticketId)
      setSubmitted(true)
      const { data: subs } = await supabase
        .from('app_submissions')
        .select('*')
        .eq('app_id', app.id)
        .order('submitted_at', { ascending: false })
      setSubmissions(subs || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setFormData({})
    setSubmitted(false)
    setTicketId('')
  }

  async function handleStatusChange(submissionId, newStatus) {
    setUpdatingId(submissionId)
    try {
      await updateStatus(submissionId, newStatus, app.id)
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: newStatus } : s))
    } catch (err) {
      console.error('Status update failed', err)
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div style={{ background: '#F9FAFB', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
        Loading...
      </div>
    )
  }

  if (!app) {
    return (
      <div style={{ background: '#F9FAFB', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
        App not found
      </div>
    )
  }

  const schema = app.schema || {}
  const fields = schema.fields || []
  const statusOptions = schema.statusOptions || ['Pending', 'Complete']
  const displayFields = fields.filter(f => f.name !== 'status')
  const { primary, light, text: textColor, name: themeName } = getTheme(schema)

  return (
    <div style={{ background: '#F9FAFB', minHeight: '100vh' }}>
      {/* Top nav bar */}
      <div style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}>
          {THEME_ICONS[themeName] || '◆'}
        </div>
        <span style={{ fontWeight: 600, fontSize: 15, color: '#111827', letterSpacing: '-0.3px' }}>
          {app.title}
        </span>
        <span style={{
          background: light, color: primary,
          border: `1px solid ${primary}33`,
          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500,
          marginLeft: 4,
        }}>
          Live
        </span>
        <span style={{ color: '#9CA3AF', fontSize: 12, marginLeft: 4 }}>
          {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ maxWidth: 1100, margin: '32px auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* Form panel */}
          <div style={{ width: 380, flexShrink: 0 }}>
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
            }}>
              {/* Form header */}
              <div style={{ background: primary, padding: '20px 24px' }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px' }}>
                  {schema.primaryActionLabel || 'New Request'}
                </h2>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                  Fill out the form below to submit
                </p>
              </div>

              <div style={{ padding: 24 }}>
                {submitted ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0', textAlign: 'center' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: light,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path d="M4 11l5 5 9-9" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: '#111827' }}>Submitted!</p>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7280' }}>Your request has been received</p>
                    </div>
                    <div style={{
                      background: light, border: `1px solid ${primary}33`,
                      borderRadius: 8, padding: '6px 14px',
                      color: primary, fontSize: 13, fontWeight: 600, fontFamily: 'monospace',
                    }}>{ticketId}</div>
                    <button
                      onClick={resetForm}
                      style={{
                        background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB',
                        borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer',
                        fontFamily: 'inherit', fontWeight: 500, marginTop: 4,
                      }}
                    >
                      Submit another
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {displayFields.map(field => (
                      <div key={field.name}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
                          {field.label}
                          {field.required && <span style={{ color: primary, marginLeft: 2 }}>*</span>}
                        </label>
                        <FieldInput field={field} value={formData[field.name]} onChange={handleFieldChange} primary={primary} light={light} />
                      </div>
                    ))}
                    {error && <p style={{ color: '#EF4444', fontSize: 12, margin: 0 }}>{error}</p>}
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        background: submitting ? '#E5E7EB' : primary,
                        color: submitting ? '#9CA3AF' : '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '11px 20px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: submitting ? 'default' : 'pointer',
                        marginTop: 6,
                        fontFamily: 'inherit',
                        letterSpacing: '-0.2px',
                      }}
                    >
                      {submitting ? 'Submitting...' : (schema.primaryActionLabel || 'Submit')}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Submissions panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
            }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>
                  Submissions
                </h2>
                <span style={{ fontSize: 12, color: '#6B7280' }}>
                  {submissions.length} total
                </span>
              </div>

              {submissions.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '48px 24px' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                  No submissions yet
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Ticket
                        </th>
                        {displayFields.slice(0, 4).map(f => (
                          <th key={f.name} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {f.label}
                          </th>
                        ))}
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                          Status
                        </th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub, idx) => (
                        <tr key={sub.id} style={{ borderTop: '1px solid #F3F4F6', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {sub.ticket_id}
                          </td>
                          {displayFields.slice(0, 4).map(f => (
                            <td key={f.name} style={{ padding: '12px 16px', fontSize: 13, color: '#374151', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sub.data?.[f.name] ?? ''}
                            </td>
                          ))}
                          <td style={{ padding: '12px 16px' }}>
                            <select
                              value={sub.status || ''}
                              onChange={e => handleStatusChange(sub.id, e.target.value)}
                              disabled={updatingId === sub.id}
                              style={{
                                ...statusBadgeStyle(sub.status, primary, light, textColor),
                                border: `1px solid ${primary}33`,
                                borderRadius: 6,
                                padding: '4px 10px',
                                fontSize: 11,
                                fontWeight: 500,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                outline: 'none',
                                opacity: updatingId === sub.id ? 0.5 : 1,
                              }}
                            >
                              {statusOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                            {new Date(sub.submitted_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

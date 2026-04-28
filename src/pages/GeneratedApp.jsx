import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { submitForm, updateStatus } from '../lib/claude'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

function statusStyle(status) {
  const s = status?.toLowerCase() || ''
  if (['pending', 'new'].includes(s)) return { background: '#2A1A0A', color: '#F59E0B' }
  if (['approved', 'resolved', 'complete'].includes(s)) return { background: '#0A2A1A', color: '#34D399' }
  if (['rejected', 'closed'].includes(s)) return { background: '#2A0A0A', color: '#F87171' }
  return { background: '#1A1A1A', color: '#A3A3A3' }
}

function FieldInput({ field, value, onChange }) {
  const inputStyle = {
    width: '100%',
    background: '#141414',
    border: '0.5px solid #2A2A2A',
    borderRadius: 7,
    color: '#F5F5F5',
    padding: '8px 12px',
    fontSize: 12,
    outline: 'none',
    fontFamily: 'inherit',
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value || ''}
        onChange={e => onChange(field.name, e.target.value)}
        required={field.required}
        placeholder={field.label}
        style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
      />
    )
  }
  if (field.type === 'select') {
    return (
      <select
        value={value || ''}
        onChange={e => onChange(field.name, e.target.value)}
        required={field.required}
        style={{ ...inputStyle, cursor: 'pointer' }}
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
      placeholder={field.label}
      style={inputStyle}
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
      <div style={{ background: '#111111', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#525252', fontSize: 13 }}>
        Loading...
      </div>
    )
  }

  if (!app) {
    return (
      <div style={{ background: '#111111', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#525252', fontSize: 13 }}>
        App not found
      </div>
    )
  }

  const schema = app.schema || {}
  const fields = schema.fields || []
  const statusOptions = schema.statusOptions || ['Pending', 'Complete']

  const displayFields = fields.filter(f => f.name !== 'status')

  return (
    <div style={{ background: '#111111', minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ color: '#F5F5F5', fontSize: 24, fontWeight: 500, margin: 0 }}>{app.title}</h1>
          <span style={{
            background: '#1F1F1F', color: '#A3A3A3', border: '0.5px solid #2E2E2E',
            padding: '2px 8px', borderRadius: 20, fontSize: 10,
          }}>Deployed</span>
          <span style={{ color: '#525252', fontSize: 12, marginLeft: 4 }}>
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ width: '40%', flexShrink: 0 }}>
            <div style={{
              background: '#1A1A1A', border: '0.5px solid #222', borderRadius: 10, padding: 20,
            }}>
              <h2 style={{ color: '#F5F5F5', fontSize: 14, fontWeight: 500, margin: '0 0 16px' }}>Submit a request</h2>

              {submitted ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0', textAlign: 'center' }}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="14" stroke="#34D399" strokeWidth="1"/>
                    <path d="M10 16l4 4 8-8" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ color: '#F5F5F5', fontSize: 14 }}>Submitted successfully</span>
                  <span style={{
                    background: '#141414', border: '0.5px solid #2A2A2A', borderRadius: 6,
                    padding: '4px 10px', color: '#A3A3A3', fontSize: 12, fontFamily: 'monospace',
                  }}>{ticketId}</span>
                  <button
                    onClick={resetForm}
                    style={{
                      background: '#1A1A1A', color: '#A3A3A3', border: '0.5px solid #2A2A2A',
                      borderRadius: 7, padding: '8px 16px', fontSize: 12, cursor: 'pointer', marginTop: 4,
                    }}
                  >
                    Submit another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {displayFields.map(field => (
                    <div key={field.name}>
                      <label style={{ display: 'block', fontSize: 11, color: '#A3A3A3', marginBottom: 4 }}>
                        {field.label}
                        {field.required && <span style={{ color: '#F59E0B', marginLeft: 2 }}>*</span>}
                      </label>
                      <FieldInput field={field} value={formData[field.name]} onChange={handleFieldChange} />
                    </div>
                  ))}
                  {error && <p style={{ color: '#F87171', fontSize: 12, margin: 0 }}>{error}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      background: glareGradient,
                      color: '#111111',
                      border: '0.5px solid #484848',
                      borderRadius: 7,
                      padding: 10,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: submitting ? 'default' : 'pointer',
                      opacity: submitting ? 0.7 : 1,
                      marginTop: 4,
                    }}
                  >
                    {submitting ? 'Submitting...' : (schema.primaryActionLabel || 'Submit')}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              background: '#1A1A1A', border: '0.5px solid #222', borderRadius: 10, padding: 20,
            }}>
              <h2 style={{ color: '#F5F5F5', fontSize: 14, fontWeight: 500, margin: '0 0 16px' }}>Submissions</h2>
              {submissions.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#525252', fontSize: 12, padding: '24px 0' }}>
                  No submissions yet
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#141414' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#3D3D3D', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                          Ticket
                        </th>
                        {displayFields.map(f => (
                          <th key={f.name} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#3D3D3D', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {f.label}
                          </th>
                        ))}
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#3D3D3D', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                          Status
                        </th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#3D3D3D', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                          Submitted
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map(sub => (
                        <tr key={sub.id} style={{ borderBottom: '0.5px solid #1A1A1A' }}>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: '#525252', fontFamily: 'monospace' }}>
                            {sub.ticket_id}
                          </td>
                          {displayFields.map(f => (
                            <td key={f.name} style={{ padding: '10px 12px', fontSize: 12, color: '#A3A3A3', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sub.data?.[f.name] ?? ''}
                            </td>
                          ))}
                          <td style={{ padding: '10px 12px' }}>
                            <select
                              value={sub.status || ''}
                              onChange={e => handleStatusChange(sub.id, e.target.value)}
                              disabled={updatingId === sub.id}
                              style={{
                                ...statusStyle(sub.status),
                                border: '0.5px solid transparent',
                                borderRadius: 6,
                                padding: '3px 8px',
                                fontSize: 11,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                outline: 'none',
                                opacity: updatingId === sub.id ? 0.5 : 1,
                              }}
                            >
                              {statusOptions.map(opt => (
                                <option key={opt} value={opt} style={{ background: '#1A1A1A', color: '#A3A3A3' }}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 11, color: '#525252', whiteSpace: 'nowrap' }}>
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

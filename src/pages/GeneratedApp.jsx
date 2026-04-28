import React, { useEffect, useState, useCallback } from 'react'
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

const STATUS_PALETTE = [
  { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' },
  { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
  { bg: '#F5F3FF', text: '#6D28D9', dot: '#8B5CF6' },
  { bg: '#ECFEFF', text: '#0E7490', dot: '#06B6D4' },
]
function statusColors(index) { return STATUS_PALETTE[index % STATUS_PALETTE.length] }

/* ─── Shared: FieldInput ──────────────────────────────────────────────── */
function FieldInput({ field, value, onChange, primary }) {
  const base = {
    width: '100%', boxSizing: 'border-box',
    background: '#FAFAFA', border: '1.5px solid #E5E7EB',
    borderRadius: 8, color: '#111827',
    padding: '9px 12px', fontSize: 13, outline: 'none',
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
        style={{ ...base, cursor: 'pointer', appearance: 'none', paddingRight: 32,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%239CA3AF' strokeWidth='1.5' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
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

/* ─── Shared: FormPanel ───────────────────────────────────────────────── */
function FormPanel({ schema, primary, light, onSuccess }) {
  const [formData, setFormData] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [ticketId, setTicketId] = useState('')
  const [error, setError] = useState('')

  const displayFields = (schema.fields || []).filter(f => f.name !== 'status')

  function handleChange(name, value) { setFormData(prev => ({ ...prev, [name]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      const result = await submitForm(schema._appId, formData)
      setTicketId(result.ticketId); setSubmitted(true)
      onSuccess?.()
    } catch (err) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  if (submitted) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '32px 0', textAlign: 'center', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: light, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke={primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#111827' }}>Submitted</p>
        <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>Entry recorded</p>
      </div>
      <div style={{ background: light, border: `1px solid ${primary}33`, borderRadius: 8, padding: '6px 16px', color: primary, fontSize: 12, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
        {ticketId}
      </div>
      <button onClick={() => { setFormData({}); setSubmitted(false); setTicketId('') }}
        style={{ background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 18px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
        Submit another
      </button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {displayFields.map(field => (
        <div key={field.name}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {field.label}{field.required && <span style={{ color: primary, marginLeft: 2 }}>*</span>}
          </label>
          <FieldInput field={field} value={formData[field.name]} onChange={handleChange} primary={primary} />
        </div>
      ))}
      {error && <p style={{ color: '#EF4444', fontSize: 12, margin: 0, background: '#FEF2F2', padding: '7px 12px', borderRadius: 7 }}>{error}</p>}
      <button type="submit" disabled={submitting}
        style={{ background: submitting ? '#E5E7EB' : primary, color: submitting ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {submitting ? (
          <><div style={{ width: 12, height: 12, border: '1.5px solid #9CA3AF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Submitting...</>
        ) : (schema.primaryActionLabel || 'Submit')}
      </button>
    </form>
  )
}

/* ─── Shared: Topbar ──────────────────────────────────────────────────── */
function AppTopbar({ title, workflowType, primary, submissionCount, onShare, rightSlot }) {
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #F3F4F6', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 30, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" fill="rgba(255,255,255,0.9)"/>
          <rect x="7.5" y="1" width="5.5" height="5.5" rx="1.2" fill="rgba(255,255,255,0.6)"/>
          <rect x="1" y="7.5" width="5.5" height="5.5" rx="1.2" fill="rgba(255,255,255,0.5)"/>
          <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1.2" fill="rgba(255,255,255,0.8)"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'capitalize' }}>{workflowType?.replace(/_/g, ' ')}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Live</span>
        <span style={{ color: '#D1D5DB', margin: '0 4px' }}>·</span>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{submissionCount} {submissionCount === 1 ? 'entry' : 'entries'}</span>
      </div>
      {rightSlot}
      <button onClick={onShare}
        style={{ background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 7, padding: '6px 13px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, flexShrink: 0 }}>
        Share
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   LAYOUT 1: SPLIT — approval_workflow
   Form on left, scrollable data table on right
   ═══════════════════════════════════════════════════════════════════════ */
function SplitLayout({ app, submissions, onRefresh }) {
  const schema = { ...app.schema, _appId: app.id }
  const { primary, light, text: textColor } = getTheme(app.schema)
  const statusOptions = app.schema.statusOptions || []
  const displayFields = (app.schema.fields || []).filter(f => f.name !== 'status')
  const [filterStatus, setFilterStatus] = useState('All')
  const [updatingId, setUpdatingId] = useState(null)

  const statusIndex = {}
  statusOptions.forEach((s, i) => { statusIndex[s] = i })

  const visible = filterStatus === 'All' ? submissions : submissions.filter(s => s.status === filterStatus)

  async function handleStatusChange(subId, newStatus) {
    setUpdatingId(subId)
    try {
      await updateStatus(subId, newStatus, app.id)
      onRefresh()
    } catch (err) { console.error(err) }
    finally { setUpdatingId(null) }
  }

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } } .row-hover:hover { background: #FAFAFA !important; }`}</style>

      <AppTopbar title={app.title} workflowType={app.schema?.workflowType} primary={primary}
        submissionCount={submissions.length} onShare={() => navigator.clipboard.writeText(window.location.href)} />

      {/* Stats strip */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F3F4F6', padding: '12px 28px', display: 'flex', gap: 10 }}>
        <StatChip label="Total" count={submissions.length} bg={light} fg={primary} dot={primary} />
        {statusOptions.map((s, i) => {
          const c = statusColors(i)
          return <StatChip key={s} label={s} count={submissions.filter(x => x.status === s).length} bg={c.bg} fg={c.text} dot={c.dot} />
        })}
      </div>

      <div style={{ maxWidth: 1240, margin: '24px auto', padding: '0 24px', display: 'flex', gap: 22, alignItems: 'flex-start' }}>

        {/* Left: form */}
        <div style={{ width: 340, flexShrink: 0, position: 'sticky', top: 72 }}>
          <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,0.07)', border: '1px solid #F3F4F6' }}>
            <div style={{ background: `linear-gradient(135deg, ${primary}, ${primary}CC)`, padding: '18px 22px 16px' }}>
              <h2 style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>{app.schema.primaryActionLabel || 'New Entry'}</h2>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Fill in the details below</p>
            </div>
            <div style={{ padding: '20px 22px 22px' }}>
              <FormPanel schema={schema} primary={primary} light={light} onSuccess={onRefresh} />
            </div>
          </div>
        </div>

        {/* Right: table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,0.07)', border: '1px solid #F3F4F6' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F9FAFB', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Submissions</h2>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {['All', ...statusOptions].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)} style={{
                    background: filterStatus === s ? primary : '#F9FAFB',
                    color: filterStatus === s ? '#fff' : '#6B7280',
                    border: filterStatus === s ? 'none' : '1px solid #E5E7EB',
                    borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>{s}</button>
                ))}
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>{visible.length} shown</span>
            </div>
            {visible.length === 0 ? (
              <EmptyState label="No submissions yet" sub="Use the form to submit the first entry" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                      <th style={th}>#</th>
                      {displayFields.slice(0, 4).map(f => <th key={f.name} style={th}>{f.label}</th>)}
                      <th style={th}>Status</th>
                      <th style={th}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(sub => {
                      const sc = statusColors(statusIndex[sub.status] ?? 0)
                      return (
                        <tr key={sub.id} className="row-hover" style={{ borderBottom: '1px solid #F9FAFB' }}>
                          <td style={{ ...td, fontFamily: 'monospace', fontSize: 10, color: '#9CA3AF' }}>{sub.ticket_id}</td>
                          {displayFields.slice(0, 4).map(f => (
                            <td key={f.name} style={{ ...td, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {String(sub.data?.[f.name] ?? '')}
                            </td>
                          ))}
                          <td style={td}>
                            <StatusSelect value={sub.status} options={statusOptions} colors={sc} disabled={updatingId === sub.id}
                              onChange={v => handleStatusChange(sub.id, v)} />
                          </td>
                          <td style={{ ...td, color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap' }}>
                            {fmtDate(sub.submitted_at)}
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

/* ═══════════════════════════════════════════════════════════════════════
   LAYOUT 2: KANBAN — status_board
   Horizontal columns, cards per status, FAB → modal form
   ═══════════════════════════════════════════════════════════════════════ */
function KanbanLayout({ app, submissions, onRefresh }) {
  const schema = { ...app.schema, _appId: app.id }
  const { primary, light } = getTheme(app.schema)
  const statusOptions = app.schema.statusOptions || []
  const displayFields = (app.schema.fields || []).filter(f => f.name !== 'status')
  const [showModal, setShowModal] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [dragging, setDragging] = useState(null)

  const statusIndex = {}
  statusOptions.forEach((s, i) => { statusIndex[s] = i })

  async function handleStatusChange(subId, newStatus) {
    setUpdatingId(subId)
    try {
      await updateStatus(subId, newStatus, app.id)
      onRefresh()
    } catch (err) { console.error(err) }
    finally { setUpdatingId(null) }
  }

  return (
    <div style={{ background: '#F1F5F9', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>

      <AppTopbar title={app.title} workflowType={app.schema?.workflowType} primary={primary}
        submissionCount={submissions.length} onShare={() => navigator.clipboard.writeText(window.location.href)}
        rightSlot={
          <button onClick={() => setShowModal(true)} style={{ background: primary, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
            {app.schema.primaryActionLabel || 'Add Item'}
          </button>
        }
      />

      {/* Kanban columns */}
      <div style={{ padding: '20px 24px', display: 'flex', gap: 14, overflowX: 'auto', alignItems: 'flex-start', minHeight: 'calc(100vh - 56px)' }}>
        {statusOptions.map((status, sIdx) => {
          const sc = statusColors(sIdx)
          const cards = submissions.filter(s => s.status === status)
          return (
            <div key={status} style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Column header */}
              <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', flex: 1 }}>{status}</span>
                <span style={{ background: sc.bg, color: sc.text, borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{cards.length}</span>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cards.length === 0 ? (
                  <div style={{ background: 'rgba(255,255,255,0.6)', border: '2px dashed #CBD5E1', borderRadius: 10, padding: '20px 14px', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
                    No items
                  </div>
                ) : cards.map((sub, cardIdx) => (
                  <KanbanCard key={sub.id} sub={sub} displayFields={displayFields} primary={primary} light={light}
                    statusOptions={statusOptions} statusColors={statusColors} statusIndex={statusIndex}
                    updating={updatingId === sub.id} onStatusChange={v => handleStatusChange(sub.id, v)}
                    animDelay={cardIdx * 40} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* FAB (mobile-friendly) */}
      <button onClick={() => setShowModal(true)} style={{
        position: 'fixed', bottom: 28, right: 28,
        width: 52, height: 52, borderRadius: '50%',
        background: primary, color: '#fff', border: 'none',
        boxShadow: `0 4px 20px ${primary}66`,
        cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 40,
      }}>+</button>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20, backdropFilter: 'blur(3px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 460, maxHeight: '90vh', overflow: 'auto', animation: 'modalIn 0.2s ease', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ background: `linear-gradient(135deg, ${primary}, ${primary}CC)`, padding: '18px 22px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '18px 18px 0 0' }}>
              <div>
                <h2 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#fff' }}>{app.schema.primaryActionLabel || 'New Item'}</h2>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Fill in the details</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 30, height: 30, color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '20px 22px 24px' }}>
              <FormPanel schema={schema} primary={primary} light={light} onSuccess={() => { setShowModal(false); onRefresh() }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KanbanCard({ sub, displayFields, primary, light, statusOptions, statusColors, statusIndex, updating, onStatusChange, animDelay }) {
  const sc = statusColors(statusIndex[sub.status] ?? 0)
  const topField = displayFields[0]
  const topValue = topField ? String(sub.data?.[topField.name] ?? '') : ''
  const secondField = displayFields[1]
  const secondValue = secondField ? String(sub.data?.[secondField.name] ?? '') : ''

  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '13px 14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animation: `fadeIn 0.25s ease ${animDelay}ms both`, cursor: 'default' }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A', marginBottom: 4, lineHeight: 1.3, wordBreak: 'break-word' }}>{topValue || '(untitled)'}</div>
      {secondValue && <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{secondValue}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: secondValue ? 0 : 8 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94A3B8' }}>{sub.ticket_id}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#94A3B8' }}>{fmtDate(sub.submitted_at)}</span>
          <select value={sub.status || ''} onChange={e => onStatusChange(e.target.value)} disabled={updating}
            style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.dot}44`, borderRadius: 6, padding: '3px 20px 3px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', appearance: 'none', opacity: updating ? 0.5 : 1,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath d='M1.5 3l2.5 2.5L6.5 3' stroke='%23${sc.text.slice(1)}' strokeWidth='1.2' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 5px center',
            }}>
            {statusOptions.map(opt => <option key={opt} value={opt} style={{ background: '#fff', color: '#111' }}>{opt}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   LAYOUT 3: FEED — intake_tracker
   Persistent side form + right scrollable card feed
   ═══════════════════════════════════════════════════════════════════════ */
function FeedLayout({ app, submissions, onRefresh }) {
  const schema = { ...app.schema, _appId: app.id }
  const { primary, light, text: textColor } = getTheme(app.schema)
  const statusOptions = app.schema.statusOptions || []
  const displayFields = (app.schema.fields || []).filter(f => f.name !== 'status')
  const [filterStatus, setFilterStatus] = useState('All')
  const [updatingId, setUpdatingId] = useState(null)

  const statusIndex = {}
  statusOptions.forEach((s, i) => { statusIndex[s] = i })

  const visible = filterStatus === 'All' ? submissions : submissions.filter(s => s.status === filterStatus)

  async function handleStatusChange(subId, newStatus) {
    setUpdatingId(subId)
    try {
      await updateStatus(subId, newStatus, app.id)
      onRefresh()
    } catch (err) { console.error(err) }
    finally { setUpdatingId(null) }
  }

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <AppTopbar title={app.title} workflowType={app.schema?.workflowType} primary={primary}
        submissionCount={submissions.length} onShare={() => navigator.clipboard.writeText(window.location.href)} />

      <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>

        {/* Left: fixed form sidebar */}
        <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #E2E8F0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <div style={{ padding: '20px 20px 0', borderBottom: '1px solid #F1F5F9', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v12M2 8h12" stroke={primary} strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{app.schema.primaryActionLabel || 'New Entry'}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>Add to feed</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '18px 20px 24px', flex: 1 }}>
            <FormPanel schema={schema} primary={primary} light={light} onSuccess={onRefresh} />
          </div>
        </div>

        {/* Right: card feed */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Filter bar */}
          <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginRight: 4 }}>Filter:</span>
            {['All', ...statusOptions].map((s, i) => {
              const c = i === 0 ? { dot: primary, bg: light, text: textColor } : statusColors(i - 1)
              const isActive = filterStatus === s
              return (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  background: isActive ? c.dot : '#F8FAFC',
                  color: isActive ? '#fff' : c.text,
                  border: `1px solid ${isActive ? c.dot : '#E2E8F0'}`,
                  borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {s !== 'All' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#fff' : c.dot, flexShrink: 0 }} />}
                  {s}
                  {s !== 'All' && <span style={{ opacity: 0.8 }}>({submissions.filter(x => x.status === s).length})</span>}
                </button>
              )
            })}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>{visible.length} entries</span>
          </div>

          {/* Card list */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.length === 0 ? (
              <EmptyState label="Nothing here yet" sub="Submit the first entry using the form on the left" />
            ) : visible.map((sub, idx) => {
              const sc = statusColors(statusIndex[sub.status] ?? 0)
              return (
                <div key={sub.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', animation: `fadeIn 0.2s ease ${idx * 30}ms both` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', marginBottom: 3 }}>
                        {String(sub.data?.[displayFields[0]?.name] ?? '(untitled)')}
                      </div>
                      {displayFields[1] && (
                        <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>
                          {String(sub.data?.[displayFields[1]?.name] ?? '')}
                        </div>
                      )}
                    </div>
                    <StatusSelect value={sub.status} options={statusOptions} colors={sc}
                      disabled={updatingId === sub.id} onChange={v => handleStatusChange(sub.id, v)} />
                  </div>
                  {/* Secondary fields */}
                  {displayFields.slice(2, 5).filter(f => sub.data?.[f.name]).length > 0 && (
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                      {displayFields.slice(2, 5).filter(f => sub.data?.[f.name]).map(f => (
                        <div key={f.name}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{f.label}</div>
                          <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{String(sub.data[f.name])}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94A3B8' }}>{sub.ticket_id}</span>
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>{fmtDate(sub.submitted_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Shared: small components ─────────────────────────────────────────── */
function StatChip({ label, count, bg, fg, dot }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: bg, borderRadius: 8, border: `1px solid ${dot}22` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
      <span style={{ fontSize: 18, fontWeight: 800, color: fg, lineHeight: 1 }}>{count}</span>
      <span style={{ fontSize: 10, color: fg, fontWeight: 500, maxWidth: 80, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </div>
  )
}

function StatusSelect({ value, options, colors: sc, disabled, onChange }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.dot}44`, borderRadius: 6, padding: '4px 22px 4px 9px', fontSize: 11, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', outline: 'none', appearance: 'none', opacity: disabled ? 0.5 : 1, flexShrink: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 3.5l3 3 3-3' stroke='%23${sc.text.slice(1)}' strokeWidth='1.2' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center',
      }}>
      {options.map(opt => <option key={opt} value={opt} style={{ background: '#fff', color: '#111' }}>{opt}</option>)}
    </select>
  )
}

function EmptyState({ label, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px', color: '#9CA3AF' }}>
      <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.35 }}>📋</div>
      <p style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 600, color: '#374151' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 12 }}>{sub}</p>
    </div>
  )
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const th = { padding: '9px 14px', textAlign: 'left', fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }
const td = { padding: '12px 14px', fontSize: 13, color: '#374151' }

/* ═══════════════════════════════════════════════════════════════════════
   ROOT: load data + route to layout
   ═══════════════════════════════════════════════════════════════════════ */
export default function GeneratedApp() {
  const { slug } = useParams()
  const [app, setApp] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  const loadSubmissions = useCallback(async (appId) => {
    const { data } = await supabase.from('app_submissions').select('*').eq('app_id', appId).order('submitted_at', { ascending: false })
    setSubmissions(data || [])
  }, [])

  useEffect(() => {
    async function load() {
      const { data: appData } = await supabase.from('generated_apps').select('*').eq('slug', slug).single()
      if (!appData) { setLoading(false); return }
      setApp(appData)
      await loadSubmissions(appData.id)
      setLoading(false)
    }
    load()
  }, [slug, loadSubmissions])

  if (loading) return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #E5E7EB', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 13 }}>Loading...</div>
      </div>
    </div>
  )

  if (!app) return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      App not found
    </div>
  )

  const layoutType = app.schema?.layoutType || app.workflow_type

  const refresh = () => loadSubmissions(app.id)

  if (layoutType === 'kanban' || layoutType === 'status_board') {
    return <KanbanLayout app={app} submissions={submissions} onRefresh={refresh} />
  }
  if (layoutType === 'feed' || layoutType === 'intake_tracker') {
    return <FeedLayout app={app} submissions={submissions} onRefresh={refresh} />
  }
  // Default: split (approval_workflow)
  return <SplitLayout app={app} submissions={submissions} onRefresh={refresh} />
}

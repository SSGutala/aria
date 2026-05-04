import React, { useState, useRef, useEffect } from 'react'
import mermaid from 'mermaid'
import { API_URL as API } from '../lib/api'

// ─── Icons ────────────────────────────────────────────────────────────────────
function ChevronIcon({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1.5 5l2.5 2.5 5-5" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M6.5 1.5L8.5 3.5L3 9H1V7L6.5 1.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
      {children}
    </p>
  )
}

function Pill({ children, color = '#525252', bg = '#1A1A1A', border = '#222' }) {
  return (
    <span style={{ fontSize: 10, color, background: bg, border: `0.5px solid ${border}`, borderRadius: 4, padding: '2px 7px', fontWeight: 500, display: 'inline-block' }}>
      {children}
    </span>
  )
}

function Tag({ children }) {
  return <Pill color="#A3A3A3" bg="#1C1C1C" border="#2A2A2A">{children}</Pill>
}

function ArrowRow({ items, activeIdx = 0 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <span style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 5,
            background: i === activeIdx ? '#0D1F16' : '#1A1A1A',
            color: i === activeIdx ? '#34D399' : '#525252',
            border: `0.5px solid ${i === activeIdx ? '#34D39944' : '#222'}`,
            fontWeight: i === activeIdx ? 600 : 400,
          }}>{item}</span>
          {i < items.length - 1 && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="#2A2A2A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Stage content renderers ──────────────────────────────────────────────────

// Shared doc styles
const D = {
  page: { background: '#FFFFFF', maxWidth: 720, margin: '0 auto', padding: '40px 48px', fontFamily: 'inherit', color: '#374151' },
  title: { fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 4px' },
  subtitle: { fontSize: 13, color: '#6B7280', margin: 0 },
  h2: { fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 6px', paddingBottom: 6, borderBottom: '1px solid #E5E7EB' },
  body: { fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0 },
  hr: { border: 'none', borderTop: '1px solid #E5E7EB', margin: '20px 0' },
  label: { fontSize: 11, color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' },
}

// ── 1. IntakeSummaryContent ────────────────────────────────────────────────────
function IntakeSummaryContent({ data }) {
  if (!data) return null
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <div style={{ background: '#F3F4F6', padding: '16px 0' }}>
      <div style={D.page}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, border: '1.5px dashed #D1D5DB', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.2 }}>Logo</span>
            </div>
            <span style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>[Company Name]</span>
          </div>
          <span style={{ fontSize: 12, color: '#6B7280' }}>{today}</span>
        </div>
        <h1 style={D.title}>Intake Summary</h1>
        <hr style={D.hr} />

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <h2 style={D.h2}>What We Understood</h2>
            <p style={D.body}>{data.understood}</p>
          </div>
          <div>
            <h2 style={D.h2}>Business Problem</h2>
            <p style={D.body}>{data.businessProblem}</p>
          </div>
          <div>
            <h2 style={D.h2}>Primary Users</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {(data.primaryUsers || []).map((u, i) => (
                <span key={i} style={{ fontSize: 13, color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 20, padding: '3px 12px', fontWeight: 500 }}>{u}</span>
              ))}
              {(data.secondaryUsers || []).map((u, i) => (
                <span key={i} style={{ fontSize: 13, color: '#6B7280', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 20, padding: '3px 12px' }}>{u}</span>
              ))}
            </div>
          </div>
          <div>
            <h2 style={D.h2}>Process Being Replaced</h2>
            <p style={D.body}>{data.currentProcess}</p>
          </div>
          <div>
            <h2 style={D.h2}>Expected Outcome</h2>
            <p style={D.body}>{data.mainOutcome}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 2. ProductBriefContent ─────────────────────────────────────────────────────
function ProductBriefContent({ data }) {
  if (!data) return null
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <div style={{ background: '#F3F4F6', padding: '16px 0' }}>
      <div style={D.page}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, border: '1.5px dashed #D1D5DB', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, color: '#9CA3AF' }}>Logo</span>
            </div>
            <span style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>[Company Name]</span>
          </div>
          <span style={{ fontSize: 12, color: '#6B7280' }}>{today}</span>
        </div>
        <h1 style={D.title}>Product Brief</h1>
        <hr style={D.hr} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Objective */}
          <div>
            <h2 style={D.h2}>Objective</h2>
            <p style={{ ...D.body, fontSize: 15, color: '#111827', fontWeight: 500 }}>{data.objective}</p>
          </div>

          {/* User Roles table */}
          {(data.userRoles || []).length > 0 && (
            <div>
              <h2 style={D.h2}>User Roles</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#1E3A5F' }}>
                    {['Role', 'Access Level', 'Est. Users'].map(col => (
                      <th key={col} style={{ padding: '8px 12px', color: '#fff', fontWeight: 600, textAlign: 'left', fontSize: 12 }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.userRoles.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#F9FAFB' : '#fff' }}>
                      <td style={{ padding: '8px 12px', color: '#111827', fontWeight: 500, borderBottom: '1px solid #E5E7EB' }}>{r.role}</td>
                      <td style={{ padding: '8px 12px', color: '#374151', borderBottom: '1px solid #E5E7EB' }}>{r.access}</td>
                      <td style={{ padding: '8px 12px', color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{r.estimated || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Core Workflows */}
          {(data.coreWorkflows || []).length > 0 && (
            <div>
              <h2 style={D.h2}>Core Workflows</h2>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.coreWorkflows.map((w, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1D4ED8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={D.body}>{w}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Business Rules */}
          {(data.businessRules || []).length > 0 && (
            <div>
              <h2 style={D.h2}>Business Rules</h2>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.businessRules.map((r, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#374151', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={D.body}>{r}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Success Criteria */}
          {(data.successCriteria || []).length > 0 && (
            <div>
              <h2 style={D.h2}>Success Criteria</h2>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.successCriteria.map((s, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 14, color: '#059669', flexShrink: 0, marginTop: 2 }}>✓</span>
                    <span style={D.body}>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Open Questions */}
          {(data.openQuestions || []).length > 0 && (
            <div>
              <h2 style={D.h2}>Open Questions</h2>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.openQuestions.map((q, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, marginTop: 2 }}>⚠</span>
                    <span style={{ ...D.body, fontStyle: 'italic', color: '#6B7280' }}>{q}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 3. WorkflowMapContent ──────────────────────────────────────────────────────
function sanitizeMermaidLabel(text) {
  if (!text) return ''
  return String(text).replace(/"/g, "'").replace(/[<>{}[\]]/g, ' ').replace(/\n/g, ' ').trim().slice(0, 60)
}

function generateMermaidSrc(data) {
  if (!data) return 'flowchart TD\n  START([Start])'
  const lines = ['flowchart TD']
  const trigger = sanitizeMermaidLabel(data.trigger || 'Trigger')
  lines.push(`  START(["▶ ${trigger}"])`)

  const steps = data.steps || []
  steps.forEach((step, i) => {
    const label = sanitizeMermaidLabel(`${step.step}\\n${step.actor || ''}`)
    lines.push(`  S${i}["${label}"]`)
  })

  // Connect steps
  if (steps.length > 0) lines.push(`  START --> S0`)
  for (let i = 0; i < steps.length - 1; i++) {
    lines.push(`  S${i} --> S${i + 1}`)
  }

  // Decision points
  const decisions = data.decisionPoints || []
  const exceptions = data.exceptionPaths || []
  decisions.forEach((d, i) => {
    const label = sanitizeMermaidLabel(d)
    lines.push(`  D${i}{"${label}"}`)
    if (steps.length > 0) lines.push(`  S${steps.length - 1} --> D${i}`)
    lines.push(`  D${i} -->|Yes| END`)
    if (exceptions[i]) {
      const exLabel = sanitizeMermaidLabel(exceptions[i])
      lines.push(`  EX${i}["${exLabel}"]`)
      lines.push(`  D${i} -->|No| EX${i}`)
    }
  })

  if (decisions.length === 0 && steps.length > 0) {
    lines.push(`  S${steps.length - 1} --> END`)
  }
  lines.push('  END(["⏹ Complete"])')
  return lines.join('\n')
}

function WorkflowMapContent({ data }) {
  if (!data) return null
  const diagramRef = useRef(null)
  const [showSource, setShowSource] = useState(false)
  const [mermaidSrc, setMermaidSrc] = useState(() => generateMermaidSrc(data))
  const [renderError, setRenderError] = useState(null)

  useEffect(() => {
    setMermaidSrc(generateMermaidSrc(data))
  }, [data])

  useEffect(() => {
    if (showSource || !diagramRef.current) return
    setRenderError(null)
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
    const id = 'wf_' + Math.random().toString(36).slice(2)
    diagramRef.current.innerHTML = '<div style="color:#9CA3AF;fontSize:12px;padding:20px">Rendering diagram…</div>'
    mermaid.render(id, mermaidSrc)
      .then(({ svg }) => {
        if (diagramRef.current) {
          diagramRef.current.innerHTML = svg
          const svgEl = diagramRef.current.querySelector('svg')
          if (svgEl) { svgEl.style.maxWidth = '100%'; svgEl.style.height = 'auto' }
        }
      })
      .catch(err => {
        setRenderError('Diagram render error: ' + err.message)
        if (diagramRef.current) diagramRef.current.innerHTML = ''
      })
  }, [mermaidSrc, showSource])

  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Workflow Diagram</span>
        <button
          onClick={() => setShowSource(v => !v)}
          style={{ fontSize: 11, color: '#1D4ED8', background: 'transparent', border: '1px solid #BFDBFE', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
        >{showSource ? 'Show Diagram' : 'Edit Source'}</button>
      </div>

      {showSource ? (
        <textarea
          value={mermaidSrc}
          onChange={e => setMermaidSrc(e.target.value)}
          style={{ width: '100%', minHeight: 220, padding: 16, fontSize: 12, fontFamily: 'monospace', color: '#111827', border: 'none', resize: 'vertical', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
        />
      ) : (
        <div style={{ padding: 20, minHeight: 200, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {renderError
            ? <div style={{ color: '#DC2626', fontSize: 12, padding: 12, background: '#FEF2F2', borderRadius: 6 }}>{renderError}</div>
            : <div ref={diagramRef} style={{ width: '100%' }} />
          }
        </div>
      )}
    </div>
  )
}

// ── 4. DataModelContent ────────────────────────────────────────────────────────
function EditableCell({ children, style }) {
  return (
    <td
      contentEditable
      suppressContentEditableWarning
      style={{ padding: '7px 10px', fontSize: 13, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top', outline: 'none', cursor: 'text', ...style }}
      onFocus={e => e.currentTarget.style.background = '#FAFAFA'}
      onBlur={e => e.currentTarget.style.background = ''}
    >{children}</td>
  )
}

function DataModelContent({ data }) {
  if (!data) return null
  const thStyle = { padding: '9px 10px', fontSize: 12, fontWeight: 600, color: '#fff', background: '#1E3A5F', textAlign: 'left', whiteSpace: 'nowrap' }
  const cols = ['Field Name', 'Type', 'Required', 'Description', 'Example Value', 'Validation Rules']
  const fields = data.fields || []
  const audit = data.auditFields || []
  const statusFlow = data.statusFlow || []

  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
      {/* Entity header */}
      <div style={{ padding: '10px 14px', background: '#1E3A5F', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{data.primaryEntity || 'Entity'}</span>
        <span style={{ fontSize: 11, color: '#93C5FD' }}>Data Model</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
          <thead>
            <tr>{cols.map(c => <th key={c} style={thStyle}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#F9FAFB' : '#fff' }}>
                <EditableCell style={{ fontWeight: 600, color: '#111827' }}>{f.name || f.label || ''}</EditableCell>
                <EditableCell><span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', borderRadius: 4, padding: '1px 6px' }}>{f.type || ''}</span></EditableCell>
                <EditableCell style={{ textAlign: 'center', color: f.required ? '#DC2626' : '#9CA3AF' }}>{f.required ? '✓' : '—'}</EditableCell>
                <EditableCell>{f.label || f.name || ''}</EditableCell>
                <EditableCell style={{ color: '#6B7280', fontStyle: 'italic' }}>{(f.options && f.options.length > 0) ? f.options[0] : '—'}</EditableCell>
                <EditableCell style={{ color: '#6B7280' }}>{f.options && f.options.length > 1 ? `Options: ${f.options.join(', ')}` : (f.required ? 'Required' : '—')}</EditableCell>
              </tr>
            ))}

            {/* Audit fields */}
            {audit.length > 0 && (
              <>
                <tr>
                  <td colSpan={6} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#6B7280', background: '#F3F4F6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Audit Fields</td>
                </tr>
                {audit.map((f, i) => (
                  <tr key={`a${i}`} style={{ background: i % 2 === 0 ? '#F9FAFB' : '#fff' }}>
                    <EditableCell style={{ fontWeight: 600, color: '#111827' }}>{f}</EditableCell>
                    <EditableCell><span style={{ fontSize: 11, background: '#F3F4F6', color: '#6B7280', borderRadius: 4, padding: '1px 6px' }}>timestamp</span></EditableCell>
                    <EditableCell style={{ textAlign: 'center', color: '#DC2626' }}>✓</EditableCell>
                    <EditableCell>Auto-managed audit field</EditableCell>
                    <EditableCell style={{ color: '#6B7280', fontStyle: 'italic' }}>2024-01-01T00:00:00Z</EditableCell>
                    <EditableCell style={{ color: '#6B7280' }}>ISO 8601</EditableCell>
                  </tr>
                ))}
              </>
            )}

            {/* Status flow */}
            {statusFlow.length > 0 && (
              <>
                <tr>
                  <td colSpan={6} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#6B7280', background: '#F3F4F6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status Flow</td>
                </tr>
                <tr>
                  <td colSpan={6} style={{ padding: '10px 12px', borderBottom: '1px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {statusFlow.map((s, i) => (
                        <React.Fragment key={i}>
                          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 12, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontWeight: 500 }}>{s}</span>
                          {i < statusFlow.length - 1 && <span style={{ color: '#9CA3AF', fontSize: 12 }}>→</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 5. AutomationModelContent ──────────────────────────────────────────────────
function AutomationTable({ title, color, columns, rows }) {
  if (!rows || rows.length === 0) return null
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ padding: '7px 12px', background: color, borderRadius: '6px 6px 0 0' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{title}</span>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
          <thead>
            <tr style={{ background: color + '22' }}>
              {columns.map(c => (
                <th key={c} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: color, textAlign: 'left', borderBottom: '1px solid #E5E7EB' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#F9FAFB' : '#fff' }}>
                {columns.map((col, j) => {
                  const key = col.toLowerCase().replace(/\s+/g, '_')
                  const altKeys = [key, col.toLowerCase(), Object.keys(row)[j]]
                  const val = altKeys.reduce((v, k) => v !== undefined ? v : row[k], undefined)
                  return (
                    <td
                      key={j}
                      contentEditable
                      suppressContentEditableWarning
                      onFocus={e => e.currentTarget.style.background = '#F0F9FF'}
                      onBlur={e => e.currentTarget.style.background = ''}
                      style={{ padding: '7px 10px', fontSize: 13, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top', outline: 'none', cursor: 'text' }}
                    >{val || '—'}</td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AutomationModelContent({ data }) {
  if (!data) return null
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '16px 16px 2px', border: '1px solid #E5E7EB' }}>
      <AutomationTable
        title="Triggers"
        color="#059669"
        columns={['Trigger Event', 'Condition', 'Action', 'Output']}
        rows={(data.triggers || []).map(t => ({ 'Trigger Event': t.event, Condition: t.condition, Action: t.action, Output: t.output || '—' }))}
      />
      <AutomationTable
        title="Notifications"
        color="#0284C7"
        columns={['Event', 'Recipient', 'Channel', 'Message']}
        rows={(data.notifications || []).map(n => ({ Event: n.event, Recipient: n.recipient, Channel: n.channel, Message: n.template || n.message || '—' }))}
      />
      <AutomationTable
        title="Escalations"
        color="#D97706"
        columns={['Condition', 'Action', 'Escalate To']}
        rows={(data.escalations || []).map(e => ({ Condition: e.condition, Action: e.action, 'Escalate To': e.recipient || e.escalateTo || '—' }))}
      />
      <AutomationTable
        title="Integrations"
        color="#7C3AED"
        columns={['System', 'Type', 'Purpose']}
        rows={(data.integrations || []).map(i => ({ System: i.system, Type: i.type, Purpose: i.purpose }))}
      />
    </div>
  )
}

// ── 6. AppSpecContent ──────────────────────────────────────────────────────────
function AppSpecContent({ data }) {
  if (!data) return null
  const primary = data.colorTheme?.primary || '#7C3AED'
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div style={{ background: '#F3F4F6', padding: '16px 0' }}>
      <div style={D.page}>
        {/* Color accent bar */}
        <div style={{ height: 4, background: primary, borderRadius: 2, marginBottom: 20 }} />

        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ ...D.title, fontSize: 26 }}>{data.appTitle}</h1>
            <p style={{ ...D.subtitle, fontSize: 14, marginTop: 4 }}>{data.tagline}</p>
          </div>
          <span style={{ fontSize: 12, color: '#6B7280', flexShrink: 0, marginLeft: 16 }}>{today}</span>
        </div>
        <hr style={D.hr} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Overview */}
          <div>
            <h2 style={D.h2}>Application Overview</h2>
            <p style={D.body}>{data.purpose}</p>
          </div>

          {/* App Type & Layout */}
          <div>
            <h2 style={D.h2}>App Type & Layout</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              {[['App Type', data.appType], ['Layout', (data.layoutType || '').replace(/_/g, ' ')], ['Workflow Type', data.workflowType], ['Primary Action', data.primaryActionLabel]].map(([k, v]) => v ? (
                <div key={k} style={{ padding: '10px 14px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6 }}>
                  <div style={D.label}>{k}</div>
                  <div style={{ fontSize: 14, color: '#111827', fontWeight: 500, marginTop: 4 }}>{v}</div>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Color Theme */}
          {data.colorTheme && (
            <div>
              <h2 style={D.h2}>Color Theme</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, padding: '12px 16px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: primary, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{data.colorTheme.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', fontFamily: 'monospace' }}>{primary}</div>
                </div>
                {data.colorTheme.light && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 5, background: data.colorTheme.light, border: '1px solid #E5E7EB' }} />
                    <span style={{ fontSize: 12, color: '#6B7280', fontFamily: 'monospace' }}>{data.colorTheme.light}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Workflow */}
          {(data.statusFlow || []).length > 0 && (
            <div>
              <h2 style={D.h2}>Status Workflow</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {data.statusFlow.map((s, i) => (
                  <React.Fragment key={i}>
                    <span style={{ padding: '5px 14px', borderRadius: 20, background: i === 0 ? primary : '#F3F4F6', color: i === 0 ? '#fff' : '#374151', border: `1px solid ${i === 0 ? primary : '#E5E7EB'}`, fontSize: 13, fontWeight: i === 0 ? 600 : 400 }}>{s}</span>
                    {i < data.statusFlow.length - 1 && <span style={{ color: '#9CA3AF', fontSize: 14 }}>→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Features */}
          {(data.features || []).length > 0 && (
            <div>
              <h2 style={D.h2}>Features</h2>
              <ol style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={D.body}>{f}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Data Fields */}
          {(data.fields || []).length > 0 && (
            <div>
              <h2 style={D.h2}>Data Fields</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
                <thead>
                  <tr style={{ background: '#1E3A5F' }}>
                    {['Field', 'Label', 'Type', 'Required'].map(c => (
                      <th key={c} style={{ padding: '8px 12px', color: '#fff', fontWeight: 600, textAlign: 'left', fontSize: 12 }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.fields.map((f, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#F9FAFB' : '#fff' }}>
                      <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 12, color: '#1D4ED8', borderBottom: '1px solid #E5E7EB' }}>{f.name || f.label}</td>
                      <td style={{ padding: '7px 12px', color: '#374151', borderBottom: '1px solid #E5E7EB' }}>{f.label || f.name}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #E5E7EB' }}><span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', borderRadius: 4, padding: '1px 6px' }}>{f.type}</span></td>
                      <td style={{ padding: '7px 12px', color: f.required ? '#DC2626' : '#9CA3AF', borderBottom: '1px solid #E5E7EB', textAlign: 'center' }}>{f.required ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Primary Action */}
          {data.primaryActionLabel && (
            <div>
              <h2 style={D.h2}>Primary Action</h2>
              <div style={{ marginTop: 8, padding: '14px 20px', background: primary + '12', border: `1.5px solid ${primary}`, borderRadius: 8, display: 'inline-block' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: primary }}>⚡ {data.primaryActionLabel}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 7. UXRecommendationContent ─────────────────────────────────────────────────
function hasKeyword(keyActions, ...words) {
  const str = (keyActions || []).join(' ').toLowerCase()
  return words.some(w => str.includes(w))
}

function MockScreenInner({ screen, primaryColor }) {
  const actions = screen.keyActions || []
  const isForm = hasKeyword(actions, 'form', 'create', 'submit', 'add', 'new', 'edit')
  const isTable = hasKeyword(actions, 'table', 'list', 'view', 'filter', 'search', 'browse')
  const isSplit = hasKeyword(actions, 'review', 'approve', 'detail', 'inspect')

  const inputStyle = {
    display: 'block', width: '100%', padding: '5px 8px', fontSize: 11, border: '1px solid #D1D5DB',
    borderRadius: 4, background: '#fff', color: '#374151', boxSizing: 'border-box', marginBottom: 8,
  }
  const labelStyle = { fontSize: 10, fontWeight: 600, color: '#6B7280', marginBottom: 3, display: 'block' }

  if (isForm) {
    return (
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 12 }}>New Entry</div>
        {['Title / Name', 'Category', 'Assigned To', 'Due Date', 'Notes'].map((label, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <span style={labelStyle}>{label}</span>
            {i === 4
              ? <div style={{ ...inputStyle, height: 44, background: '#F9FAFB' }} />
              : <div style={{ ...inputStyle, background: '#F9FAFB' }}>&nbsp;</div>
            }
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <div style={{ padding: '6px 16px', background: primaryColor, borderRadius: 5, fontSize: 11, color: '#fff', fontWeight: 600, cursor: 'default' }}>Submit</div>
          <div style={{ padding: '6px 16px', background: '#F3F4F6', borderRadius: 5, fontSize: 11, color: '#374151', cursor: 'default' }}>Cancel</div>
        </div>
      </div>
    )
  }

  if (isSplit) {
    const items = ['Item A', 'Item B', 'Item C', 'Item D']
    return (
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ width: '40%', borderRight: '1px solid #E5E7EB', overflow: 'hidden' }}>
          {items.map((it, i) => (
            <div key={i} style={{ padding: '8px 10px', borderBottom: '1px solid #F3F4F6', background: i === 0 ? primaryColor + '15' : '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: i === 0 ? primaryColor : '#374151', fontWeight: i === 0 ? 600 : 400 }}>{it}</span>
              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: i === 0 ? primaryColor : '#E5E7EB', color: i === 0 ? '#fff' : '#6B7280' }}>{i === 0 ? 'Active' : 'Draft'}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: '10px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Item A</div>
          {['Field 1', 'Field 2', 'Field 3'].map((f, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginBottom: 2 }}>{f}</div>
              <div style={{ height: 14, background: '#F3F4F6', borderRadius: 3, width: i === 0 ? '80%' : '60%' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <div style={{ padding: '5px 12px', background: primaryColor, borderRadius: 4, fontSize: 10, color: '#fff', fontWeight: 600 }}>Approve</div>
            <div style={{ padding: '5px 12px', background: '#FEF2F2', borderRadius: 4, fontSize: 10, color: '#DC2626', fontWeight: 600 }}>Reject</div>
          </div>
        </div>
      </div>
    )
  }

  // Default: table/list view
  const cols = ['#', 'Name', 'Status', 'Date', 'Actions']
  const fakeRows = [
    ['001', 'Alpha Request', 'Active', 'Jan 12', ''],
    ['002', 'Beta Review', 'Pending', 'Jan 15', ''],
    ['003', 'Gamma Task', 'Complete', 'Jan 18', ''],
    ['004', 'Delta Item', 'Draft', 'Jan 20', ''],
  ]
  return (
    <div style={{ overflow: 'hidden' }}>
      {/* Filters row */}
      <div style={{ padding: '8px 10px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 22, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 4, padding: '0 8px', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#9CA3AF' }}>🔍 Search…</span>
        </div>
        {['All', 'Active', 'Pending'].map((f, i) => (
          <span key={i} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 12, background: i === 0 ? primaryColor : '#F3F4F6', color: i === 0 ? '#fff' : '#374151', fontWeight: i === 0 ? 600 : 400, cursor: 'default' }}>{f}</span>
        ))}
        <div style={{ padding: '3px 8px', background: primaryColor, borderRadius: 4, fontSize: 9, color: '#fff', fontWeight: 600, cursor: 'default', marginLeft: 4 }}>+ New</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {cols.map(c => <th key={c} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 9 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {fakeRows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
              <td style={{ padding: '5px 8px', color: '#9CA3AF', fontFamily: 'monospace' }}>{row[0]}</td>
              <td style={{ padding: '5px 8px', color: '#111827', fontWeight: 500 }}>{row[1]}</td>
              <td style={{ padding: '5px 8px' }}>
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: row[2] === 'Active' ? '#D1FAE5' : row[2] === 'Pending' ? '#FEF3C7' : row[2] === 'Complete' ? '#EFF6FF' : '#F3F4F6', color: row[2] === 'Active' ? '#059669' : row[2] === 'Pending' ? '#D97706' : row[2] === 'Complete' ? '#2563EB' : '#6B7280', fontWeight: 600 }}>{row[2]}</span>
              </td>
              <td style={{ padding: '5px 8px', color: '#6B7280' }}>{row[3]}</td>
              <td style={{ padding: '5px 8px' }}>
                <span style={{ fontSize: 9, color: primaryColor, fontWeight: 600, cursor: 'default' }}>View →</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BrowserFrame({ screen, primaryColor, hasSidebar }) {
  const navItems = ['Dashboard', 'Records', 'Reports', 'Settings']
  return (
    <div style={{ width: 520, flexShrink: 0, border: '1.5px solid #D1D5DB', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden', background: '#fff' }}>
      {/* Title bar */}
      <div style={{ background: '#F3F4F6', borderBottom: '1px solid #E5E7EB', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#FC5753', '#FEBC2E', '#28C840'].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 5, padding: '2px 12px', fontSize: 10, color: '#6B7280', minWidth: 120, textAlign: 'center' }}>{screen.screen}</div>
        </div>
      </div>

      {/* Content area */}
      <div style={{ display: 'flex', height: 320, overflow: 'hidden' }}>
        {/* Sidebar */}
        {hasSidebar && (
          <div style={{ width: 110, background: '#1E3A5F', display: 'flex', flexDirection: 'column', padding: '12px 0', flexShrink: 0 }}>
            <div style={{ padding: '6px 12px', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', opacity: 0.9 }}>App</div>
            </div>
            {navItems.map((item, i) => (
              <div key={i} style={{ padding: '7px 12px', fontSize: 10, color: i === 0 ? '#fff' : '#93C5FD', background: i === 0 ? primaryColor + '33' : 'transparent', fontWeight: i === 0 ? 600 : 400, borderLeft: i === 0 ? `2px solid ${primaryColor}` : '2px solid transparent', cursor: 'default' }}>{item}</div>
            ))}
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Top bar */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{screen.screen}</span>
            <span style={{ fontSize: 9, color: '#6B7280' }}>User ▾</span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <MockScreenInner screen={screen} primaryColor={primaryColor} />
          </div>
        </div>
      </div>
    </div>
  )
}

function UXRecommendationContent({ data }) {
  if (!data) return null
  const primaryColor = data.visualTheme?.primaryColor || '#1D4ED8'
  const hasSidebar = (data.navigationModel || '').toLowerCase().includes('sidebar')
  const screens = data.primaryScreens || []

  return (
    <div style={{ background: '#F3F4F6', borderRadius: 8, padding: '16px', overflow: 'hidden' }}>
      {/* Theme strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '8px 12px', background: '#fff', borderRadius: 6, border: '1px solid #E5E7EB' }}>
        <div style={{ width: 18, height: 18, borderRadius: 4, background: primaryColor, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{data.visualTheme?.colorName || 'Theme'}</span>
        <span style={{ fontSize: 11, color: '#6B7280' }}>{data.visualTheme?.mood}</span>
        <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 'auto' }}>{data.layoutType?.replace(/_/g, ' ')} · {data.navigationModel}</span>
      </div>

      {/* Screen frames — horizontally scrollable */}
      <div style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 12 }}>
        {screens.length > 0
          ? screens.map((screen, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              <BrowserFrame screen={screen} primaryColor={primaryColor} hasSidebar={hasSidebar} />
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{screen.screen}</span>
                <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 6 }}>{(screen.keyActions || []).slice(0, 2).join(' · ')}</span>
              </div>
            </div>
          ))
          : (
            <div style={{ padding: 40, color: '#9CA3AF', fontSize: 13 }}>No screens defined.</div>
          )
        }
      </div>

      {/* Rationale */}
      {data.rationale && (
        <div style={{ marginTop: 8, padding: '10px 14px', background: '#fff', borderRadius: 6, border: '1px solid #E5E7EB' }}>
          <span style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.6, fontStyle: 'italic' }}>{data.rationale}</span>
        </div>
      )}
    </div>
  )
}

// ─── Stage definition ─────────────────────────────────────────────────────────
const STAGES = [
  { id: 'intakeSummary', label: 'Intake Summary', sublabel: 'What Aria understood', component: IntakeSummaryContent },
  { id: 'productBrief', label: 'Product Brief', sublabel: 'Objectives, roles, workflows, rules', component: ProductBriefContent },
  { id: 'workflowMap', label: 'Workflow Map', sublabel: 'Process steps, decisions, exceptions', component: WorkflowMapContent },
  { id: 'dataModel', label: 'Data Model', sublabel: 'Entities, fields, statuses, relationships', component: DataModelContent },
  { id: 'automationModel', label: 'Automation Model', sublabel: 'Triggers, notifications, escalations, integrations', component: AutomationModelContent },
  { id: 'uxRecommendation', label: 'UX Recommendation', sublabel: 'Layout, screens, visual direction', component: UXRecommendationContent },
  { id: 'appSpec', label: 'App Spec', sublabel: 'Implementation-ready specification', component: AppSpecContent },
]

// ─── Format labels for download buttons ──────────────────────────────────────
const STAGE_FORMATS = {
  intakeSummary:    ['pdf', 'docx'],
  productBrief:     ['pdf', 'docx'],
  workflowMap:      ['pdf', 'md'],
  dataModel:        ['xlsx', 'csv', 'json'],
  automationModel:  ['pdf', 'json'],
  uxRecommendation: ['pdf', 'docx'],
  appSpec:          ['pdf', 'docx', 'xlsx'],
}
const FMT = { pdf: 'PDF', docx: 'Word', xlsx: 'Excel', csv: 'CSV', json: 'JSON', md: 'Markdown' }
const FMT_ICON = { pdf: '📄', docx: '📝', xlsx: '📊', csv: '📋', json: '{ }', md: '#' }

// ─── Export dropdown (single button) ─────────────────────────────────────────
function ExportDropdown({ formats, fileUrls, artifactId, onClick }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState({})
  const ref = useRef(null)
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function doExport(fmt, e) {
    e.stopPropagation()
    const url = fileUrls[fmt]
    if (url) { window.open(url, '_blank'); setOpen(false); return }
    if (!artifactId) return
    setLoading(l => ({ ...l, [fmt]: true }))
    try {
      const res = await fetch(`${API}/api/artifacts/${artifactId}/files`, { method: 'POST' })
      const data = await res.json()
      if (data.fileUrls?.[fmt]) window.open(data.fileUrls[fmt], '_blank')
    } catch {}
    finally { setLoading(l => ({ ...l, [fmt]: false })); setOpen(false) }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        style={{ fontSize: 10, color: '#A3A3A3', background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        ↓ Export
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 4, background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 7, overflow: 'hidden', zIndex: 200, minWidth: 140, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
          {formats.map(fmt => (
            <button key={fmt} onClick={e => doExport(fmt, e)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', color: fileUrls[fmt] ? '#D4D4D4' : '#737373', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E1E1E'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span>{FMT_ICON[fmt]}</span>
              <span>{FMT[fmt]}</span>
              {loading[fmt] && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#525252' }}>...</span>}
              {fileUrls[fmt] && !loading[fmt] && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#34D399' }}>↓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Convert stage data → human-readable plain text ──────────────────────────
function stageToPlainText(stageId, data) {
  if (!data) return ''
  const list = (arr) => (arr || []).map(x => `  • ${x}`).join('\n')

  switch (stageId) {
    case 'intakeSummary':
      return [
        `Summary\n${data.understood || ''}`,
        `\nBusiness Problem\n${data.businessProblem || ''}`,
        `\nPrimary Users\n${list(data.primaryUsers)}`,
        data.secondaryUsers?.length ? `\nSecondary Users\n${list(data.secondaryUsers)}` : '',
        `\nProcess Being Replaced\n${data.currentProcess || ''}`,
        `\nMain Outcome\n${data.mainOutcome || ''}`,
      ].filter(Boolean).join('\n')

    case 'productBrief':
      return [
        `Objective\n${data.objective || ''}`,
        `\nUser Roles\n${(data.userRoles || []).map(r => `  • ${r.role} — ${r.access}${r.estimated ? ` (~${r.estimated})` : ''}`).join('\n')}`,
        `\nCore Workflows\n${list(data.coreWorkflows)}`,
        `\nBusiness Rules\n${list(data.businessRules)}`,
        `\nSuccess Criteria\n${list(data.successCriteria)}`,
        data.openQuestions?.length ? `\nOpen Questions\n${list(data.openQuestions)}` : '',
        data.assumptions?.length ? `\nAssumptions\n${list(data.assumptions)}` : '',
      ].filter(Boolean).join('\n')

    case 'workflowMap':
      return [
        `Trigger\n${data.trigger || ''}`,
        `\nProcess Steps\n${(data.steps || []).map((s, i) =>
          `  ${i + 1}. ${s.step} — ${s.actor}\n     What happens: ${s.action}\n     Output: ${s.output || 'N/A'}${s.sla && s.sla !== 'None' ? `\n     SLA: ${s.sla}` : ''}`
        ).join('\n\n')}`,
        data.decisionPoints?.length ? `\nDecision Points\n${list(data.decisionPoints)}` : '',
        data.exceptionPaths?.length ? `\nException Paths\n${list(data.exceptionPaths)}` : '',
      ].filter(Boolean).join('\n')

    case 'dataModel':
      return [
        `Primary Entity\n${data.primaryEntity || ''}`,
        `\nStatus Flow\n  ${(data.statusFlow || []).join(' → ')}`,
        `\nFields\n${(data.fields || []).map(f =>
          `  • ${f.label} (${f.type})${f.required ? ' — required' : ''}${f.options?.length ? `\n    Options: ${f.options.join(', ')}` : ''}`
        ).join('\n')}`,
        data.relationships?.length ? `\nRelationships\n${list(data.relationships)}` : '',
        data.auditFields?.length ? `\nAudit Fields\n  ${data.auditFields.join(', ')}` : '',
      ].filter(Boolean).join('\n')

    case 'automationModel':
      return [
        data.triggers?.length ? `Triggers\n${data.triggers.map(t =>
          `  • When: ${t.event}\n    If: ${t.condition}\n    Then: ${t.action}`
        ).join('\n\n')}` : '',
        data.notifications?.length ? `\nNotifications\n${data.notifications.map(n =>
          `  • ${n.event} → ${n.recipient} via ${n.channel}${n.template ? `\n    Message: "${n.template}"` : ''}`
        ).join('\n')}` : '',
        data.escalations?.length ? `\nEscalations\n${data.escalations.map(e =>
          `  • If ${e.condition}: ${e.action} (notify ${e.recipient})`
        ).join('\n')}` : '',
        data.integrations?.length ? `\nIntegrations\n${data.integrations.map(i =>
          `  • ${i.system} (${i.type}): ${i.purpose}`
        ).join('\n')}` : '',
      ].filter(Boolean).join('\n')

    case 'uxRecommendation':
      return [
        `Layout Type\n${(data.layoutType || '').replace(/_/g, ' ')}`,
        `\nNavigation\n${data.navigationModel || ''}`,
        data.visualTheme ? `\nVisual Direction\n  Mood: ${data.visualTheme.mood}\n  Color: ${data.visualTheme.colorName} (${data.visualTheme.primaryColor})\n  Why: ${data.visualTheme.rationale}` : '',
        data.primaryScreens?.length ? `\nScreens\n${data.primaryScreens.map(s =>
          `  • ${s.screen}: ${s.purpose}\n    Actions: ${(s.keyActions || []).join(', ')}`
        ).join('\n')}` : '',
        data.rationale ? `\nDesign Rationale\n${data.rationale}` : '',
      ].filter(Boolean).join('\n')

    case 'appSpec':
      return [
        `App Name\n${data.appTitle || ''}`,
        `\nTagline\n${data.tagline || ''}`,
        `\nPurpose\n${data.purpose || ''}`,
        `\nApp Type\n${data.appType || ''}`,
        `\nPrimary Action\n${data.primaryActionLabel || ''}`,
        `\nStatus Flow\n  ${(data.statusFlow || []).join(' → ')}`,
        `\nFeatures\n${list(data.features)}`,
        data.fields?.length ? `\nData Fields\n${data.fields.map(f =>
          `  • ${f.label} (${f.type})${f.required ? ' — required' : ''}`
        ).join('\n')}` : '',
      ].filter(Boolean).join('\n')

    default:
      return JSON.stringify(data, null, 2)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function localKey(artifact, stageId) {
  return `aria_edit_${artifact?.conversation_id || 'local'}_${stageId}`
}

// ─── Styled view for edited plain text (matches original design) ──────────────
// Professional document palette
const DOC = {
  heading:  '#111827',
  body:     '#374151',
  label:    '#6B7280',
  border:   '#E5E7EB',
  rowAlt:   '#F9FAFB',
  accent:   '#1D4ED8',
}

// Parse plain text into sections for rendering
function parseSections(text) {
  const lines = (text || '').split('\n')
  const sections = []
  let current = null
  for (const raw of lines) {
    const line = raw.trimEnd()
    const isHeader = line.length > 0 && !line.startsWith('  ') && !line.match(/^\s*[\d•·\-*]/)
    if (isHeader) {
      if (current) sections.push(current)
      current = { header: line.trim(), body: [] }
    } else if (current) {
      current.body.push(line)
    }
  }
  if (current) sections.push(current)
  return sections
}

// Render section body lines as styled items
function SectionBody({ lines }) {
  const bodyLines = lines.filter((l, i, a) => !(l.trim() === '' && (i === 0 || i === a.length - 1)))
  const items = []
  let i = 0
  while (i < bodyLines.length) {
    const line = bodyLines[i]
    const trimmed = line.trim()

    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
    if (numMatch) {
      const num = numMatch[1]
      const title = numMatch[2]
      const sub = []
      i++
      while (i < bodyLines.length && bodyLines[i].trim() !== '' && !bodyLines[i].trim().match(/^\d+\./)) {
        sub.push(bodyLines[i].trim()); i++
      }
      items.push(
        <div key={`n${i}`} style={{ display: 'flex', gap: 14, paddingBottom: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: DOC.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{num}</div>
            <div style={{ width: 1, flex: 1, background: DOC.border, marginTop: 4, minHeight: 8 }} />
          </div>
          <div style={{ flex: 1, paddingTop: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: DOC.heading, marginBottom: 4, lineHeight: 1.4 }}>{title}</div>
            {sub.map((s, j) => {
              const kv = s.match(/^([^:]+):\s*(.+)/)
              return kv
                ? <div key={j} style={{ fontSize: 12, color: DOC.body, marginBottom: 2 }}><span style={{ color: DOC.label, fontWeight: 500 }}>{kv[1]}: </span>{kv[2]}</div>
                : <div key={j} style={{ fontSize: 12, color: DOC.body }}>{s}</div>
            })}
          </div>
        </div>
      )
      continue
    }

    const bulletMatch = trimmed.match(/^[•·\-\*]\s+(.+)/)
    if (bulletMatch) {
      const mainText = bulletMatch[1]
      const sub = []
      i++
      while (i < bodyLines.length && bodyLines[i].trim() !== '' && !bodyLines[i].trim().match(/^[•·\-\*\d]/)) {
        sub.push(bodyLines[i].trim()); i++
      }
      items.push(
        <div key={`b${i}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: DOC.accent, flexShrink: 0, marginTop: 6 }} />
          <div>
            <span style={{ fontSize: 13, color: DOC.body, lineHeight: 1.6 }}>{mainText}</span>
            {sub.map((s, j) => <div key={j} style={{ fontSize: 11, color: DOC.label, marginTop: 2 }}>{s}</div>)}
          </div>
        </div>
      )
      continue
    }

    if (trimmed) items.push(<p key={`p${i}`} style={{ margin: 0, fontSize: 13, color: DOC.body, lineHeight: 1.65 }}>{trimmed}</p>)
    i++
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{items}</div>
}

// The document view — switches to contentEditable when editing=true
function StyledTextView({ text, editing, artifact, stageId, data, onDone, onRevert }) {
  const lsKey = localKey(artifact, stageId)
  const docRef = useRef(null)
  const debounce = useRef(null)
  const [saving, setSaving] = useState(false)

  // When editing mode turns on, focus the doc and move cursor to start
  useEffect(() => {
    if (editing && docRef.current) {
      docRef.current.focus()
      // place cursor at beginning
      const sel = window.getSelection()
      const range = document.createRange()
      range.setStart(docRef.current, 0)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [editing])

  async function persist(val) {
    localStorage.setItem(lsKey, val)
    if (artifact?.id) {
      try {
        await fetch(`${API}/api/artifacts/${artifact.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: { ...(artifact.content || {}), _manualEdit: val } }),
        })
      } catch {}
    }
  }

  function onInput() {
    // Autosave plain text from contentEditable
    const val = docRef.current?.innerText || ''
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => persist(val), 1500)
  }

  async function handleDone() {
    setSaving(true)
    clearTimeout(debounce.current)
    const val = docRef.current?.innerText || text || ''
    await persist(val)
    setSaving(false)
    onDone(val)
  }

  const displayText = text || stageToPlainText(stageId, data)
  const sections = parseSections(displayText)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Editing toolbar — only shown while editing */}
      {editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: '#F0F0FF', border: '1px solid #C4B5FD', borderRadius: '6px 6px 0 0', marginBottom: -1 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', letterSpacing: '0.06em' }}>✏ EDITING</span>
          <span style={{ fontSize: 10, color: '#9CA3AF', flex: 1 }}>Click anywhere in the document to edit</span>
          <button
            onClick={handleDone}
            disabled={saving}
            style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: saving ? '#9CA3AF' : '#1D4ED8', border: 'none', borderRadius: 5, padding: '5px 18px', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >{saving ? 'Saving…' : 'Done'}</button>
        </div>
      )}

      {/* White document card — contentEditable when editing */}
      <div
        ref={docRef}
        contentEditable={editing}
        suppressContentEditableWarning
        onInput={onInput}
        style={{
          background: '#FFFFFF',
          border: editing ? '1px solid #A78BFA' : '1px solid #E5E7EB',
          borderRadius: editing ? '0 0 6px 6px' : 6,
          padding: '28px 32px',
          position: 'relative',
          boxShadow: editing ? '0 0 0 3px rgba(167,139,250,0.15), 0 1px 8px rgba(0,0,0,0.08)' : '0 1px 8px rgba(0,0,0,0.08)',
          outline: 'none',
          cursor: editing ? 'text' : 'default',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          minHeight: 120,
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
          overflow: 'hidden',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {/* Revert button — only shown when NOT editing */}
        {!editing && (
          <button
            onClick={onRevert}
            title="Revert to original AI view"
            style={{ position: 'absolute', top: 12, right: 14, fontSize: 10, color: '#9CA3AF', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >↺ revert</button>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sections.map((sec, si) => (
            <div key={si}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: DOC.label, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '65%' }}>
                  {sec.header}
                </p>
                <div style={{ flex: 1, height: 1, background: DOC.border }} />
              </div>
              <SectionBody lines={sec.body} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Stage row ────────────────────────────────────────────────────────────────
function StageRow({ stage, index, data, isOpen, approved, onToggle, onApprove, onOpen, hasArtifact, artifact }) {
  const Component = stage.component
  const fileUrls = artifact?.file_urls || {}
  const formats = STAGE_FORMATS[stage.id] || ['pdf']
  const [editing, setEditing] = useState(false)
  // savedText: the plain-text the user saved; null means show the structured component view
  const lsKey = `aria_edit_${artifact?.conversation_id || 'local'}_${stage.id}`
  const [savedText, setSavedText] = useState(
    artifact?.content?._manualEdit || localStorage.getItem(lsKey) || null
  )

  return (
    <div style={{ borderBottom: '0.5px solid #1A1A1A' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>

        {/* Approve checkbox */}
        <button
          onClick={e => { e.stopPropagation(); onApprove() }}
          title={approved ? 'Click to unapprove' : 'Approve this stage'}
          style={{
            width: 42, alignSelf: 'stretch', flexShrink: 0,
            background: approved ? '#0D1F16' : 'transparent',
            border: 'none', borderRight: `0.5px solid ${approved ? '#34D39922' : '#1A1A1A'}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!approved) e.currentTarget.style.background = '#111' }}
          onMouseLeave={e => { if (!approved) e.currentTarget.style.background = 'transparent' }}
        >
          {approved
            ? <CheckIcon />
            : <div style={{ width: 14, height: 14, borderRadius: 4, border: '1.5px solid #2A2A2A' }} />
          }
        </button>

        {/* Label + expand */}
        <div
          onClick={onToggle}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 14px', cursor: 'pointer',
            background: isOpen ? '#141414' : 'transparent',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#111' }}
          onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
        >
          <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: '#1A1A1A', border: '0.5px solid #2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 9, color: '#525252', fontWeight: 700 }}>{index + 1}</span>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: approved ? '#34D399' : '#D4D4D4' }}>{stage.label}</span>
            <span style={{ fontSize: 10, color: '#3D3D3D', marginLeft: 8 }}>{stage.sublabel}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {approved && (
              <span style={{ fontSize: 9, color: '#34D399', background: '#0D1F16', border: '0.5px solid #34D39933', borderRadius: 3, padding: '1px 5px', fontWeight: 600, letterSpacing: '0.04em' }}>
                APPROVED
              </span>
            )}
            <div style={{ color: '#3D3D3D' }}>
              <ChevronIcon open={isOpen} />
            </div>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isOpen && (
        <div style={{ padding: '14px 16px', borderTop: '0.5px solid #1A1A1A', background: '#0D0D0D' }}>
          {/* Show structured component only when no edits and not editing */}
          {!editing && !savedText
            ? <Component data={data} />
            : (
              <StyledTextView
                text={savedText}
                editing={editing}
                artifact={artifact}
                stageId={stage.id}
                data={data}
                onDone={(text) => { setSavedText(text); setEditing(false) }}
                onRevert={() => { setSavedText(null); localStorage.removeItem(lsKey) }}
              />
            )
          }

          {/* Action bar — hide while editing (toolbar is inside StyledTextView) */}
          {!editing && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, borderTop: '0.5px solid #1A1A1A', paddingTop: 10 }}>
              <button
                onClick={onApprove}
                style={{
                  background: approved ? '#0D1F16' : '#161616',
                  color: approved ? '#34D399' : '#A3A3A3',
                  border: `0.5px solid ${approved ? '#34D39966' : '#2A2A2A'}`,
                  borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {approved && <CheckIcon />}
                {approved ? 'Approved' : 'Approve'}
              </button>

              {/* ✏ Edit inline */}
              <button
                onClick={() => setEditing(true)}
                style={{ background: '#1A1A2A', color: '#A78BFA', border: '0.5px solid #3A1E5F', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <EditIcon /> {savedText ? 'Edit again' : 'Edit'}
              </button>

              {/* Open full viewer */}
              {hasArtifact && onOpen && (
                <button
                  onClick={onOpen}
                  style={{ background: 'transparent', color: '#525252', border: '0.5px solid #222', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ↗ Open
                </button>
              )}

              {/* Single export dropdown */}
              <div style={{ marginLeft: 'auto' }}>
                <ExportDropdown formats={formats} fileUrls={fileUrls} artifactId={artifact?.id} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EnterpriseStagesCard({ brief, buildMode, onBuild, onOpenArtifact, artifactIds, artifacts = [] }) {
  const [openStage, setOpenStage] = useState('intakeSummary')
  const [approved, setApproved] = useState({})
  const [building, setBuilding] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)
  // Auto-collapse: no onBuild = already built; building started = collapse
  const isAnswered = !onBuild || building
  const [userCollapse, setUserCollapse] = useState(null)
  const collapsed = userCollapse !== null ? userCollapse : isAnswered

  if (!brief) return null

  const approvedCount = Object.values(approved).filter(Boolean).length
  const specApproved = approved['appSpec']
  const allApproved = approvedCount === STAGES.length
  const modeLabel = buildMode === 'docs' ? 'Documentation First' : 'Guided Build'

  const ARTIFACT_TYPE_MAP = {
    intakeSummary: 'intake_summary', productBrief: 'product_brief',
    workflowMap: 'workflow_map', dataModel: 'data_model',
    automationModel: 'automation_model', uxRecommendation: 'ux_recommendation',
    appSpec: 'app_spec',
  }

  function getArtifact(stageId) {
    const type = ARTIFACT_TYPE_MAP[stageId]
    const id = artifactIds?.[type]
    return artifacts.find(a => a.id === id) || null
  }

  function handleApprove(stageId) {
    setApproved(prev => ({ ...prev, [stageId]: !prev[stageId] }))
  }

  function approveAll() {
    const all = {}
    STAGES.forEach(s => { all[s.id] = true })
    setApproved(all)
  }

  async function handleBuild() {
    setBuilding(true)
    await onBuild()
  }

  return (
    <div style={{
      background: '#111111',
      border: '0.5px solid #2A2A2A',
      borderRadius: 14,
      overflow: 'hidden',
      maxWidth: '96%',
      width: '100%',
    }}>
      {/* Header */}
      <div
        onClick={() => setUserCollapse(!collapsed)}
        style={{ padding: '14px 18px', borderBottom: collapsed ? 'none' : '0.5px solid #1E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#D4D4D4' }}>
              {brief.appSpec?.appTitle || 'Enterprise App Brief'}
            </p>
            <span style={{ fontSize: 9, color: '#34D399', background: '#0D1F16', border: '0.5px solid #34D39933', borderRadius: 3, padding: '1px 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {modeLabel}
            </span>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: allApproved ? '#34D399' : '#525252' }}>
            {allApproved ? '✓ All stages approved' : `${approvedCount}/${STAGES.length} stages approved`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Progress pills */}
          <div style={{ display: 'flex', gap: 3 }}>
            {STAGES.map(s => (
              <div key={s.id} style={{
                width: 20, height: 4, borderRadius: 2,
                background: approved[s.id] ? '#34D399' : '#1E1E1E',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#525252', transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'none' }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {!collapsed && STAGES.map((stage, i) => {
        const data = brief[stage.id]
        const artifact = getArtifact(stage.id)
        const artifactId = artifact?.id
        return (
          <StageRow
            key={stage.id}
            stage={stage}
            index={i}
            data={data}
            artifact={artifact}
            isOpen={openStage === stage.id}
            approved={!!approved[stage.id]}
            onToggle={() => setOpenStage(openStage === stage.id ? null : stage.id)}
            onApprove={() => handleApprove(stage.id)}
            hasArtifact={!!artifactId}
            onOpen={artifactId && onOpenArtifact ? () => onOpenArtifact(artifactId) : null}
          />
        )
      })}

      {/* Build footer — always visible even when collapsed */}
      {collapsed && <div style={{ height: 1 }} />}
      <div style={{ padding: '14px 16px', borderTop: '0.5px solid #1E1E1E', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 4 }}>
          {!allApproved && (
            <p style={{ margin: 0, fontSize: 11, color: '#525252' }}>
              {approvedCount}/{STAGES.length} stages approved
            </p>
          )}
          {allApproved && (
            <p style={{ margin: 0, fontSize: 11, color: '#34D399' }}>✓ All stages approved — ready to build</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Approve All */}
          {!allApproved && (
            <button
              onClick={approveAll}
              style={{ background: '#0D1F16', color: '#34D399', border: '0.5px solid #34D39933', borderRadius: 7, padding: '7px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <CheckIcon /> Approve All
            </button>
          )}

          {/* Build button — show for all modes, require all approved for docs */}
          {onBuild && (
            <button
              onClick={handleBuild}
              disabled={building || (buildMode === 'docs' ? !allApproved : !specApproved)}
              style={{
                background: building || (buildMode === 'docs' ? !allApproved : !specApproved)
                  ? '#1C1C1C'
                  : 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)',
                color: building || (buildMode === 'docs' ? !allApproved : !specApproved) ? '#3D3D3D' : '#111111',
                border: `0.5px solid ${building || (buildMode === 'docs' ? !allApproved : !specApproved) ? '#222' : '#484848'}`,
                borderRadius: 8, padding: '8px 20px',
                fontSize: 12, fontWeight: 600,
                cursor: building || (buildMode === 'docs' ? !allApproved : !specApproved) ? 'default' : 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              {building ? (
                <>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #525252', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  Building...
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {buildMode === 'docs'
                    ? (allApproved ? 'Build this app' : 'Approve all stages to build')
                    : (specApproved ? 'Build this app' : 'Approve App Spec to build')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { API_URL as API } from '../lib/api'

const TYPE_META = {
  intake_summary:    { label: 'Intake Summary',    icon: '📋', color: '#60A5FA', accent: '#1E3A5F' },
  product_brief:     { label: 'Product Brief',     icon: '📄', color: '#A78BFA', accent: '#3A1E5F' },
  workflow_map:      { label: 'Workflow Map',       icon: '🔀', color: '#34D399', accent: '#1E5F3A' },
  data_model:        { label: 'Data Model',         icon: '🗂️', color: '#FBBF24', accent: '#5F4A1E' },
  automation_model:  { label: 'Automation Model',   icon: '⚡', color: '#F87171', accent: '#5F1E1E' },
  ux_recommendation: { label: 'UX Recommendation',  icon: '🎨', color: '#F472B6', accent: '#5F1E3A' },
  app_spec:          { label: 'App Spec',            icon: '⚙️', color: '#94A3B8', accent: '#2A2A2A' },
}

const FORMAT_MAP = {
  intake_summary:    ['pdf', 'docx', 'md'],
  product_brief:     ['pdf', 'docx', 'md'],
  workflow_map:      ['pdf', 'md', 'json'],
  data_model:        ['pdf', 'xlsx', 'csv', 'json'],
  automation_model:  ['pdf', 'json', 'md'],
  ux_recommendation: ['pdf', 'docx', 'md'],
  app_spec:          ['pdf', 'docx', 'xlsx', 'json'],
}

const FORMAT_LABELS = { pdf: 'PDF', docx: 'Word', xlsx: 'Excel', csv: 'CSV', json: 'JSON', md: 'Markdown' }
const FORMAT_ICONS  = { pdf: '📄', docx: '📝', xlsx: '📊', csv: '📋', json: '{ }', md: '#' }

// ─── contentToMarkdown helper ────────────────────────────────────────────────
function contentToMarkdown(artifact) {
  const lines = [`# ${artifact.title}\n`]
  function walk(obj, depth = 0) {
    if (!obj || typeof obj !== 'object') return
    for (const [key, val] of Object.entries(obj)) {
      if (key === '_manualEdit') continue
      const label = key.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
      if (typeof val === 'string' && val) {
        lines.push(`${'#'.repeat(Math.min(depth+2,4))} ${label}\n${val}\n`)
      } else if (Array.isArray(val)) {
        if (val.length === 0) continue
        lines.push(`${'#'.repeat(Math.min(depth+2,4))} ${label}\n`)
        val.forEach((item, i) => {
          if (typeof item === 'string') lines.push(`- ${item}`)
          else if (typeof item === 'object') {
            lines.push(`\n**${i+1}.**`)
            Object.entries(item).forEach(([k,v]) => {
              if (v) lines.push(`  - **${k}**: ${v}`)
            })
          }
        })
        lines.push('')
      } else if (typeof val === 'object' && val) {
        lines.push(`${'#'.repeat(Math.min(depth+2,4))} ${label}\n`)
        walk(val, depth+1)
      }
    }
  }
  walk(artifact.content || {})
  return lines.join('\n')
}

// ─── Document renderer (read-only, document-style) ───────────────────────────

function DocSection({ title, color, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</h2>
        <div style={{ flex: 1, height: 1, background: `${color}30` }} />
      </div>
      {children}
    </div>
  )
}

function DocField({ label, value }) {
  if (!value && value !== 0 && value !== false) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: '#525252', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#D4D4D4', lineHeight: 1.65 }}>{String(value)}</div>
    </div>
  )
}

function DocList({ label, items, color }) {
  if (!items?.length) return null
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 10, color: '#525252', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <span style={{ color, fontSize: 12, marginTop: 2, flexShrink: 0 }}>▸</span>
            <span style={{ fontSize: 13, color: '#C4C4C4', lineHeight: 1.6 }}>
              {typeof item === 'string' ? item : JSON.stringify(item)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DocTable({ headers, rows, color }) {
  if (!rows?.length) return null
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${color}44`, background: '#0D0D0D' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '0.5px solid #1A1A1A' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '8px 12px', color: j === 0 ? '#D4D4D4' : '#A3A3A3', verticalAlign: 'top', lineHeight: 1.5 }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusFlow({ statuses, color }) {
  if (!statuses?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      {statuses.map((s, i) => (
        <React.Fragment key={i}>
          <span style={{ fontSize: 11, color, background: '#1A1A1A', border: `1px solid ${color}44`, borderRadius: 5, padding: '4px 10px', fontWeight: 600 }}>{s}</span>
          {i < statuses.length - 1 && <span style={{ color: '#3D3D3D', fontSize: 14 }}>→</span>}
        </React.Fragment>
      ))}
    </div>
  )
}

function DocumentView({ artifact }) {
  const meta = TYPE_META[artifact.artifact_type] || {}
  const color = meta.color || '#94A3B8'
  const c = artifact.content || {}

  switch (artifact.artifact_type) {
    case 'intake_summary': return (
      <>
        <DocSection title="What Aria Understood" color={color}>
          <DocField label="Summary" value={c.understood} />
          <DocField label="Business Problem" value={c.businessProblem} />
          <DocField label="Desired Outcome" value={c.mainOutcome} />
          <DocField label="Process Being Replaced" value={c.currentProcess} />
        </DocSection>
        <DocSection title="Users" color={color}>
          <DocList label="Primary Users" items={c.primaryUsers} color={color} />
          <DocList label="Secondary Users" items={c.secondaryUsers} color={color} />
        </DocSection>
      </>
    )

    case 'product_brief': return (
      <>
        <DocSection title="Objective" color={color}>
          <p style={{ fontSize: 14, color: '#D4D4D4', lineHeight: 1.7, margin: 0 }}>{c.objective}</p>
        </DocSection>
        {c.userRoles?.length > 0 && (
          <DocSection title="User Roles" color={color}>
            <DocTable
              headers={['Role', 'Access & Capabilities', 'Est. Users']}
              rows={c.userRoles.map(r => [r.role, r.access, r.estimated || '—'])}
              color={color}
            />
          </DocSection>
        )}
        <DocSection title="Core Workflows" color={color}>
          <DocList items={c.coreWorkflows} color={color} />
        </DocSection>
        <DocSection title="Business Rules" color={color}>
          <DocList items={c.businessRules} color={color} />
        </DocSection>
        <DocSection title="Success Criteria" color={color}>
          <DocList items={c.successCriteria} color={color} />
        </DocSection>
        {c.openQuestions?.length > 0 && (
          <DocSection title="Open Questions" color={color}>
            <DocList items={c.openQuestions} color={color} />
          </DocSection>
        )}
        {c.assumptions?.length > 0 && (
          <DocSection title="Assumptions" color={color}>
            <DocList items={c.assumptions} color={color} />
          </DocSection>
        )}
      </>
    )

    case 'workflow_map': return (
      <>
        <DocSection title="Trigger" color={color}>
          <div style={{ background: '#161616', border: `1px solid ${color}33`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#D4D4D4', lineHeight: 1.6 }}>{c.trigger}</div>
        </DocSection>
        {c.steps?.length > 0 && (
          <DocSection title="Process Steps" color={color}>
            {c.steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0D0D0D', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color, fontWeight: 700 }}>{i + 1}</div>
                  {i < c.steps.length - 1 && <div style={{ width: 2, flex: 1, background: `${color}22`, marginTop: 4, minHeight: 20 }} />}
                </div>
                <div style={{ flex: 1, background: '#141414', border: '0.5px solid #2A2A2A', borderRadius: 8, padding: '12px 16px', marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#E5E5E5' }}>{step.step}</span>
                    <span style={{ fontSize: 10, color: '#525252', background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 3, padding: '2px 8px' }}>{step.actor}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#A3A3A3', marginBottom: step.output || step.sla ? 8 : 0, lineHeight: 1.6 }}>{step.action}</div>
                  {step.output && <div style={{ fontSize: 11, color: '#737373' }}>Output: {step.output}</div>}
                  {step.sla && <div style={{ fontSize: 11, color, marginTop: 4 }}>⏱ SLA: {step.sla}</div>}
                </div>
              </div>
            ))}
          </DocSection>
        )}
        <DocSection title="Decision Points" color={color}>
          <DocList items={c.decisionPoints} color={color} />
        </DocSection>
        <DocSection title="Exception Paths" color={color}>
          <DocList items={c.exceptionPaths} color={color} />
        </DocSection>
      </>
    )

    case 'data_model': return (
      <>
        <DocSection title="Primary Entity" color={color}>
          <div style={{ fontSize: 18, fontWeight: 700, color, marginBottom: 8 }}>{c.primaryEntity}</div>
        </DocSection>
        {c.fields?.length > 0 && (
          <DocSection title="Fields" color={color}>
            <DocTable
              headers={['Field Name', 'Label', 'Type', 'Required', 'Options']}
              rows={c.fields.map(f => [
                <code style={{ fontFamily: 'monospace', fontSize: 11, color: '#A3A3A3' }}>{f.name}</code>,
                f.label, f.type,
                f.required ? <span style={{ color: '#34D399' }}>Yes</span> : <span style={{ color: '#525252' }}>No</span>,
                f.options?.join(', ') || '—',
              ])}
              color={color}
            />
          </DocSection>
        )}
        <DocSection title="Status Flow" color={color}>
          <StatusFlow statuses={c.statusFlow} color={color} />
        </DocSection>
        <DocSection title="Relationships" color={color}>
          <DocList items={c.relationships} color={color} />
        </DocSection>
        <DocSection title="Audit Fields" color={color}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {c.auditFields?.map(f => <code key={f} style={{ fontSize: 11, color: '#737373', background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 4, padding: '3px 8px' }}>{f}</code>)}
          </div>
        </DocSection>
      </>
    )

    case 'automation_model': return (
      <>
        {c.triggers?.length > 0 && (
          <DocSection title="Triggers" color={color}>
            {c.triggers.map((t, i) => (
              <div key={i} style={{ background: '#141414', border: '0.5px solid #2A2A2A', borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#E5E5E5', marginBottom: 6 }}>{t.event}</div>
                <div style={{ fontSize: 12, color: '#737373', marginBottom: 4 }}>Condition: {t.condition}</div>
                <div style={{ fontSize: 12, color }}>→ {t.action}</div>
              </div>
            ))}
          </DocSection>
        )}
        {c.notifications?.length > 0 && (
          <DocSection title="Notifications" color={color}>
            <DocTable
              headers={['Event', 'Recipient', 'Channel', 'Message']}
              rows={c.notifications.map(n => [n.event, n.recipient, n.channel, n.template || '—'])}
              color={color}
            />
          </DocSection>
        )}
        {c.escalations?.length > 0 && (
          <DocSection title="Escalations" color={color}>
            {c.escalations.map((e, i) => (
              <div key={i} style={{ background: '#1A0D0D', border: '0.5px solid #5F1E1E', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#F87171', marginBottom: 4 }}>Trigger: {e.condition}</div>
                <div style={{ fontSize: 12, color: '#D4D4D4' }}>→ {e.action} → {e.recipient}</div>
              </div>
            ))}
          </DocSection>
        )}
        {c.integrations?.length > 0 && (
          <DocSection title="Integrations" color={color}>
            <DocTable
              headers={['System', 'Type', 'Purpose']}
              rows={c.integrations.map(i => [i.system, i.type, i.purpose])}
              color={color}
            />
          </DocSection>
        )}
      </>
    )

    case 'ux_recommendation': return (
      <>
        <DocSection title="Layout Direction" color={color}>
          <DocField label="Layout Type" value={c.layoutType} />
          <DocField label="Navigation Model" value={c.navigationModel} />
          <DocField label="Rationale" value={c.rationale} />
        </DocSection>
        {c.visualTheme && (
          <DocSection title="Visual Theme" color={color}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, background: '#141414', border: '0.5px solid #2A2A2A', borderRadius: 8, padding: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: c.visualTheme.primaryColor, flexShrink: 0, boxShadow: `0 4px 16px ${c.visualTheme.primaryColor}44` }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#E5E5E5', marginBottom: 3 }}>{c.visualTheme.colorName}</div>
                <div style={{ fontSize: 11, color: '#525252', fontFamily: 'monospace', marginBottom: 3 }}>{c.visualTheme.primaryColor}</div>
                <div style={{ fontSize: 11, color: '#737373', textTransform: 'capitalize' }}>{c.visualTheme.mood}</div>
              </div>
            </div>
            <DocField label="Design Rationale" value={c.visualTheme.rationale} />
          </DocSection>
        )}
        {c.primaryScreens?.length > 0 && (
          <DocSection title="Primary Screens" color={color}>
            {c.primaryScreens.map((s, i) => (
              <div key={i} style={{ background: '#141414', border: '0.5px solid #2A2A2A', borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#E5E5E5', marginBottom: 5 }}>{s.screen}</div>
                <div style={{ fontSize: 12, color: '#A3A3A3', marginBottom: 8 }}>{s.purpose}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {s.keyActions?.map((a, j) => <span key={j} style={{ fontSize: 10, color: '#525252', background: '#111', border: '0.5px solid #222', borderRadius: 4, padding: '3px 8px' }}>{a}</span>)}
                </div>
              </div>
            ))}
          </DocSection>
        )}
      </>
    )

    case 'app_spec': return (
      <>
        <DocSection title="App Identity" color={color}>
          <div style={{ background: '#141414', border: '0.5px solid #2A2A2A', borderRadius: 10, padding: '20px 24px', marginBottom: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F5F5', marginBottom: 6 }}>{c.appTitle}</div>
            <div style={{ fontSize: 13, color, fontWeight: 600, marginBottom: 8 }}>{c.appType}</div>
            <div style={{ fontSize: 13, color: '#A3A3A3', lineHeight: 1.6 }}>{c.tagline}</div>
          </div>
          <DocField label="Purpose" value={c.purpose} />
          <DocField label="Primary Action" value={c.primaryActionLabel} />
        </DocSection>
        <DocSection title="Features" color={color}>
          <DocList items={c.features} color={color} />
        </DocSection>
        {c.fields?.length > 0 && (
          <DocSection title="Data Fields" color={color}>
            <DocTable
              headers={['Field Name', 'Label', 'Type', 'Required']}
              rows={c.fields.map(f => [
                <code style={{ fontFamily: 'monospace', fontSize: 11 }}>{f.name}</code>,
                f.label, f.type,
                f.required ? <span style={{ color: '#34D399' }}>Yes</span> : '—',
              ])}
              color={color}
            />
          </DocSection>
        )}
        <DocSection title="Status Flow" color={color}>
          <StatusFlow statuses={c.statusFlow} color={color} />
        </DocSection>
      </>
    )

    default:
      return <pre style={{ fontSize: 11, color: '#A3A3A3', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>{JSON.stringify(c, null, 2)}</pre>
  }
}

// ─── AI Edit pane (secondary, opt-in) ────────────────────────────────────────
function AIEditPane({ artifact, onDone }) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!instruction.trim() || loading) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/api/artifacts/ai-edit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifactId: artifact.id, instruction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI edit failed')
      onDone(data.artifact)
      setInstruction('')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ padding: '14px 16px', borderTop: '0.5px solid #2A2A2A', background: '#0A0A0A' }}>
      <div style={{ fontSize: 10, color: '#525252', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>✦ Ask Aria to edit</div>
      <textarea value={instruction} onChange={e => setInstruction(e.target.value)}
        placeholder='e.g. "Add a Finance Director approval step after manager approval"'
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
        style={{ width: '100%', minHeight: 72, background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 6, color: '#D4D4D4', fontSize: 12, padding: '8px 12px', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5 }}
      />
      {error && <div style={{ fontSize: 11, color: '#F87171', marginTop: 6 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={submit} disabled={loading || !instruction.trim()}
          style={{ background: '#1A0D2A', color: loading ? '#525252' : '#A78BFA', border: '0.5px solid #3A1E5F', borderRadius: 5, padding: '6px 14px', fontSize: 11, cursor: loading || !instruction.trim() ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {loading ? 'Working…' : '✦ Apply with Aria  ⌘↵'}
        </button>
      </div>
    </div>
  )
}

// ─── Manual text editor ───────────────────────────────────────────────────────
function ManualEditor({ artifact, onSaved, onCancel }) {
  const initialText = artifact.content?._manualEdit || contentToMarkdown(artifact)
  const [text, setText] = useState(initialText)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'unsaved' | 'saving' | 'saved'
  const debounceRef = useRef(null)

  async function doSave(value) {
    setSaveStatus('saving')
    try {
      const res = await fetch(`${API}/api/artifacts/${artifact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { ...artifact.content, _manualEdit: value } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSaveStatus('saved')
      onSaved?.(data.artifact)
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('unsaved')
    }
  }

  function handleChange(e) {
    const val = e.target.value
    setText(val)
    setSaveStatus('unsaved')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave(val), 2000)
  }

  async function handleSave() {
    clearTimeout(debounceRef.current)
    await doSave(text)
  }

  const statusLabel = {
    idle: '',
    unsaved: 'Unsaved changes',
    saving: 'Saving...',
    saved: 'Saved ✓',
  }[saveStatus]

  const statusColor = {
    idle: '#525252',
    unsaved: '#FBBF24',
    saving: '#737373',
    saved: '#34D399',
  }[saveStatus]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Editor header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px', borderBottom: '0.5px solid #1A1A1A', background: '#0D0D0D', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: statusColor, flex: 1 }}>{statusLabel}</span>
        <button onClick={onCancel}
          style={{ background: 'transparent', color: '#737373', border: '0.5px solid #2A2A2A', borderRadius: 5, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saveStatus === 'saving'}
          style={{ background: '#0D2A1A', color: saveStatus === 'saving' ? '#525252' : '#34D399', border: '0.5px solid #34D39933', borderRadius: 5, padding: '5px 14px', fontSize: 11, cursor: saveStatus === 'saving' ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
          Save
        </button>
      </div>
      {/* Textarea */}
      <textarea
        value={text}
        onChange={handleChange}
        style={{
          flex: 1,
          background: '#0D0D0D',
          color: '#D4D4D4',
          border: 'none',
          padding: '24px 32px',
          fontSize: 13,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          lineHeight: 1.7,
          resize: 'none',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ─── Export dropdown ──────────────────────────────────────────────────────────
function ExportDropdown({ artifact, formats, fileUrls, onRegenFiles, generatingFiles }) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState({})
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleFormat(fmt) {
    const url = fileUrls[fmt]
    if (url) {
      window.open(url, '_blank')
      setOpen(false)
      return
    }
    setDownloading(d => ({ ...d, [fmt]: true }))
    try {
      const res = await fetch(`${API}/api/artifacts/${artifact.id}/files`, { method: 'POST' })
      const data = await res.json()
      if (data.fileUrls?.[fmt]) window.open(data.fileUrls[fmt], '_blank')
      else if (data.fileUrls) onRegenFiles?.(data.fileUrls)
    } catch (e) { console.error(e) }
    finally { setDownloading(d => ({ ...d, [fmt]: false })); setOpen(false) }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ background: '#161616', color: '#A3A3A3', border: '0.5px solid #2A2A2A', borderRadius: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
        {generatingFiles ? <span style={{ display: 'inline-block', width: 8, height: 8, border: '1.5px solid #525252', borderTopColor: '#A3A3A3', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : '↓'} Export
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 7, overflow: 'hidden', zIndex: 100, minWidth: 130, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          {formats.map(fmt => (
            <button key={fmt} onClick={() => handleFormat(fmt)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', color: fileUrls[fmt] ? '#D4D4D4' : '#737373', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E1E1E'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span>{FORMAT_ICONS[fmt]}</span>
              <span>{FORMAT_LABELS[fmt]}</span>
              {downloading[fmt] && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#525252' }}>...</span>}
              {fileUrls[fmt] && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#34D399' }}>↓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ArtifactViewer ──────────────────────────────────────────────────────
export default function ArtifactViewer({ artifact: initial, onClose, onApprove, onUpdate }) {
  const [artifact, setArtifact] = useState(initial)
  const [mode, setMode] = useState('view')   // 'view' | 'manual' | 'ai'
  const [fileUrls, setFileUrls] = useState(initial?.file_urls || {})
  const [generatingFiles, setGeneratingFiles] = useState(false)

  const meta = TYPE_META[artifact.artifact_type] || {}
  const color = meta.color || '#94A3B8'
  const formats = FORMAT_MAP[artifact.artifact_type] || ['pdf', 'json', 'md']

  useEffect(() => {
    setArtifact(initial)
    setFileUrls(initial?.file_urls || {})
    setMode('view')
  }, [initial?.id])

  // Auto-generate files if not yet generated
  useEffect(() => {
    if (!initial?.id) return
    const hasFiles = initial?.file_urls && Object.keys(initial.file_urls).length > 0
    if (!hasFiles) generateFiles(initial.id)
  }, [initial?.id])

  async function generateFiles(id) {
    setGeneratingFiles(true)
    try {
      const res = await fetch(`${API}/api/artifacts/${id}/files`, { method: 'POST' })
      const data = await res.json()
      if (data.fileUrls) {
        setFileUrls(data.fileUrls)
        setArtifact(prev => ({ ...prev, file_urls: data.fileUrls }))
        onUpdate?.({ ...artifact, file_urls: data.fileUrls })
      }
    } catch (e) { console.error('File gen error:', e) }
    finally { setGeneratingFiles(false) }
  }

  function handleManualSaved(updated) {
    setArtifact(updated)
    onUpdate?.(updated)
  }

  function handleAIDone(newArtifact) {
    setArtifact(newArtifact)
    setFileUrls(newArtifact.file_urls || {})
    onUpdate?.(newArtifact)
    setMode('view')
    generateFiles(newArtifact.id)
  }

  async function handleApprove() {
    const res = await fetch(`${API}/api/artifacts/${artifact.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    const data = await res.json()
    if (res.ok) { setArtifact(data.artifact); onUpdate?.(data.artifact); onApprove?.(data.artifact) }
  }

  const statusColors = { draft: '#737373', approved: '#34D399', built: '#60A5FA', superseded: '#525252' }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div style={{
        width: 'min(820px, 96vw)', margin: '24px auto',
        background: '#111', border: '0.5px solid #2A2A2A', borderRadius: 14,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 32px 100px rgba(0,0,0,0.7)',
      }}>

        {/* Color accent */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, ${color}44)`, flexShrink: 0 }} />

        {/* Document header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '0.5px solid #1A1A1A', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{meta.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: '0 0 5px', fontSize: 18, fontWeight: 800, color: '#F5F5F5', lineHeight: 1.2 }}>{artifact.title}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color, background: '#1A1A1A', border: `0.5px solid ${color}44`, borderRadius: 4, padding: '2px 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{meta.label}</span>
                <span style={{ fontSize: 11, color: '#3D3D3D' }}>Version {artifact.version}</span>
                <span style={{ fontSize: 11, color: statusColors[artifact.status], fontWeight: 600, textTransform: 'capitalize' }}>{artifact.status}</span>
              </div>
            </div>

            {/* Header action buttons — view mode */}
            {mode === 'view' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button onClick={() => setMode('ai')}
                  style={{ background: '#1A0D2A', color: '#A78BFA', border: '0.5px solid #3A1E5F', borderRadius: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✦ Ask Aria
                </button>
                <button onClick={() => setMode('manual')}
                  style={{ background: '#1A1A1A', color: '#D4D4D4', border: '0.5px solid #2A2A2A', borderRadius: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✏ Edit
                </button>
                {artifact.status !== 'approved' ? (
                  <button onClick={handleApprove}
                    style={{ background: '#0D1F16', color: '#34D399', border: '0.5px solid #34D39944', borderRadius: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                    ✓ Approve
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: '#34D399', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    Approved
                  </span>
                )}
                <ExportDropdown
                  artifact={artifact}
                  formats={formats}
                  fileUrls={fileUrls}
                  onRegenFiles={urls => { setFileUrls(urls); setArtifact(prev => ({ ...prev, file_urls: urls })) }}
                  generatingFiles={generatingFiles}
                />
                <button onClick={onClose} style={{ background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 6, color: '#525252', cursor: 'pointer', fontSize: 16, padding: '4px 8px', lineHeight: 1 }}>✕</button>
              </div>
            )}

            {/* Header buttons — AI mode */}
            {mode === 'ai' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button onClick={() => setMode('view')}
                  style={{ background: 'transparent', color: '#737373', border: '0.5px solid #2A2A2A', borderRadius: 5, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ← Back
                </button>
                <button onClick={onClose} style={{ background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 6, color: '#525252', cursor: 'pointer', fontSize: 16, padding: '4px 8px', lineHeight: 1 }}>✕</button>
              </div>
            )}

            {/* Header buttons shown inside ManualEditor itself (close only here) */}
            {mode === 'manual' && (
              <button onClick={onClose} style={{ background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 6, color: '#525252', cursor: 'pointer', fontSize: 16, padding: '4px 8px', lineHeight: 1 }}>✕</button>
            )}
          </div>
        </div>

        {/* Document body */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {mode === 'view' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
              <DocumentView artifact={artifact} />
            </div>
          )}

          {mode === 'manual' && (
            <ManualEditor
              artifact={artifact}
              onSaved={handleManualSaved}
              onCancel={() => setMode('view')}
            />
          )}

          {mode === 'ai' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
              <DocumentView artifact={artifact} />
            </div>
          )}
        </div>

        {/* AI Edit pane at bottom when in ai mode */}
        {mode === 'ai' && (
          <AIEditPane artifact={artifact} onDone={handleAIDone} />
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

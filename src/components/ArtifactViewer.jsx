import React, { useState, useEffect, useRef, useCallback } from 'react'
import { API_URL as API } from '../lib/api'
import { logAction } from '../lib/devlog'

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

// ─── Document styles (white-background professional document) ─────────────────
const D = {
  heading:   { color: '#111111' },
  body:      { color: '#374151' },
  label:     { color: '#6B7280' },
  border:    '#E5E7EB',
  tableHdr:  '#F3F4F6',
  mutedText: '#9CA3AF',
}

// ─── Document sub-components (white doc style) ────────────────────────────────

function DocSection({ title, color, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h2 style={{
          margin: 0, fontSize: 11, fontWeight: 700, color: D.label.color,
          textTransform: 'uppercase', letterSpacing: '0.10em',
        }}>{title}</h2>
        <div style={{ flex: 1, height: 1, background: D.border }} />
      </div>
      {children}
    </div>
  )
}

function DocField({ label, value }) {
  if (!value && value !== 0 && value !== false) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, ...D.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, ...D.body, lineHeight: 1.7 }}>{String(value)}</div>
    </div>
  )
}

function DocList({ label, items, color, numbered }) {
  if (!items?.length) return null
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ fontSize: 10, ...D.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{label}</div>}
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', counterReset: 'list-counter' }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
            {numbered
              ? <span style={{ fontSize: 11, color: '#FFFFFF', background: color, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
              : <span style={{ color: D.mutedText, fontSize: 16, flexShrink: 0, marginTop: 1, lineHeight: 1 }}>•</span>
            }
            <span style={{ fontSize: 13.5, ...D.body, lineHeight: 1.65 }}>
              {typeof item === 'string' ? item : JSON.stringify(item)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function DocTable({ headers, rows, color }) {
  if (!rows?.length) return null
  return (
    <div style={{ overflowX: 'auto', marginBottom: 20, border: `1px solid ${D.border}`, borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={h} style={{
                textAlign: 'left', padding: '9px 14px',
                fontSize: 10, ...D.label, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                background: D.tableHdr,
                borderBottom: `1px solid ${D.border}`,
                borderRight: i < headers.length - 1 ? `1px solid ${D.border}` : 'none',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? '#F9F9F9' : '#FFFFFF' }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '9px 14px', ...D.body, verticalAlign: 'top', lineHeight: 1.55,
                  borderBottom: i < rows.length - 1 ? `1px solid ${D.border}` : 'none',
                  borderRight: j < row.length - 1 ? `1px solid ${D.border}` : 'none',
                  fontWeight: j === 0 ? 500 : 400,
                }}>{cell}</td>
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
          <span style={{
            fontSize: 12, color, background: `${color}15`,
            border: `1px solid ${color}40`, borderRadius: 20,
            padding: '4px 14px', fontWeight: 600,
          }}>{s}</span>
          {i < statuses.length - 1 && <span style={{ color: D.mutedText, fontSize: 16, fontWeight: 300 }}>→</span>}
        </React.Fragment>
      ))}
    </div>
  )
}

function HighlightBox({ children, bg = '#FFFBEB', border = '#FDE68A' }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: '14px 18px', marginBottom: 16 }}>
      {children}
    </div>
  )
}

// ─── Document renderer (white-background, read-only) ─────────────────────────
function DocumentView({ artifact }) {
  const meta = TYPE_META[artifact.artifact_type] || {}
  const color = meta.color || '#94A3B8'
  const c = artifact.content || {}

  const docTitle = {
    fontSize: 26, fontWeight: 800, ...D.heading, marginBottom: 6, lineHeight: 1.2,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }
  const docSubtitle = {
    fontSize: 13, ...D.label, marginBottom: 32,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }

  switch (artifact.artifact_type) {

    case 'intake_summary': return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <h1 style={docTitle}>Intake Summary</h1>
        <p style={docSubtitle}>{artifact.title}</p>

        {c.understood && (
          <DocSection title="Executive Summary" color={color}>
            <p style={{ fontSize: 14, ...D.body, lineHeight: 1.75, margin: 0 }}>{c.understood}</p>
          </DocSection>
        )}

        <DocSection title="Project Details" color={color}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            <DocField label="Business Problem" value={c.businessProblem} />
            <DocField label="Desired Outcome" value={c.mainOutcome} />
            <DocField label="Process Being Replaced" value={c.currentProcess} />
          </div>
        </DocSection>

        {(c.primaryUsers?.length > 0 || c.secondaryUsers?.length > 0) && (
          <DocSection title="Users & Stakeholders" color={color}>
            <DocList label="Primary Users" items={c.primaryUsers} color={color} />
            <DocList label="Secondary Users" items={c.secondaryUsers} color={color} />
          </DocSection>
        )}
      </div>
    )

    case 'product_brief': return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <h1 style={docTitle}>{artifact.title}</h1>
        <p style={docSubtitle}>Product Brief</p>

        {c.objective && (
          <DocSection title="Objective" color={color}>
            <p style={{ fontSize: 15, ...D.body, lineHeight: 1.8, margin: 0, fontStyle: 'italic' }}>{c.objective}</p>
          </DocSection>
        )}

        {c.userRoles?.length > 0 && (
          <DocSection title="User Roles" color={color}>
            <DocTable
              headers={['Role', 'Access & Capabilities', 'Est. Users']}
              rows={c.userRoles.map(r => [r.role, r.access, r.estimated || '—'])}
              color={color}
            />
          </DocSection>
        )}

        {c.coreWorkflows?.length > 0 && (
          <DocSection title="Core Workflows" color={color}>
            <DocList items={c.coreWorkflows} color={color} numbered />
          </DocSection>
        )}

        {c.businessRules?.length > 0 && (
          <DocSection title="Business Rules" color={color}>
            <DocList items={c.businessRules} color={color} numbered />
          </DocSection>
        )}

        {c.successCriteria?.length > 0 && (
          <DocSection title="Success Criteria" color={color}>
            <DocList items={c.successCriteria} color={color} numbered />
          </DocSection>
        )}

        {(c.openQuestions?.length > 0 || c.assumptions?.length > 0) && (
          <DocSection title="Open Questions & Assumptions" color={color}>
            <HighlightBox>
              <DocList label="Open Questions" items={c.openQuestions} color={color} />
              <DocList label="Assumptions" items={c.assumptions} color={color} />
            </HighlightBox>
          </DocSection>
        )}
      </div>
    )

    case 'workflow_map': return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <h1 style={docTitle}>{artifact.title}</h1>
        <p style={docSubtitle}>Workflow Map</p>

        {c.trigger && (
          <DocSection title="Trigger" color={color}>
            <div style={{
              background: `${color}10`, border: `1px solid ${color}40`,
              borderRadius: 6, padding: '14px 18px',
              fontSize: 14, ...D.body, lineHeight: 1.65,
            }}>{c.trigger}</div>
          </DocSection>
        )}

        {c.steps?.length > 0 && (
          <DocSection title="Process Steps" color={color}>
            {c.steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                {/* Step number column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: '#FFFFFF', fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</div>
                  {i < c.steps.length - 1 && (
                    <div style={{ width: 2, flex: 1, background: `${color}30`, marginTop: 4, minHeight: 24 }} />
                  )}
                </div>
                {/* Step content */}
                <div style={{
                  flex: 1, border: `1px solid ${D.border}`, borderRadius: 8,
                  padding: '14px 18px', marginBottom: 4, background: '#FAFAFA',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, ...D.heading }}>{step.step}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {step.actor && (
                        <span style={{
                          fontSize: 11, ...D.label, background: '#F3F4F6',
                          border: `1px solid ${D.border}`, borderRadius: 20, padding: '3px 10px', fontWeight: 500,
                        }}>{step.actor}</span>
                      )}
                      {step.sla && (
                        <span style={{ fontSize: 11, color, fontWeight: 500 }}>⏱ {step.sla}</span>
                      )}
                    </div>
                  </div>
                  {step.action && <div style={{ fontSize: 13, ...D.body, lineHeight: 1.6, marginBottom: step.output ? 8 : 0 }}>{step.action}</div>}
                  {step.output && <div style={{ fontSize: 12, ...D.label, fontStyle: 'italic' }}>Output: {step.output}</div>}
                </div>
              </div>
            ))}
          </DocSection>
        )}

        {c.decisionPoints?.length > 0 && (
          <DocSection title="Decision Points" color={color}>
            {c.decisionPoints.map((d, i) => (
              <div key={i} style={{ border: `1px solid ${D.border}`, borderLeft: `3px solid ${color}`, borderRadius: 4, padding: '10px 14px', marginBottom: 8, fontSize: 13, ...D.body }}>
                {typeof d === 'string' ? d : JSON.stringify(d)}
              </div>
            ))}
          </DocSection>
        )}

        {c.exceptionPaths?.length > 0 && (
          <DocSection title="Exception Paths" color={color}>
            {c.exceptionPaths.map((e, i) => (
              <div key={i} style={{ border: `1px solid #FCA5A5`, borderLeft: '3px solid #EF4444', borderRadius: 4, padding: '10px 14px', marginBottom: 8, fontSize: 13, ...D.body, background: '#FFF5F5' }}>
                {typeof e === 'string' ? e : JSON.stringify(e)}
              </div>
            ))}
          </DocSection>
        )}
      </div>
    )

    case 'data_model': return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <h1 style={docTitle}>{artifact.title}</h1>
        <p style={docSubtitle}>Data Model</p>

        {c.primaryEntity && (
          <DocSection title="Primary Entity" color={color}>
            <div style={{ fontSize: 20, fontWeight: 800, color, marginBottom: 12 }}>{c.primaryEntity}</div>
            {c.statusFlow?.length > 0 && (
              <>
                <div style={{ fontSize: 10, ...D.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Status Flow</div>
                <StatusFlow statuses={c.statusFlow} color={color} />
              </>
            )}
          </DocSection>
        )}

        {c.fields?.length > 0 && (
          <DocSection title="Fields" color={color}>
            <DocTable
              headers={['Field Name', 'Label', 'Type', 'Required', 'Options']}
              rows={c.fields.map((f, i) => [
                <code key={i} style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12, color: '#1F2937', background: '#F3F4F6', borderRadius: 3, padding: '1px 5px' }}>{f.name}</code>,
                f.label,
                f.type,
                f.required
                  ? <span style={{ color: '#059669', fontWeight: 600 }}>Yes</span>
                  : <span style={{ ...D.label }}>No</span>,
                f.options?.join(', ') || '—',
              ])}
              color={color}
            />
          </DocSection>
        )}

        {c.relationships?.length > 0 && (
          <DocSection title="Relationships" color={color}>
            <DocList items={c.relationships} color={color} />
          </DocSection>
        )}

        {c.auditFields?.length > 0 && (
          <DocSection title="Audit Fields" color={color}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {c.auditFields.map(f => (
                <code key={f} style={{
                  fontSize: 12, ...D.body, background: '#F3F4F6',
                  border: `1px solid ${D.border}`, borderRadius: 4, padding: '3px 10px',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                }}>{f}</code>
              ))}
            </div>
          </DocSection>
        )}
      </div>
    )

    case 'automation_model': return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <h1 style={docTitle}>{artifact.title}</h1>
        <p style={docSubtitle}>Automation Model</p>

        {c.triggers?.length > 0 && (
          <DocSection title="Triggers" color={color}>
            {c.triggers.map((t, i) => (
              <div key={i} style={{ border: `1px solid ${D.border}`, borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ background: D.tableHdr, padding: '10px 16px', borderBottom: `1px solid ${D.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, ...D.heading }}>{t.event}</span>
                </div>
                <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px 12px', alignItems: 'start' }}>
                  <span style={{ fontSize: 10, ...D.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', paddingTop: 2 }}>When</span>
                  <span style={{ fontSize: 13, ...D.body }}>{t.event}</span>
                  {t.condition && <>
                    <span style={{ fontSize: 10, ...D.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', paddingTop: 2 }}>If</span>
                    <span style={{ fontSize: 13, ...D.body }}>{t.condition}</span>
                  </>}
                  <span style={{ fontSize: 10, ...D.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', paddingTop: 2 }}>Then</span>
                  <span style={{ fontSize: 13, color, fontWeight: 500 }}>{t.action}</span>
                </div>
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
              <div key={i} style={{
                background: '#FFF5F5', border: '1px solid #FCA5A5',
                borderLeft: '3px solid #EF4444', borderRadius: 6,
                padding: '12px 16px', marginBottom: 10,
              }}>
                <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginBottom: 6 }}>Trigger: {e.condition}</div>
                <div style={{ fontSize: 13, ...D.body }}>→ {e.action}{e.recipient ? ` → ${e.recipient}` : ''}</div>
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
      </div>
    )

    case 'ux_recommendation': return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <h1 style={docTitle}>{artifact.title}</h1>
        <p style={docSubtitle}>UX Recommendation</p>

        <DocSection title="Layout Direction" color={color}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            <DocField label="Layout Type" value={c.layoutType} />
            <DocField label="Navigation Model" value={c.navigationModel} />
          </div>
          <DocField label="Rationale" value={c.rationale} />
        </DocSection>

        {c.visualTheme && (
          <DocSection title="Visual Theme" color={color}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', padding: '16px 20px', border: `1px solid ${D.border}`, borderRadius: 8, marginBottom: 16, background: '#FAFAFA' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 8, flexShrink: 0,
                background: c.visualTheme.primaryColor,
                boxShadow: `0 4px 12px ${c.visualTheme.primaryColor}55`,
              }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, ...D.heading, marginBottom: 4 }}>{c.visualTheme.colorName}</div>
                <code style={{ fontSize: 12, ...D.label, fontFamily: 'ui-monospace, monospace', display: 'block', marginBottom: 4 }}>{c.visualTheme.primaryColor}</code>
                <div style={{ fontSize: 12, ...D.label, textTransform: 'capitalize' }}>{c.visualTheme.mood}</div>
              </div>
            </div>
            <DocField label="Design Rationale" value={c.visualTheme.rationale} />
          </DocSection>
        )}

        {c.primaryScreens?.length > 0 && (
          <DocSection title="Primary Screens" color={color}>
            {c.primaryScreens.map((s, i) => (
              <div key={i} style={{ border: `1px solid ${D.border}`, borderRadius: 8, padding: '16px 20px', marginBottom: 12, background: '#FAFAFA' }}>
                <div style={{ fontSize: 14, fontWeight: 700, ...D.heading, marginBottom: 6 }}>{s.screen}</div>
                <div style={{ fontSize: 13, ...D.body, marginBottom: 12, lineHeight: 1.6 }}>{s.purpose}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {s.keyActions?.map((a, j) => (
                    <span key={j} style={{
                      fontSize: 11, ...D.label, background: '#F3F4F6',
                      border: `1px solid ${D.border}`, borderRadius: 4, padding: '4px 10px',
                    }}>{a}</span>
                  ))}
                </div>
              </div>
            ))}
          </DocSection>
        )}
      </div>
    )

    case 'app_spec': return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* App identity header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h1 style={{ ...docTitle, margin: 0 }}>{c.appTitle || artifact.title}</h1>
            {c.appType && (
              <span style={{
                fontSize: 11, color, background: `${color}15`,
                border: `1px solid ${color}40`, borderRadius: 20,
                padding: '4px 12px', fontWeight: 600, marginTop: 4, whiteSpace: 'nowrap',
              }}>{c.appType}</span>
            )}
          </div>
          {c.tagline && <p style={{ fontSize: 15, ...D.body, margin: '0 0 6px', lineHeight: 1.6 }}>{c.tagline}</p>}
        </div>

        {(c.purpose || c.primaryActionLabel) && (
          <DocSection title="Overview" color={color}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
              <DocField label="Purpose" value={c.purpose} />
              <DocField label="Primary Action" value={c.primaryActionLabel} />
            </div>
          </DocSection>
        )}

        {c.statusFlow?.length > 0 && (
          <DocSection title="Status Flow" color={color}>
            <StatusFlow statuses={c.statusFlow} color={color} />
          </DocSection>
        )}

        {c.features?.length > 0 && (
          <DocSection title="Features" color={color}>
            <DocList items={c.features} color={color} />
          </DocSection>
        )}

        {c.fields?.length > 0 && (
          <DocSection title="Data Fields" color={color}>
            <DocTable
              headers={['Field Name', 'Label', 'Type', 'Required']}
              rows={c.fields.map((f, i) => [
                <code key={i} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#1F2937', background: '#F3F4F6', borderRadius: 3, padding: '1px 5px' }}>{f.name}</code>,
                f.label, f.type,
                f.required ? <span style={{ color: '#059669', fontWeight: 600 }}>Yes</span> : <span style={D.label}>—</span>,
              ])}
              color={color}
            />
          </DocSection>
        )}
      </div>
    )

    default:
      return (
        <pre style={{ fontSize: 12, ...D.body, whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0, fontFamily: 'ui-monospace, monospace' }}>
          {JSON.stringify(c, null, 2)}
        </pre>
      )
  }
}

// ─── AI Edit pane (secondary, opt-in) ────────────────────────────────────────
function AIEditPane({ artifact, onDone }) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!instruction.trim() || loading) return
    logAction('artifact.ai_edit_submitted', { artifactId: artifact?.id, instructionLength: instruction.length })
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
    logAction('artifact.manual_edit_saved', { artifactId: artifact?.id })
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px', borderBottom: '1px solid #D1D5DB', background: '#F9FAFB', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: statusColor, flex: 1 }}>{statusLabel}</span>
        <button onClick={() => { logAction('artifact.manual_edit_cancelled', { artifactId: artifact?.id }); onCancel() }}
          style={{ background: 'transparent', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 5, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saveStatus === 'saving'}
          style={{ background: '#F0FDF4', color: saveStatus === 'saving' ? '#9CA3AF' : '#059669', border: '1px solid #6EE7B7', borderRadius: 5, padding: '5px 14px', fontSize: 11, cursor: saveStatus === 'saving' ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
          Save
        </button>
      </div>
      {/* Textarea */}
      <textarea
        value={text}
        onChange={handleChange}
        style={{
          flex: 1,
          background: '#FFFFFF',
          color: '#111111',
          border: '1px solid #D1D5DB',
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
    logAction('artifact.exported', { artifactId: artifact?.id, format: fmt })
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

  // White page canvas (rendered inside dark surround)
  function DocumentCanvas() {
    return (
      <div style={{
        flex: 1, overflow: 'auto',
        background: '#1A1A1A',
        padding: '32px 24px',
      }}>
        <div style={{
          maxWidth: 760, margin: '0 auto',
          background: '#FFFFFF',
          borderRadius: 4,
          boxShadow: '0 2px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3)',
          padding: '56px 64px',
          minHeight: 600,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Color accent bar at top of page */}
          <div style={{
            height: 4, background: color, borderRadius: 0,
            marginBottom: 40,
            marginLeft: -64, marginRight: -64, marginTop: -56,
          }} />
          <DocumentView artifact={artifact} />
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
    }} onClick={e => { if (e.target === e.currentTarget) { logAction('artifact.viewer_closed', { artifactId: artifact?.id, via: 'backdrop' }); onClose() } }}>

      <div style={{
        width: 'min(880px, 96vw)', margin: '24px auto',
        background: '#111', border: '0.5px solid #2A2A2A', borderRadius: 14,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 32px 100px rgba(0,0,0,0.7)',
      }}>

        {/* Color accent */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, ${color}44)`, flexShrink: 0 }} />

        {/* Document header — stays dark */}
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
                <button onClick={() => { logAction('artifact.ai_edit_mode_entered', { artifactId: artifact?.id }); setMode('ai') }}
                  style={{ background: '#1A0D2A', color: '#A78BFA', border: '0.5px solid #3A1E5F', borderRadius: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✦ Ask Aria
                </button>
                <button onClick={() => { logAction('artifact.manual_edit_mode_entered', { artifactId: artifact?.id }); setMode('manual') }}
                  style={{ background: '#1A1A1A', color: '#D4D4D4', border: '0.5px solid #2A2A2A', borderRadius: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✏ Edit
                </button>
                {artifact.status !== 'approved' ? (
                  <button onClick={() => { logAction('artifact.approved', { artifactId: artifact?.id }); handleApprove() }}
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
                <button onClick={() => { logAction('artifact.viewer_closed', { artifactId: artifact?.id }); onClose() }} style={{ background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 6, color: '#525252', cursor: 'pointer', fontSize: 16, padding: '4px 8px', lineHeight: 1 }}>✕</button>
              </div>
            )}

            {/* Header buttons — AI mode */}
            {mode === 'ai' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button onClick={() => { logAction('artifact.ai_edit_mode_exited', { artifactId: artifact?.id }); setMode('view') }}
                  style={{ background: 'transparent', color: '#737373', border: '0.5px solid #2A2A2A', borderRadius: 5, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ← Back
                </button>
                <button onClick={() => { logAction('artifact.viewer_closed', { artifactId: artifact?.id }); onClose() }} style={{ background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 6, color: '#525252', cursor: 'pointer', fontSize: 16, padding: '4px 8px', lineHeight: 1 }}>✕</button>
              </div>
            )}

            {/* Header buttons shown inside ManualEditor itself (close only here) */}
            {mode === 'manual' && (
              <button onClick={() => { logAction('artifact.viewer_closed', { artifactId: artifact?.id }); onClose() }} style={{ background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 6, color: '#525252', cursor: 'pointer', fontSize: 16, padding: '4px 8px', lineHeight: 1 }}>✕</button>
            )}
          </div>
        </div>

        {/* Document body */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {mode === 'view' && <DocumentCanvas />}

          {mode === 'manual' && (
            <ManualEditor
              artifact={artifact}
              onSaved={handleManualSaved}
              onCancel={() => setMode('view')}
            />
          )}

          {mode === 'ai' && <DocumentCanvas />}
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

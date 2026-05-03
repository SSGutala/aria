import React, { useState, useRef, useEffect } from 'react'
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

function IntakeSummaryContent({ data }) {
  if (!data) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <SectionLabel>What Aria understood</SectionLabel>
        <p style={{ margin: 0, fontSize: 12, color: '#C4C4C4', lineHeight: 1.6 }}>{data.understood}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <SectionLabel>Business problem</SectionLabel>
          <p style={{ margin: 0, fontSize: 11, color: '#A3A3A3', lineHeight: 1.6 }}>{data.businessProblem}</p>
        </div>
        <div>
          <SectionLabel>Primary users</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(data.primaryUsers || []).map((u, i) => <Tag key={i}>{u}</Tag>)}
            {(data.secondaryUsers || []).map((u, i) => <Pill key={i} color="#3D3D3D">{u}</Pill>)}
          </div>
        </div>
        <div>
          <SectionLabel>Replacing</SectionLabel>
          <p style={{ margin: 0, fontSize: 11, color: '#A3A3A3', lineHeight: 1.6 }}>{data.currentProcess}</p>
        </div>
        <div>
          <SectionLabel>Main outcome</SectionLabel>
          <p style={{ margin: 0, fontSize: 11, color: '#A3A3A3', lineHeight: 1.6 }}>{data.mainOutcome}</p>
        </div>
      </div>
    </div>
  )
}

function ProductBriefContent({ data }) {
  if (!data) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <SectionLabel>Objective</SectionLabel>
        <p style={{ margin: 0, fontSize: 12, color: '#C4C4C4', lineHeight: 1.6 }}>{data.objective}</p>
      </div>
      <div>
        <SectionLabel>User roles</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {(data.userRoles || []).map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 10px', background: '#161616', borderRadius: 6, border: '0.5px solid #222' }}>
              <Tag>{r.role}</Tag>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, color: '#A3A3A3', lineHeight: 1.5 }}>{r.access}</p>
                {r.estimated && <p style={{ margin: '2px 0 0', fontSize: 10, color: '#3D3D3D' }}>~{r.estimated}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <SectionLabel>Core workflows</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(data.coreWorkflows || []).map((w, i) => (
              <li key={i} style={{ fontSize: 11, color: '#A3A3A3', lineHeight: 1.55 }}>{w}</li>
            ))}
          </ul>
        </div>
        <div>
          <SectionLabel>Business rules</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(data.businessRules || []).map((r, i) => (
              <li key={i} style={{ fontSize: 11, color: '#A3A3A3', lineHeight: 1.55 }}>{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <SectionLabel>Success criteria</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(data.successCriteria || []).map((s, i) => (
              <li key={i} style={{ fontSize: 11, color: '#A3A3A3', lineHeight: 1.55 }}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          {(data.openQuestions || []).length > 0 && (
            <>
              <SectionLabel>Open questions</SectionLabel>
              <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.openQuestions.map((q, i) => (
                  <li key={i} style={{ fontSize: 11, color: '#737373', lineHeight: 1.55, fontStyle: 'italic' }}>{q}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function WorkflowMapContent({ data }) {
  if (!data) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <SectionLabel>Trigger</SectionLabel>
        <p style={{ margin: 0, fontSize: 12, color: '#C4C4C4', lineHeight: 1.6 }}>{data.trigger}</p>
      </div>
      <div>
        <SectionLabel>Process steps</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {(data.steps || []).map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 0 }}>
              {/* Timeline line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 12, width: 20 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34D399', border: '1.5px solid #0D1F16', flexShrink: 0, marginTop: 8 }} />
                {i < (data.steps || []).length - 1 && (
                  <div style={{ width: 1, flex: 1, background: '#1E1E1E', minHeight: 16 }} />
                )}
              </div>
              <div style={{ flex: 1, paddingBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#D4D4D4' }}>{step.step}</span>
                  <Tag>{step.actor}</Tag>
                  {step.sla && <Pill color="#3D3D3D" bg="#111" border="#1A1A1A">{step.sla}</Pill>}
                </div>
                <p style={{ margin: '0 0 2px', fontSize: 11, color: '#737373', lineHeight: 1.5 }}>{step.action}</p>
                {step.output && (
                  <p style={{ margin: 0, fontSize: 10, color: '#3D3D3D', fontStyle: 'italic' }}>→ {step.output}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {(data.decisionPoints || []).length > 0 && (
        <div>
          <SectionLabel>Decision points</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.decisionPoints.map((d, i) => (
              <div key={i} style={{ fontSize: 11, color: '#A3A3A3', padding: '5px 10px', background: '#161616', borderRadius: 5, border: '0.5px solid #1E2A1E', lineHeight: 1.5 }}>
                {d}
              </div>
            ))}
          </div>
        </div>
      )}
      {(data.exceptionPaths || []).length > 0 && (
        <div>
          <SectionLabel>Exception paths</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.exceptionPaths.map((e, i) => (
              <div key={i} style={{ fontSize: 11, color: '#737373', padding: '5px 10px', background: '#161616', borderRadius: 5, border: '0.5px solid #2A1E1E', lineHeight: 1.5, fontStyle: 'italic' }}>
                {e}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DataModelContent({ data }) {
  if (!data) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SectionLabel>Primary entity</SectionLabel>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#D4D4D4', marginBottom: 8 }}>{data.primaryEntity}</span>
      </div>
      <div>
        <SectionLabel>Status flow</SectionLabel>
        <ArrowRow items={data.statusFlow || []} activeIdx={0} />
      </div>
      <div>
        <SectionLabel>Fields ({(data.fields || []).length})</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {(data.fields || []).map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#161616', borderRadius: 5, border: '0.5px solid #222' }}>
              <span style={{ fontSize: 11, color: '#A3A3A3' }}>{f.label}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {f.required && <span style={{ fontSize: 8, color: '#F87171' }}>required</span>}
                <Pill color="#525252" bg="#111" border="#1A1A1A">{f.type}</Pill>
              </div>
            </div>
          ))}
        </div>
      </div>
      {(data.relationships || []).length > 0 && (
        <div>
          <SectionLabel>Relationships</SectionLabel>
          {data.relationships.map((r, i) => (
            <p key={i} style={{ margin: '0 0 4px', fontSize: 11, color: '#737373' }}>{r}</p>
          ))}
        </div>
      )}
      {(data.auditFields || []).length > 0 && (
        <div>
          <SectionLabel>Audit fields</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {data.auditFields.map((f, i) => <Pill key={i} color="#3D3D3D">{f}</Pill>)}
          </div>
        </div>
      )}
    </div>
  )
}

function AutomationModelContent({ data }) {
  if (!data) return null
  const sections = [
    { key: 'triggers', label: 'Triggers', icon: '⚡', fields: ['event', 'condition', 'action'] },
    { key: 'notifications', label: 'Notifications', icon: '🔔', fields: ['event', 'recipient', 'channel', 'template'] },
    { key: 'escalations', label: 'Escalations', icon: '🔺', fields: ['condition', 'action', 'recipient'] },
    { key: 'documentGeneration', label: 'Document Generation', icon: '📄', fields: ['document', 'trigger', 'format'] },
    { key: 'integrations', label: 'Integrations', icon: '🔗', fields: ['system', 'type', 'purpose'] },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {sections.map(section => {
        const items = data[section.key] || []
        if (!items.length) return null
        return (
          <div key={section.key}>
            <SectionLabel>{section.icon} {section.label}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {items.map((item, i) => (
                <div key={i} style={{ padding: '8px 10px', background: '#161616', borderRadius: 6, border: '0.5px solid #222' }}>
                  {section.fields.map(f => item[f] ? (
                    <div key={f} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 9, color: '#3D3D3D', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, minWidth: 52 }}>{f}</span>
                      <span style={{ fontSize: 11, color: '#A3A3A3', lineHeight: 1.5 }}>{item[f]}</span>
                    </div>
                  ) : null)}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function UXRecommendationContent({ data }) {
  if (!data) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <SectionLabel>Layout type</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#D4D4D4' }}>{(data.layoutType || '').replace(/_/g, ' ')}</span>
          </div>
        </div>
        <div>
          <SectionLabel>Navigation model</SectionLabel>
          <span style={{ fontSize: 12, color: '#A3A3A3' }}>{data.navigationModel}</span>
        </div>
        {data.visualTheme && (
          <>
            <div>
              <SectionLabel>Visual mood</SectionLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {data.visualTheme.primaryColor && (
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: data.visualTheme.primaryColor, border: '0.5px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 12, color: '#A3A3A3' }}>{data.visualTheme.mood}</span>
                {data.visualTheme.colorName && (
                  <span style={{ fontSize: 10, color: '#3D3D3D' }}>· {data.visualTheme.colorName}</span>
                )}
              </div>
            </div>
            <div>
              <SectionLabel>Color rationale</SectionLabel>
              <p style={{ margin: 0, fontSize: 11, color: '#737373', lineHeight: 1.5 }}>{data.visualTheme.rationale}</p>
            </div>
          </>
        )}
      </div>
      <div>
        <SectionLabel>Primary screens</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {(data.primaryScreens || []).map((s, i) => (
            <div key={i} style={{ padding: '7px 10px', background: '#161616', borderRadius: 6, border: '0.5px solid #222' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#D4D4D4' }}>{s.screen}</span>
              </div>
              <p style={{ margin: '0 0 5px', fontSize: 11, color: '#737373', lineHeight: 1.4 }}>{s.purpose}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(s.keyActions || []).map((a, j) => <Tag key={j}>{a}</Tag>)}
              </div>
            </div>
          ))}
        </div>
      </div>
      {data.rationale && (
        <div>
          <SectionLabel>Design rationale</SectionLabel>
          <p style={{ margin: 0, fontSize: 11, color: '#737373', lineHeight: 1.6, fontStyle: 'italic' }}>{data.rationale}</p>
        </div>
      )}
    </div>
  )
}

function AppSpecContent({ data }) {
  if (!data) return null
  const primary = data.colorTheme?.primary || '#7C3AED'
  const light = data.colorTheme?.light || '#F5F3FF'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '12px 14px', background: primary + '18', borderRadius: 8, border: `0.5px solid ${primary}33` }}>
        <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700, color: '#F5F5F5' }}>{data.appTitle}</p>
        <p style={{ margin: 0, fontSize: 11, color: '#A3A3A3' }}>{data.tagline}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <SectionLabel>App type</SectionLabel>
          <span style={{ fontSize: 11, color: '#A3A3A3' }}>{data.appType}</span>
        </div>
        <div>
          <SectionLabel>Layout</SectionLabel>
          <span style={{ fontSize: 11, color: '#A3A3A3' }}>{(data.layoutType || '').replace(/_/g, ' ')}</span>
        </div>
        <div>
          <SectionLabel>Color theme</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: primary, border: '0.5px solid rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 11, color: '#A3A3A3' }}>{data.colorTheme?.name}</span>
          </div>
        </div>
        <div>
          <SectionLabel>Action label</SectionLabel>
          <span style={{ fontSize: 11, color: '#A3A3A3' }}>{data.primaryActionLabel}</span>
        </div>
      </div>
      <div>
        <SectionLabel>Status flow</SectionLabel>
        <ArrowRow items={data.statusFlow || []} activeIdx={0} />
      </div>
      <div>
        <SectionLabel>Features</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(data.features || []).map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: primary, flexShrink: 0, marginTop: 6 }} />
              <span style={{ fontSize: 11, color: '#A3A3A3', lineHeight: 1.55 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
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

// ─── Inline text editor for stage content ────────────────────────────────────
function InlineEditor({ artifact, data, onClose }) {
  const initialText = artifact?.content?._manualEdit ||
    (data ? JSON.stringify(data, null, 2) : '')
  const [text, setText] = useState(initialText)
  const [status, setStatus] = useState('idle') // idle | unsaved | saving | saved

  const debounce = useRef(null)

  async function save(val) {
    if (!artifact?.id) return
    setStatus('saving')
    try {
      await fetch(`${API}/api/artifacts/${artifact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { ...artifact.content, _manualEdit: val } }),
      })
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch { setStatus('unsaved') }
  }

  function onChange(e) {
    setText(e.target.value)
    setStatus('unsaved')
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => save(e.target.value), 1800)
  }

  const statusColor = { idle: '#525252', unsaved: '#FBBF24', saving: '#737373', saved: '#34D399' }[status]
  const statusLabel = { idle: '', unsaved: 'Unsaved', saving: 'Saving...', saved: 'Saved ✓' }[status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 8px', borderBottom: '0.5px solid #1A1A1A', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: '#A78BFA', fontWeight: 600 }}>✏ Editing</span>
        <span style={{ fontSize: 10, color: statusColor, flex: 1 }}>{statusLabel}</span>
        <button onClick={onClose}
          style={{ fontSize: 10, color: '#525252', background: 'transparent', border: '0.5px solid #2A2A2A', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Done
        </button>
        <button onClick={() => { clearTimeout(debounce.current); save(text) }}
          style={{ fontSize: 10, color: '#34D399', background: '#0D2A1A', border: '0.5px solid #34D39933', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          Save
        </button>
      </div>
      <textarea
        value={text}
        onChange={onChange}
        style={{
          width: '100%', minHeight: 220,
          background: '#0D0D0D', color: '#D4D4D4',
          border: '0.5px solid #2A2A2A', borderRadius: 6,
          padding: '12px 14px', fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          lineHeight: 1.65, resize: 'vertical', outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ─── Stage row ────────────────────────────────────────────────────────────────
function StageRow({ stage, index, data, isOpen, approved, onToggle, onApprove, onOpen, hasArtifact, artifact }) {
  const Component = stage.component
  const fileUrls = artifact?.file_urls || {}
  const formats = STAGE_FORMATS[stage.id] || ['pdf']
  const [editing, setEditing] = useState(false)

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
          {editing
            ? <InlineEditor artifact={artifact} data={data} onClose={() => setEditing(false)} />
            : <Component data={data} />
          }

          {/* Action bar */}
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
                <EditIcon /> Edit
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

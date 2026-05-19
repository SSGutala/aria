import React, { useState, useRef, useEffect } from 'react'
import mermaid from 'mermaid'
import { API_URL as API } from '../lib/api'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx'
import WorkflowDiagramCanvas, { WorkflowStaticCanvas } from './WorkflowDiagramCanvas'

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

// ── Shared business document styles ──────────────────────────────────────────
const D = {
  canvas: { background: '#D8DCE0', padding: '32px 24px', minHeight: 600 },
  page: {
    background: '#FFFFFF',
    maxWidth: 780,
    margin: '0 auto',
    fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
    color: '#1A1A2E',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 8px 32px rgba(0,0,0,0.12)',
    borderRadius: 1,
    lineHeight: 1.6,
  },
  body: { fontSize: 13.5, color: '#374151', lineHeight: 1.75, margin: 0 },
  label: { fontSize: 9.5, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' },
}

function DocLetterhead({ docType, docNumber }) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <div style={{ borderBottom: '3px solid #1C3557', padding: '22px 40px 18px', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, border: '1.5px dashed #C4C9D4', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8FA', flexShrink: 0 }}>
            <span style={{ fontSize: 7, color: '#9CA3AF', textAlign: 'center', letterSpacing: '0.04em' }}>LOGO</span>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>[Company Name]</div>
            <div style={{ fontSize: 10.5, color: '#6B7280', marginTop: 1 }}>Enterprise Operations</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{docType}</div>
          {docNumber && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, fontFamily: 'monospace' }}>Doc #{docNumber}</div>}
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{today}</div>
          <div style={{ fontSize: 9.5, color: '#D1D5DB', marginTop: 2 }}>CONFIDENTIAL — INTERNAL USE ONLY</div>
        </div>
      </div>
    </div>
  )
}

function DocTitleBlock({ title, subtitle, category }) {
  return (
    <div style={{ padding: '28px 40px 22px', borderBottom: '1px solid #E5E7EB', background: '#FAFBFC' }}>
      {category && (
        <div style={{ fontSize: 9.5, fontWeight: 800, color: '#1C3557', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>{category}</div>
      )}
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 13, color: '#64748B', margin: 0, lineHeight: 1.5 }}>{subtitle}</p>}
    </div>
  )
}

function SecHead({ num, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, paddingBottom: 8, borderBottom: '1.5px solid #E5E7EB' }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#1C3557', minWidth: 28, letterSpacing: '0.04em', fontFamily: 'monospace' }}>{num}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1C3557', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</span>
    </div>
  )
}

function DocFooter() {
  return (
    <div style={{ borderTop: '1px solid #E5E7EB', padding: '12px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFBFC' }}>
      <span style={{ fontSize: 9.5, color: '#9CA3AF' }}>Confidential — Internal Use Only</span>
      <span style={{ fontSize: 9.5, color: '#9CA3AF' }}>Version 1.0 — Draft</span>
    </div>
  )
}

function DocBody({ children }) {
  return (
    <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      {children}
    </div>
  )
}

// ── 1. IntakeSummaryContent ────────────────────────────────────────────────────
function IntakeSummaryContent({ data }) {
  if (!data) return null
  const thStyle = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdStyle = { padding: '8px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  return (
    <div style={D.canvas}>
      <div style={D.page}>
        <DocLetterhead docType="Intake Summary" docNumber="IS-001"/>
        <DocTitleBlock
          category="Project Intake Document"
          title={data.understood ? data.understood.split(' ').slice(0, 7).join(' ') + '…' : 'Intake Summary'}
          subtitle="Initial project intake and requirements capture — for stakeholder review and sign-off"
        />
        <DocBody>
          {/* 1.0 Executive Summary */}
          <section>
            <SecHead num="1.0">Executive Summary</SecHead>
            <p style={{ ...D.body, fontSize: 14, color: '#1E293B', lineHeight: 1.85, fontWeight: 400 }}>{data.understood}</p>
          </section>

          {/* 2.0 Business Problem */}
          <section>
            <SecHead num="2.0">Business Problem</SecHead>
            <p style={D.body}>{data.businessProblem}</p>
          </section>

          {/* 3.0 Stakeholders */}
          <section>
            <SecHead num="3.0">Stakeholders & User Roles</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8, border: '1px solid #E5E7EB' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '30%' }}>Stakeholder Type</th>
                  <th style={thStyle}>Roles / Titles</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600, color: '#1C3557', background: '#F0F4FF' }}>Primary Users</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(data.primaryUsers || []).map((u, i) => (
                        <span key={i} style={{ fontSize: 12, color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 3, padding: '3px 10px', fontWeight: 500 }}>{u}</span>
                      ))}
                    </div>
                  </td>
                </tr>
                {(data.secondaryUsers || []).length > 0 && (
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#374151', background: '#FAFBFC' }}>Secondary Users</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {data.secondaryUsers.map((u, i) => (
                          <span key={i} style={{ fontSize: 12, color: '#6B7280', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 3, padding: '3px 10px' }}>{u}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* 4.0 Current Process */}
          <section>
            <SecHead num="4.0">Current Process Being Replaced</SecHead>
            <div style={{ background: '#FFFBF0', border: '1px solid #FDE68A', borderLeft: '4px solid #D97706', borderRadius: 4, padding: '14px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>AS-IS STATE</div>
              <p style={{ ...D.body, color: '#78350F', margin: 0 }}>{data.currentProcess}</p>
            </div>
          </section>

          {/* 5.0 Expected Outcome */}
          <section>
            <SecHead num="5.0">Expected Outcome & Success Criteria</SecHead>
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderLeft: '4px solid #16A34A', borderRadius: 4, padding: '14px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#14532D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>TO-BE STATE</div>
              <p style={{ ...D.body, color: '#15803D', fontWeight: 500, margin: 0 }}>{data.mainOutcome}</p>
            </div>
          </section>
        </DocBody>
        <DocFooter/>
      </div>
    </div>
  )
}

// ── 2. ProductBriefContent ─────────────────────────────────────────────────────
function ProductBriefContent({ data }) {
  if (!data) return null
  const thStyle = { padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdStyle = { padding: '8px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  return (
    <div style={D.canvas}>
      <div style={D.page}>
        <DocLetterhead docType="Product Requirements Document" docNumber="PRD-001"/>
        <DocTitleBlock
          category="Product Brief"
          title="Product Requirements Document"
          subtitle="Objectives, user roles, core workflows, business rules, and success criteria"
        />
        <DocBody>
          {/* 1.0 Objective */}
          <section>
            <SecHead num="1.0">Objective</SecHead>
            <p style={{ ...D.body, fontSize: 14, color: '#0F172A', fontWeight: 500, lineHeight: 1.85 }}>{data.objective}</p>
          </section>

          {/* 2.0 User Roles */}
          {(data.userRoles || []).length > 0 && (
            <section>
              <SecHead num="2.0">User Roles &amp; Access Levels</SecHead>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #E5E7EB' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '28%' }}>Role</th>
                    <th style={thStyle}>Access Level &amp; Permissions</th>
                    <th style={{ ...thStyle, width: '18%' }}>Est. Users</th>
                  </tr>
                </thead>
                <tbody>
                  {data.userRoles.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#F9FAFB' : '#fff' }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#1C3557' }}>{r.role}</td>
                      <td style={tdStyle}>{r.access}</td>
                      <td style={{ ...tdStyle, color: '#6B7280', textAlign: 'center' }}>{r.estimated || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* 3.0 Core Workflows */}
          {(data.coreWorkflows || []).length > 0 && (
            <section>
              <SecHead num="3.0">Core Workflows</SecHead>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.coreWorkflows.map((w, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, padding: '10px 14px', background: i % 2 === 0 ? '#F8FAFF' : '#fff', border: '1px solid #E5E7EB', borderRadius: 4, borderLeft: '3px solid #1C3557' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#1C3557', minWidth: 22, fontFamily: 'monospace', marginTop: 1 }}>3.{i + 1}</span>
                    <span style={{ ...D.body, fontSize: 13.5 }}>{w}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 4.0 Business Rules */}
          {(data.businessRules || []).length > 0 && (
            <section>
              <SecHead num="4.0">Business Rules &amp; Constraints</SecHead>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #E5E7EB' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '12%' }}>Rule #</th>
                    <th style={thStyle}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {data.businessRules.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#F9FAFB' : '#fff' }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#1C3557', fontFamily: 'monospace', fontSize: 11 }}>BR-{String(i + 1).padStart(2, '0')}</td>
                      <td style={tdStyle}>{r}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* 5.0 Success Criteria */}
          {(data.successCriteria || []).length > 0 && (
            <section>
              <SecHead num="5.0">Success Criteria</SecHead>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.successCriteria.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 4 }}>
                    <span style={{ fontSize: 13, color: '#16A34A', flexShrink: 0, fontWeight: 700, marginTop: 1 }}>✓</span>
                    <span style={{ ...D.body, fontSize: 13.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 6.0 Assumptions */}
          {(data.assumptions || []).length > 0 && (
            <section>
              <SecHead num="6.0">Assumptions</SecHead>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.assumptions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', minWidth: 28, fontFamily: 'monospace', marginTop: 2 }}>6.{i + 1}</span>
                    <span style={{ ...D.body, fontSize: 13.5, color: '#6B7280', fontStyle: 'italic' }}>{a}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 7.0 Open Questions */}
          {(data.openQuestions || []).length > 0 && (
            <section>
              <SecHead num="7.0">Open Questions</SecHead>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #FDE68A' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, background: '#92400E', width: '12%' }}>Ref</th>
                    <th style={{ ...thStyle, background: '#92400E' }}>Question Requiring Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {data.openQuestions.map((q, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#FFFBF0' : '#fff' }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#92400E', fontFamily: 'monospace', fontSize: 11 }}>OQ-{String(i + 1).padStart(2, '0')}</td>
                      <td style={{ ...tdStyle, color: '#78350F' }}>{q}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </DocBody>
        <DocFooter/>
      </div>
    </div>
  )
}


// ─── Shared editor helpers ────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '5px 8px', fontSize: 12, border: '1px solid #D1D5DB',
  borderRadius: 4, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff', color: '#111827',
}
const textareaStyle = {
  ...inputStyle, resize: 'vertical', minHeight: 48,
}
const EditorLabel = ({ children }) => (
  <div style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{children}</div>
)
const EditorSection = ({ children, style }) => (
  <div style={{ marginBottom: 14, ...style }}>{children}</div>
)
const EditorSectionHead = ({ label, btnLabel, btnColor = '#2563EB', btnBg = '#EFF6FF', btnBorder = '#BFDBFE', onAdd }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
    {onAdd && (
      <button onClick={onAdd} style={{ fontSize: 10, color: btnColor, background: btnBg, border: `1px solid ${btnBorder}`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
        + {btnLabel}
      </button>
    )}
  </div>
)
const RemoveBtn = ({ onClick }) => (
  <button onClick={onClick} style={{ fontSize: 10, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>✕</button>
)
const EditorPanel = ({ children }) => (
  <div style={{ width: 320, flexShrink: 0, overflowY: 'auto', maxHeight: 560, display: 'flex', flexDirection: 'column', gap: 0, background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 6, padding: '14px 12px' }}>
    {children}
  </div>
)
const EditorWrapper = ({ children }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>{children}</div>
)
const EditingBanner = ({ label }) => (
  <div style={{ background: '#1A1A2A', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: '4px 4px 0 0', marginBottom: 0 }}>
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A78BFA' }}/>
    <span style={{ fontSize: 10, color: '#A78BFA', fontWeight: 600, letterSpacing: '0.06em' }}>{label || 'EDITING — make changes below, then click Done'}</span>
  </div>
)

// ─── Workflow Map Editor ──────────────────────────────────────────────────────
function WorkflowMapEditor({ data, onDataChange }) {
  const [local, setLocal] = React.useState(() => ({
    trigger: data?.trigger || '',
    steps: data?.steps ? data.steps.map(s => ({ ...s })) : [],
    decisionPoints: [...(data?.decisionPoints || [])],
    exceptionPaths: [...(data?.exceptionPaths || [])],
    _actors: data?._actors ? [...data._actors] : undefined,
    shapes: data?.shapes ? [...data.shapes] : [],
    _edges: data?._edges ? [...data._edges] : null,
  }))

  const updList = (key, i, val) => setLocal(p => ({ ...p, [key]: p[key].map((v, j) => j === i ? val : v) }))
  const addToList = (key, dflt) => setLocal(p => ({ ...p, [key]: [...p[key], dflt] }))
  const removeFromList = (key, i) => setLocal(p => ({ ...p, [key]: p[key].filter((_, j) => j !== i) }))

  // Canvas emits the full merged data object; merge it into local and auto-save
  const handleCanvasChange = (updatedData) => {
    const next = { ...local, ...updatedData }
    setLocal(next)
    if (onDataChange) onDataChange(next)
  }

  // Auto-save whenever any field in the metadata section changes
  React.useEffect(() => { if (onDataChange) onDataChange(local) }, [local]) // eslint-disable-line

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Interactive canvas — primary editor */}
      <div style={{ flex: 1, minHeight: 400 }}>
        <WorkflowDiagramCanvas data={local} onDataChange={handleCanvasChange} />
      </div>

      {/* Metadata fields */}
      <div style={{ borderTop: '1px solid #E2E8F0', padding: '14px 16px', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <EditorLabel>Trigger / Initiating Event</EditorLabel>
          <textarea style={{ ...textareaStyle, marginTop: 4 }} value={local.trigger}
            onChange={e => setLocal(p => ({ ...p, trigger: e.target.value }))}
            onBlur={() => onDataChange && onDataChange(local)} />
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <EditorSectionHead label="Decision Points" btnLabel="Add" btnColor="#D97706" btnBg="#FEF3C7" btnBorder="#FDE68A"
              onAdd={() => addToList('decisionPoints', 'Decision: [condition] → [outcome A] or [outcome B]')} />
            {local.decisionPoints.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={d} onChange={e => updList('decisionPoints', i, e.target.value)} onBlur={() => onDataChange && onDataChange(local)} />
                <RemoveBtn onClick={() => removeFromList('decisionPoints', i)} />
              </div>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <EditorSectionHead label="Exception Paths" btnLabel="Add" btnColor="#7C3AED" btnBg="#F5F3FF" btnBorder="#DDD6FE"
              onAdd={() => addToList('exceptionPaths', 'Exception: [when] → [what happens]')} />
            {local.exceptionPaths.map((ex, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={ex} onChange={e => updList('exceptionPaths', i, e.target.value)} onBlur={() => onDataChange && onDataChange(local)} />
                <RemoveBtn onClick={() => removeFromList('exceptionPaths', i)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Data Model Editor ────────────────────────────────────────────────────────
function DataModelEditor({ data, onDataChange }) {
  const [local, setLocal] = React.useState(() => ({
    primaryEntity: data?.primaryEntity || '',
    fields: data?.fields ? data.fields.map(f => ({ ...f })) : [],
    statusFlow: [...(data?.statusFlow || [])],
    relationships: [...(data?.relationships || [])],
    auditFields: [...(data?.auditFields || [])],
  }))

  React.useEffect(() => { if (onDataChange) onDataChange(local) }, [local])

  const TYPES = ['text','number','email','date','select','textarea','boolean','file']
  const updField = (i, key, val) => setLocal(p => ({ ...p, fields: p.fields.map((f, j) => j === i ? { ...f, [key]: val } : f) }))
  const addField = () => setLocal(p => ({ ...p, fields: [...p.fields, { name: 'new_field', label: 'New Field', type: 'text', required: false, options: [] }] }))
  const removeField = i => setLocal(p => ({ ...p, fields: p.fields.filter((_, j) => j !== i) }))
  const updList = (key, i, val) => setLocal(p => ({ ...p, [key]: p[key].map((v, j) => j === i ? val : v) }))
  const addToList = (key, dflt) => setLocal(p => ({ ...p, [key]: [...p[key], dflt] }))
  const removeFromList = (key, i) => setLocal(p => ({ ...p, [key]: p[key].filter((_, j) => j !== i) }))

  const thS = { padding: '7px 10px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1E3A5F', textAlign: 'left', whiteSpace: 'nowrap' }
  const tdS = { padding: '4px 8px', verticalAlign: 'middle', borderBottom: '1px solid #E5E7EB' }

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: '#1E3A5F', display: 'flex', alignItems: 'center', gap: 10 }}>
        <input value={local.primaryEntity} onChange={e => setLocal(p => ({ ...p, primaryEntity: e.target.value }))}
          style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit', flex: 1 }} />
        <span style={{ fontSize: 11, color: '#93C5FD' }}>Data Model — click any cell to edit</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
          <thead>
            <tr>{['Field Name','Type','Req','Label','Example / Options',''].map(c => <th key={c} style={thS}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {local.fields.map((f, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#F9FAFB' : '#fff' }}>
                <td style={tdS}><input value={f.name||''} onChange={e => updField(i,'name',e.target.value)} style={{ ...inputStyle, fontWeight: 600, color: '#111827', width: 120 }} /></td>
                <td style={tdS}>
                  <select value={f.type||'text'} onChange={e => updField(i,'type',e.target.value)} style={{ ...inputStyle, width: 90 }}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td style={{ ...tdS, textAlign: 'center' }}>
                  <input type="checkbox" checked={!!f.required} onChange={e => updField(i,'required',e.target.checked)} />
                </td>
                <td style={tdS}><input value={f.label||''} onChange={e => updField(i,'label',e.target.value)} style={{ ...inputStyle, width: 130 }} /></td>
                <td style={tdS}><input value={(f.options||[]).join(', ')} onChange={e => updField(i,'options',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} style={{ ...inputStyle, width: 160 }} placeholder="opt1, opt2…" /></td>
                <td style={tdS}><RemoveBtn onClick={() => removeField(i)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '6px 12px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
        <button onClick={addField} style={{ fontSize: 11, color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Field</button>
      </div>

      <div style={{ padding: '12px 14px', borderTop: '2px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <EditorSectionHead label="Status Flow" btnLabel="Add Status" onAdd={() => addToList('statusFlow', 'New Status')} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {local.statusFlow.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 4, padding: '2px 4px' }}>
                <input value={s} onChange={e => updList('statusFlow', i, e.target.value)} style={{ fontSize: 12, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', color: '#1D4ED8', width: Math.max(60, s.length * 8) }} />
                <RemoveBtn onClick={() => removeFromList('statusFlow', i)} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <EditorSectionHead label="Relationships" btnLabel="Add" onAdd={() => addToList('relationships', 'New relationship description')} />
          {local.relationships.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={r} onChange={e => updList('relationships', i, e.target.value)} />
              <RemoveBtn onClick={() => removeFromList('relationships', i)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Automation Model Editor ──────────────────────────────────────────────────
function AutomationModelEditor({ data, onDataChange }) {
  const [local, setLocal] = React.useState(() => ({
    triggers: data?.triggers ? data.triggers.map(t => ({ ...t })) : [],
    notifications: data?.notifications ? data.notifications.map(n => ({ ...n })) : [],
    escalations: data?.escalations ? data.escalations.map(e => ({ ...e })) : [],
    integrations: data?.integrations ? data.integrations.map(i => ({ ...i })) : [],
  }))

  React.useEffect(() => { if (onDataChange) onDataChange(local) }, [local])

  const updItem = (key, i, field, val) => setLocal(p => ({ ...p, [key]: p[key].map((item, j) => j === i ? { ...item, [field]: val } : item) }))
  const addItem = (key, tmpl) => setLocal(p => ({ ...p, [key]: [...p[key], tmpl] }))
  const removeItem = (key, i) => setLocal(p => ({ ...p, [key]: p[key].filter((_, j) => j !== i) }))

  const fieldStyle = { ...inputStyle, fontSize: 11 }

  const EditableRow = ({ item, fields, keyName, index }) => (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 10px', marginBottom: 6, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#6B7280' }}>#{index + 1}</span>
        <RemoveBtn onClick={() => removeItem(keyName, index)} />
      </div>
      {fields.map(([k, lbl]) => (
        <div key={k} style={{ marginBottom: 4 }}>
          <EditorLabel>{lbl}</EditorLabel>
          <input style={fieldStyle} value={item[k] || ''} onChange={e => updItem(keyName, index, k, e.target.value)} />
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', background: '#0F172A', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>Automation Rules</span>
        <span style={{ fontSize: 10, color: '#64748B' }}>click any field to edit</span>
      </div>

      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Triggers */}
        <div>
          <EditorSectionHead label="Logic Rules (IF / THEN)" btnLabel="Add Rule" btnColor="#059669" btnBg="#F0FDF4" btnBorder="#BBF7D0"
            onAdd={() => addItem('triggers', { event: 'New event', condition: 'When condition is met', action: 'Perform this action', output: '' })} />
          {local.triggers.map((t, i) => (
            <EditableRow key={i} item={t} keyName="triggers" index={i}
              fields={[['event','Event'],['condition','Condition (IF)'],['action','Action (THEN)'],['output','Output']]} />
          ))}
        </div>

        {/* Notifications */}
        <div>
          <EditorSectionHead label="Notifications" btnLabel="Add" btnColor="#0284C7" btnBg="#F0F9FF" btnBorder="#BAE6FD"
            onAdd={() => addItem('notifications', { event: 'Event', recipient: 'Recipient', channel: 'Email', template: 'Message text' })} />
          {local.notifications.map((n, i) => (
            <EditableRow key={i} item={n} keyName="notifications" index={i}
              fields={[['event','Event'],['recipient','Recipient'],['channel','Channel'],['template','Message']]} />
          ))}
        </div>

        {/* Escalations */}
        <div>
          <EditorSectionHead label="Escalations" btnLabel="Add" btnColor="#D97706" btnBg="#FEF3C7" btnBorder="#FDE68A"
            onAdd={() => addItem('escalations', { condition: 'Trigger condition', action: 'What happens', recipient: 'Escalate to' })} />
          {local.escalations.map((e, i) => (
            <EditableRow key={i} item={e} keyName="escalations" index={i}
              fields={[['condition','Condition'],['action','Action'],['recipient','Escalate To']]} />
          ))}
        </div>

        {/* Integrations */}
        <div>
          <EditorSectionHead label="Integrations" btnLabel="Add" btnColor="#7C3AED" btnBg="#F5F3FF" btnBorder="#DDD6FE"
            onAdd={() => addItem('integrations', { system: 'System name', type: 'Read', purpose: 'Purpose' })} />
          {local.integrations.map((item, i) => (
            <EditableRow key={i} item={item} keyName="integrations" index={i}
              fields={[['system','System'],['type','Type (Read/Write/Sync)'],['purpose','Purpose']]} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 3. WorkflowMapContent — Proper swimlane flowchart ─────────────────────────
const SL_FILL   = ['#EFF6FF','#F0FDF4','#FFFBEB','#F5F3FF','#FFF1F2','#ECFDF5']
const SL_ACCENT = ['#2563EB','#16A34A','#D97706','#7C3AED','#E11D48','#059669']
const SL_LABEL  = ['#1E40AF','#14532D','#92400E','#4C1D95','#9F1239','#064E3B']

function WorkflowMapInner({ data }) {
  if (!data) return null
  const steps = data.steps || []
  const decisions = data.decisionPoints || []
  const exceptions = data.exceptionPaths || []

  // Use saved actor/stage order (_actors) if available — preserves canvas ordering and empty stages
  const actors = (() => {
    if (data._actors && data._actors.length) return [...data._actors]
    const list = []
    steps.forEach(s => { if (s.actor && !list.includes(s.actor)) list.push(s.actor) })
    return list.length ? list : ['Process']
  })()

  // ── Layout constants ────────────────────────────────────────────────────────
  const LABEL_W  = 100   // left column: lane labels
  const START_W  = 90    // column reserved for START oval (before step 0)
  const BOX_W    = 164   // step box width
  const BOX_H    = 68    // step box height
  const COL_GAP  = 52    // horizontal gap between step columns
  const LANE_H   = 110   // height of each swimlane row
  const TOP_PAD  = 16    // vertical padding above/below lanes

  // Column x-center for step i: LABEL_W + START_W + i*(BOX_W+COL_GAP) + BOX_W/2
  const colCX  = i => LABEL_W + START_W + i * (BOX_W + COL_GAP) + BOX_W / 2
  // Row y-center for actor ai: TOP_PAD + ai*LANE_H + LANE_H/2
  const rowCY  = ai => TOP_PAD + ai * LANE_H + LANE_H / 2

  // Include END oval (rx=30) + right padding so nothing clips; height covers all lanes including empty ones
  const svgW = LABEL_W + START_W + Math.max(1, steps.length) * (BOX_W + COL_GAP) + COL_GAP + 30 + 40
  const svgH = TOP_PAD + actors.length * LANE_H + TOP_PAD

  // START node in lane of first step
  const startAi  = steps.length ? actors.indexOf(steps[0].actor || actors[0]) : 0
  const startCX  = LABEL_W + START_W / 2
  const startCY  = rowCY(Math.max(0, startAi))
  const startRX  = 34
  const startRY  = 18

  // Each step's center
  const nodePos = steps.map((step, i) => {
    const ai = actors.indexOf(step.actor || actors[0])
    return { cx: colCX(i), cy: rowCY(ai < 0 ? 0 : ai), ai: ai < 0 ? 0 : ai }
  })

  // END node after last step, same lane
  const lastNode = nodePos[nodePos.length - 1]
  const endCX = lastNode ? colCX(steps.length - 1) + BOX_W / 2 + COL_GAP / 2 + 34 : startCX + 80
  const endCY = lastNode ? lastNode.cy : startCY

  // ── Arrow path builder ──────────────────────────────────────────────────────
  function arrowPath(x1, y1, x2, y2) {
    if (Math.abs(y1 - y2) < 3) {
      return `M${x1},${y1} L${x2},${y2}`
    }
    // Elbow: go right to midpoint x, then down/up, then right to target
    const mx = x1 + (x2 - x1) * 0.5
    return `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`
  }

  const markerId = 'wf_arr_' + (data.trigger || 'x').slice(0, 6).replace(/\W/g, '')

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>

      {/* ── Header bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="5" rx="1.5" fill="#2563EB"/>
            <rect x="9" y="5" width="6" height="5" rx="1.5" fill="#16A34A"/>
            <rect x="1" y="10" width="6" height="5" rx="1.5" fill="#D97706"/>
            <line x1="7" y1="3.5" x2="9" y2="7.5" stroke="#94A3B8" strokeWidth="1.2"/>
            <line x1="7" y1="12.5" x2="9" y2="7.5" stroke="#94A3B8" strokeWidth="1.2"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Workflow Map</span>
          <span style={{ fontSize: 11, color: '#64748B' }}>
            Swimlane · {steps.length} steps · {actors.length} {actors.length === 1 ? 'role' : 'roles'}
          </span>
        </div>
        <span style={{ fontSize: 10, color: '#64748B', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 4, padding: '2px 8px', fontWeight: 500 }}>
          FLOWCHART
        </span>
      </div>

      {/* ── Trigger banner ── */}
      {data.trigger && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px', background: '#F0FDF4', borderBottom: '1px solid #BBF7D0' }}>
          <div style={{ flexShrink: 0, marginTop: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#15803D', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 4, padding: '2px 7px', letterSpacing: '0.06em' }}>TRIGGER</span>
          </div>
          <span style={{ fontSize: 13, color: '#14532D', lineHeight: 1.5, flex: 1 }}>{data.trigger}</span>
        </div>
      )}

      {/* ── SVG swimlane diagram ── */}
      <div style={{ overflow: 'auto', background: '#FAFAFA', maxHeight: 520 }}>
        <svg
          width={svgW}
          height={svgH}
          style={{ display: 'block', fontFamily: 'inherit' }}
        >
          <defs>
            <marker id={markerId} markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
              <path d="M0,0.5 L0,6.5 L8,3.5 z" fill="#64748B"/>
            </marker>
            <filter id="wf_shadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#00000018"/>
            </filter>
          </defs>

          {/* ── Lane backgrounds & labels ── */}
          {actors.map((actor, ai) => {
            const laneY = TOP_PAD + ai * LANE_H
            const accent = SL_ACCENT[ai % SL_ACCENT.length]
            const fill   = SL_FILL[ai % SL_FILL.length]
            const label  = SL_LABEL[ai % SL_LABEL.length]
            return (
              <g key={actor}>
                {/* Full lane background */}
                <rect x={0} y={laneY} width={svgW} height={LANE_H} fill={fill} stroke="#E2E8F0" strokeWidth={0.5}/>
                {/* Label column */}
                <rect x={0} y={laneY} width={LABEL_W} height={LANE_H} fill={accent} opacity={0.13}/>
                <line x1={LABEL_W} y1={laneY} x2={LABEL_W} y2={laneY + LANE_H} stroke={accent} strokeWidth={2} opacity={0.4}/>
                {/* Actor name — rotated */}
                <text
                  x={LABEL_W / 2} y={laneY + LANE_H / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="12" fontWeight="700" fill={label}
                  transform={`rotate(-90,${LABEL_W / 2},${laneY + LANE_H / 2})`}
                >
                  {actor.length > 20 ? actor.slice(0, 19) + '…' : actor}
                </text>
              </g>
            )
          })}

          {/* ── START oval — own column, no overlap ── */}
          <ellipse
            cx={startCX} cy={startCY}
            rx={startRX} ry={startRY}
            fill="#15803D" filter="url(#wf_shadow)"
          />
          <text x={startCX} y={startCY} textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fontWeight="800" fill="#fff" letterSpacing="0.08em">START</text>
          {/* Arrow from START to step 0 */}
          {nodePos.length > 0 && (
            <path
              d={arrowPath(startCX + startRX, startCY, nodePos[0].cx - BOX_W / 2, nodePos[0].cy)}
              stroke="#64748B" strokeWidth="1.8" fill="none"
              markerEnd={`url(#${markerId})`}
            />
          )}

          {/* ── Step-to-step arrows ── */}
          {nodePos.map((node, i) => {
            if (i === nodePos.length - 1) return null
            const next = nodePos[i + 1]
            const x1 = node.cx + BOX_W / 2
            const y1 = node.cy
            const x2 = next.cx - BOX_W / 2
            const y2 = next.cy
            return (
              <path key={i}
                d={arrowPath(x1, y1, x2, y2)}
                stroke="#64748B" strokeWidth="1.8" fill="none"
                markerEnd={`url(#${markerId})`}
              />
            )
          })}

          {/* ── Arrow from last step to END ── */}
          {nodePos.length > 0 && (
            <path
              d={`M${nodePos[nodePos.length - 1].cx + BOX_W / 2},${endCY} L${endCX - 34},${endCY}`}
              stroke="#64748B" strokeWidth="1.8" fill="none"
              markerEnd={`url(#${markerId})`}
            />
          )}

          {/* ── END oval ── */}
          {nodePos.length > 0 && (
            <>
              <ellipse cx={endCX} cy={endCY} rx={30} ry={16} fill="#0F172A" filter="url(#wf_shadow)"/>
              <text x={endCX} y={endCY} textAnchor="middle" dominantBaseline="middle"
                fontSize="10" fontWeight="800" fill="#fff" letterSpacing="0.08em">END</text>
            </>
          )}

          {/* ── Step boxes ── */}
          {steps.map((step, i) => {
            const { cx, cy, ai } = nodePos[i]
            const accent = SL_ACCENT[ai % SL_ACCENT.length]
            const label  = SL_LABEL[ai % SL_LABEL.length]
            const bx = cx - BOX_W / 2
            const by = cy - BOX_H / 2
            // Wrap label at ~22 chars
            const raw = step.step || ''
            const line1 = raw.length > 22 ? raw.slice(0, 22) : raw
            const line2 = raw.length > 22 ? raw.slice(22, 44) : ''
            return (
              <g key={i} filter="url(#wf_shadow)">
                {/* White card */}
                <rect x={bx} y={by} width={BOX_W} height={BOX_H} rx={7} ry={7}
                  fill="#ffffff" stroke={accent} strokeWidth={2}/>
                {/* Accent top bar */}
                <rect x={bx + 1} y={by + 1} width={BOX_W - 2} height={5} rx={6} fill={accent}/>
                {/* Step number badge */}
                <circle cx={bx + 16} cy={by + 5 + 14} r={11} fill={accent}/>
                <text x={bx + 16} y={by + 5 + 14} textAnchor="middle" dominantBaseline="middle"
                  fontSize="9" fontWeight="800" fill="#fff">{i + 1}</text>
                {/* Step label */}
                <text x={bx + 34} y={by + (line2 ? 24 : 28)} fontSize="12" fontWeight="700" fill="#0F172A">
                  {line1}
                </text>
                {line2 && (
                  <text x={bx + 34} y={by + 38} fontSize="12" fontWeight="700" fill="#0F172A">{line2}</text>
                )}
                {/* Actor tag below label */}
                {step.actor && (
                  <text x={bx + 34} y={by + BOX_H - 10} fontSize="9" fill={accent} fontWeight="600" opacity={0.8}>
                    {step.actor.length > 22 ? step.actor.slice(0, 21) + '…' : step.actor}
                  </text>
                )}
                {/* SLA chip */}
                {step.sla && step.sla !== 'None' && step.sla !== 'null' && (
                  <>
                    <rect x={cx + 44} y={by + 6} width={56} height={14} rx={4} fill={accent} opacity={0.12}/>
                    <text x={cx + 47} y={by + 13} fontSize="8" fill={accent} fontWeight="600">⏱ {step.sla}</text>
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* ── Decision points + exceptions ── */}
      {(decisions.length > 0 || exceptions.length > 0) && (
        <div style={{ borderTop: '1px solid #FDE68A', background: '#FFFBEB', padding: '14px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Decision Points</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {decisions.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Diamond icon */}
                <svg width="30" height="26" viewBox="0 0 30 26" style={{ flexShrink: 0, marginTop: 2 }}>
                  <polygon points="15,2 28,13 15,24 2,13" fill="#FEF3C7" stroke="#D97706" strokeWidth="1.8"/>
                  <text x="15" y="13" textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="#D97706">?</text>
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#78350F', fontWeight: 600, lineHeight: 1.5 }}>{d}</div>
                  {exceptions[i] && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: '#B45309', fontWeight: 700 }}>↳ EXCEPTION</span>
                      <span style={{ fontSize: 12, color: '#92400E', fontStyle: 'italic' }}>{exceptions[i]}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function WorkflowMapContent({ data, editing, onDataChange }) {
  if (editing) {
    return (
      <div>
        <EditingBanner label="EDITING — add/remove steps, edit text, manage decisions" />
        <div style={{ border: '1.5px solid #3A1E5F', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
          <WorkflowMapEditor data={data} onDataChange={onDataChange} />
        </div>
      </div>
    )
  }
  // Static preview — use the same canvas renderer so all shapes, lanes, and edges are visible
  return <WorkflowStaticCanvas data={data} />
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

function DataModelInner({ data }) {
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

function DataModelContent({ data, editing, onDataChange }) {
  if (editing) {
    return (
      <div>
        <EditingBanner label="EDITING — add/remove fields, edit types, update status flow" />
        <div style={{ border: '1.5px solid #3A1E5F', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
          <DataModelEditor data={data} onDataChange={onDataChange} />
        </div>
      </div>
    )
  }
  return <DataModelInner data={data} />
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

// Visual IF/THEN/ELSE rule card
function RuleCard({ trigger, index }) {
  const colors = { bg: '#F0FDF4', border: '#BBF7D0', accent: '#059669' }
  return (
    <div style={{ border: `1.5px solid ${colors.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
      {/* WHEN header */}
      <div style={{ background: '#1E293B', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', letterSpacing: '0.1em' }}>RULE {index + 1}</span>
        <div style={{ width: 1, height: 12, background: '#334155' }}/>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#E2E8F0' }}>WHEN</span>
        <span style={{ fontSize: 12, color: '#7DD3FC', fontWeight: 500 }}>{trigger.event}</span>
      </div>
      <div style={{ background: '#fff', padding: '0 14px 0' }}>
        {/* IF condition */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ width: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF3C7', borderRight: '1px solid #FDE68A' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#D97706', letterSpacing: '0.05em', writingMode: 'horizontal-tb' }}>IF</span>
          </div>
          <div style={{ flex: 1, padding: '10px 14px' }}>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{trigger.condition || 'Condition met'}</div>
          </div>
        </div>
        {/* THEN action */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ width: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0FDF4', borderRight: '1px solid #BBF7D0' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#059669', letterSpacing: '0.05em' }}>THEN</span>
          </div>
          <div style={{ flex: 1, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="7" cy="7" r="6" fill="#059669"/>
              <path d="M4 7l2 2 4-4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ fontSize: 12, color: '#065F46', fontWeight: 500, lineHeight: 1.5 }}>{trigger.action}</div>
          </div>
        </div>
        {/* Output if present */}
        {trigger.output && (
          <div style={{ display: 'flex', gap: 0 }}>
            <div style={{ width: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EEF2FF', borderRight: '1px solid #C7D2FE' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#4F46E5', letterSpacing: '0.04em' }}>OUT</span>
            </div>
            <div style={{ flex: 1, padding: '8px 14px' }}>
              <div style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>{trigger.output}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AutomationModelInner({ data }) {
  if (!data) return null
  const triggers = data.triggers || []
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', background: '#0F172A', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>Automation Rules</span>
        <span style={{ fontSize: 10, color: '#64748B', background: '#1E293B', borderRadius: 4, padding: '2px 8px' }}>{triggers.length} rules</span>
      </div>

      <div style={{ padding: '14px 14px 4px' }}>
        {/* IF/THEN rule cards */}
        {triggers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Logic Rules</div>
            {triggers.map((t, i) => <RuleCard key={i} trigger={t} index={i}/>)}
          </div>
        )}

        {/* Notifications table */}
        <AutomationTable
          title="Notifications"
          color="#0284C7"
          columns={['Event', 'Recipient', 'Channel', 'Message']}
          rows={(data.notifications || []).map(n => ({ Event: n.event, Recipient: n.recipient, Channel: n.channel, Message: n.template || n.message || '—' }))}
        />
        {/* Escalations table */}
        <AutomationTable
          title="Escalations"
          color="#D97706"
          columns={['Condition', 'Action', 'Escalate To']}
          rows={(data.escalations || []).map(e => ({ Condition: e.condition, Action: e.action, 'Escalate To': e.recipient || e.escalateTo || '—' }))}
        />
        {/* Integrations table */}
        <AutomationTable
          title="Integrations"
          color="#7C3AED"
          columns={['System', 'Type', 'Purpose']}
          rows={(data.integrations || []).map(i => ({ System: i.system, Type: i.type, Purpose: i.purpose }))}
        />
      </div>
    </div>
  )
}

function AutomationModelContent({ data, editing, onDataChange }) {
  if (editing) {
    return (
      <div>
        <EditingBanner label="EDITING — add/remove rules, notifications, escalations, integrations" />
        <div style={{ border: '1.5px solid #3A1E5F', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
          <AutomationModelEditor data={data} onDataChange={onDataChange} />
        </div>
      </div>
    )
  }
  return <AutomationModelInner data={data} />
}


// ── 6. AppSpecContent ──────────────────────────────────────────────────────────
function AppSpecContent({ data }) {
  if (!data) return null
  const primary = data.colorTheme?.primary || '#7C3AED'
  const thStyle = { padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdStyle = { padding: '8px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }

  return (
    <div style={D.canvas}>
      <div style={D.page}>
        {/* Color accent top bar */}
        <div style={{ height: 6, background: `linear-gradient(90deg, ${primary}, ${primary}99)` }}/>
        <DocLetterhead docType="Application Design Specification" docNumber="ADS-001"/>
        <DocTitleBlock
          category="App / Design Spec"
          title={data.appTitle || 'Application Specification'}
          subtitle={data.tagline}
        />
        <DocBody>
          {/* 1.0 Overview */}
          <section>
            <SecHead num="1.0">Application Overview</SecHead>
            <p style={{ ...D.body, fontSize: 14, lineHeight: 1.85 }}>{data.purpose}</p>
          </section>

          {/* 2.0 App Classification */}
          <section>
            <SecHead num="2.0">App Classification &amp; Configuration</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #E5E7EB' }}>
              <tbody>
                {[
                  ['App Type', data.appType],
                  ['Layout Pattern', (data.layoutType || '').replace(/_/g, ' ')],
                  ['Workflow Type', (data.workflowType || '').replace(/_/g, ' ')],
                  ['Primary Action', data.primaryActionLabel],
                ].filter(([, v]) => v).map(([k, v], i) => (
                  <tr key={k} style={{ background: i % 2 === 0 ? '#F9FAFB' : '#fff' }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#1C3557', width: '30%', borderRight: '1px solid #E5E7EB' }}>{k}</td>
                    <td style={tdStyle}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 3.0 Visual Design */}
          {data.colorTheme && (
            <section>
              <SecHead num="3.0">Visual Design &amp; Color System</SecHead>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #E5E7EB' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Property</th>
                    <th style={thStyle}>Value</th>
                    <th style={{ ...thStyle, width: '20%' }}>Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Theme Name', data.colorTheme.name, null],
                    ['Primary Color', data.colorTheme.primary, data.colorTheme.primary],
                    ['Light Tint', data.colorTheme.light, data.colorTheme.light],
                    ['Text Color', data.colorTheme.text, data.colorTheme.text],
                  ].filter(([, v]) => v).map(([label, value, swatch], i) => (
                    <tr key={label} style={{ background: i % 2 === 0 ? '#F9FAFB' : '#fff' }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#1C3557' }}>{label}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{value}</td>
                      <td style={tdStyle}>
                        {swatch ? <div style={{ width: 28, height: 20, borderRadius: 4, background: swatch, border: '1px solid #E5E7EB' }}/> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* 4.0 Status Workflow */}
          {(data.statusFlow || []).length > 0 && (
            <section>
              <SecHead num="4.0">Status Workflow</SecHead>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 4, flexWrap: 'wrap' }}>
                {data.statusFlow.map((s, i) => (
                  <React.Fragment key={i}>
                    <div style={{ padding: '8px 16px', background: i === 0 ? primary : i === data.statusFlow.length - 1 ? '#0F172A' : '#F3F4F6', color: i === 0 || i === data.statusFlow.length - 1 ? '#fff' : '#374151', border: `1px solid ${i === 0 ? primary : '#E5E7EB'}`, fontSize: 12, fontWeight: i === 0 || i === data.statusFlow.length - 1 ? 700 : 400, borderRadius: i === 0 ? '4px 0 0 4px' : i === data.statusFlow.length - 1 ? '0 4px 4px 0' : 0, borderLeft: i > 0 ? 'none' : undefined }}>
                      {s}
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <p style={{ ...D.body, fontSize: 12, color: '#6B7280', marginTop: 8 }}>
                Status transitions follow the sequence above. Each state represents a distinct business phase.
              </p>
            </section>
          )}

          {/* 5.0 Features */}
          {(data.features || []).length > 0 && (
            <section>
              <SecHead num="5.0">Feature Specification</SecHead>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #E5E7EB' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '12%' }}>Ref</th>
                    <th style={thStyle}>Feature Description</th>
                  </tr>
                </thead>
                <tbody>
                  {data.features.map((f, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#F9FAFB' : '#fff' }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: primary, fontFamily: 'monospace', fontSize: 11 }}>F-{String(i + 1).padStart(2, '0')}</td>
                      <td style={tdStyle}>{f}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* 6.0 Data Fields */}
          {(data.fields || []).length > 0 && (
            <section>
              <SecHead num="6.0">Data Schema</SecHead>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #E5E7EB' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Field Name</th>
                    <th style={thStyle}>Label</th>
                    <th style={{ ...thStyle, width: '14%' }}>Type</th>
                    <th style={{ ...thStyle, width: '12%', textAlign: 'center' }}>Required</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fields.map((f, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#F9FAFB' : '#fff' }}>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: '#1D4ED8' }}>{f.name || f.label}</td>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{f.label || f.name}</td>
                      <td style={tdStyle}><span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', borderRadius: 3, padding: '2px 7px', fontFamily: 'monospace' }}>{f.type}</span></td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: f.required ? '#DC2626' : '#9CA3AF', fontWeight: 700 }}>{f.required ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* 7.0 Primary CTA */}
          {data.primaryActionLabel && (
            <section>
              <SecHead num="7.0">Primary User Action</SecHead>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '14px 24px', background: primary, borderRadius: 5, boxShadow: `0 2px 8px ${primary}44` }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{data.primaryActionLabel}</span>
              </div>
              <p style={{ ...D.body, fontSize: 12, color: '#6B7280', marginTop: 10 }}>
                This is the primary call-to-action presented to the user when initiating a new record in this application.
              </p>
            </section>
          )}
        </DocBody>
        <DocFooter/>
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

// ─── PM Document Components ───────────────────────────────────────────────────

function ProblemStatementContent({ data }) {
  if (!data) return null
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="Problem Statement" docNumber="PS-001"/>
      <DocTitleBlock category="Problem Definition" title="Problem Statement" subtitle="Root cause analysis and solution framing"/>
      <DocBody>
        <div>
          <SecHead num="1.0">Current State</SecHead>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0 }}>{data.currentState}</p>
        </div>
        {(data.painPoints?.length > 0) && (
          <div>
            <SecHead num="2.0">Pain Points</SecHead>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{data.painPoints.map((p, i) => <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 6, lineHeight: 1.6 }}>{p}</li>)}</ul>
          </div>
        )}
        {(data.rootCauses?.length > 0) && (
          <div>
            <SecHead num="3.0">Root Causes</SecHead>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{data.rootCauses.map((r, i) => <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 6, lineHeight: 1.6 }}>{r}</li>)}</ul>
          </div>
        )}
        <div>
          <SecHead num="4.0">Business Impact</SecHead>
          <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderLeft: '4px solid #F59E0B', borderRadius: 4, padding: '12px 16px' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#92400E', fontWeight: 600 }}>Impacted Users: <span style={{ fontWeight: 400 }}>{(data.impactedUsers || []).join(', ')}</span></p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#92400E', lineHeight: 1.6 }}>{data.businessImpact}</p>
          </div>
        </div>
        <div>
          <SecHead num="5.0">Proposed Solution</SecHead>
          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderLeft: '4px solid #22C55E', borderRadius: 4, padding: '12px 16px' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>{data.proposedSolution}</p>
          </div>
        </div>
        {(data.outOfScope?.length > 0) && (
          <div>
            <SecHead num="6.0">Out of Scope</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <tbody>{data.outOfScope.map((item, i) => <tr key={i}><td style={{ ...tdS, padding: '8px 12px' }}><span style={{ color: '#6B7280', marginRight: 8 }}>✗</span>{item}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function PRDContent({ data }) {
  if (!data) return null
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  const priBadge = { P0: '#FEE2E2', P1: '#FEF3C7', P1c: '#DC2626', P1y: '#92400E', P2: '#DBEAFE', P2c: '#1D4ED8' }
  function PriTag({ p }) {
    const bg = p === 'P0' ? '#FEE2E2' : p === 'P1' ? '#FEF3C7' : '#DBEAFE'
    const col = p === 'P0' ? '#DC2626' : p === 'P1' ? '#92400E' : '#1D4ED8'
    return <span style={{ background: bg, color: col, borderRadius: 3, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>{p}</span>
  }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="Product Requirements Document" docNumber="PRD-001"/>
      <DocTitleBlock category="Product Requirements" title="Product Requirements Document (PRD)" subtitle={`Version ${data.version || '1.0'} · Status: ${data.status || 'Draft'}`}/>
      <DocBody>
        <div>
          <SecHead num="1.0">Overview</SecHead>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0 }}>{data.overview}</p>
        </div>
        {(data.goals?.length > 0) && (
          <div>
            <SecHead num="2.0">Goals</SecHead>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{data.goals.map((g, i) => <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5, lineHeight: 1.6 }}>{g}</li>)}</ul>
            {(data.nonGoals?.length > 0) && <div style={{ marginTop: 12 }}><p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', margin: '0 0 6px' }}>NOT in scope:</p><ul style={{ margin: 0, paddingLeft: 20 }}>{data.nonGoals.map((g, i) => <li key={i} style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>{g}</li>)}</ul></div>}
          </div>
        )}
        {(data.userPersonas?.length > 0) && (
          <div>
            <SecHead num="3.0">User Personas</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Persona</th><th style={thS}>Role</th><th style={thS}>Needs</th><th style={thS}>Pain Points</th></tr></thead>
              <tbody>{data.userPersonas.map((p, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={tdS}><strong>{p.name}</strong></td><td style={tdS}>{p.role}</td><td style={tdS}>{p.needs}</td><td style={tdS}>{p.painPoints}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.functionalRequirements?.length > 0) && (
          <div>
            <SecHead num="4.0">Functional Requirements</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={{ ...thS, width: 70 }}>ID</th><th style={thS}>Category</th><th style={thS}>Requirement</th><th style={{ ...thS, width: 60 }}>Priority</th></tr></thead>
              <tbody>{data.functionalRequirements.map((r, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontFamily: 'monospace', fontSize: 11 }}>{r.id}</td><td style={tdS}>{r.category}</td><td style={tdS}>{r.requirement}</td><td style={{ ...tdS, textAlign: 'center' }}><PriTag p={r.priority}/></td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.nonFunctionalRequirements?.length > 0) && (
          <div>
            <SecHead num="5.0">Non-Functional Requirements</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={{ ...thS, width: 70 }}>ID</th><th style={thS}>Category</th><th style={thS}>Requirement</th></tr></thead>
              <tbody>{data.nonFunctionalRequirements.map((r, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontFamily: 'monospace', fontSize: 11 }}>{r.id}</td><td style={tdS}>{r.category}</td><td style={tdS}>{r.requirement}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.risksAndMitigations?.length > 0) && (
          <div>
            <SecHead num="6.0">Risks & Mitigations</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Risk</th><th style={thS}>Mitigation</th><th style={{ ...thS, width: 90 }}>Likelihood</th></tr></thead>
              <tbody>{data.risksAndMitigations.map((r, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={tdS}>{r.risk}</td><td style={tdS}>{r.mitigation}</td><td style={{ ...tdS, textAlign: 'center' }}>{r.likelihood}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.dependencies?.length > 0) && (
          <div>
            <SecHead num="7.0">Dependencies</SecHead>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{data.dependencies.map((d, i) => <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5 }}>{d}</li>)}</ul>
          </div>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function UserStoriesContent({ data }) {
  if (!data) return null
  const epics = data.epics || []
  function PriTag({ p }) {
    const bg = p === 'P0' ? '#FEE2E2' : p === 'P1' ? '#FEF3C7' : '#DBEAFE'
    const col = p === 'P0' ? '#DC2626' : p === 'P1' ? '#92400E' : '#1D4ED8'
    return <span style={{ background: bg, color: col, borderRadius: 3, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>{p}</span>
  }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="User Stories" docNumber="US-001"/>
      <DocTitleBlock category="Agile Requirements" title="User Stories & Acceptance Criteria" subtitle="Epics, stories, and definition of done"/>
      <DocBody>
        {epics.map((epic, ei) => (
          <div key={ei}>
            <div style={{ background: '#1C3557', borderRadius: 6, padding: '10px 16px', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#93C5FD', marginRight: 10 }}>{epic.id}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{epic.title}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 8 }}>
              {(epic.stories || []).map((s, si) => (
                <div key={si} style={{ border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ background: '#F9FAFB', padding: '8px 14px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#6B7280' }}>{s.id}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1 }}>{s.title}</span>
                    <PriTag p={s.priority}/>
                    {s.estimate && <span style={{ fontSize: 10, color: '#9CA3AF' }}>{s.estimate} pts</span>}
                  </div>
                  <div style={{ padding: '10px 14px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12.5, color: '#374151', fontStyle: 'italic' }}>
                      As a <strong>{s.asA}</strong>, I want <strong>{s.iWant}</strong>, so that <strong>{s.soThat}</strong>.
                    </p>
                    {(s.acceptanceCriteria?.length > 0) && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#1C3557', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Acceptance Criteria</p>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>{s.acceptanceCriteria.map((ac, ai) => <li key={ai} style={{ fontSize: 12, color: '#374151', marginBottom: 3, lineHeight: 1.5 }}>{ac}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function SuccessMetricsContent({ data }) {
  if (!data) return null
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="Success Metrics" docNumber="KPI-001"/>
      <DocTitleBlock category="Performance Management" title="Success Metrics & KPI Plan" subtitle="Primary KPIs, measurement cadence, and success thresholds"/>
      <DocBody>
        {(data.primaryKPIs?.length > 0) && (
          <div>
            <SecHead num="1.0">Primary KPIs</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Metric</th><th style={thS}>Baseline</th><th style={thS}>Target</th><th style={thS}>Timeline</th><th style={thS}>Measurement</th></tr></thead>
              <tbody>{data.primaryKPIs.map((k, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontWeight: 600 }}>{k.metric}</td><td style={tdS}>{k.baseline}</td><td style={{ ...tdS, color: '#166534', fontWeight: 600 }}>{k.target}</td><td style={tdS}>{k.timeline}</td><td style={tdS}>{k.measurement}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.secondaryMetrics?.length > 0) && (
          <div>
            <SecHead num="2.0">Secondary Metrics</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Metric</th><th style={thS}>Target</th><th style={thS}>Measurement</th></tr></thead>
              <tbody>{data.secondaryMetrics.map((m, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={tdS}>{m.metric}</td><td style={{ ...tdS, color: '#166534' }}>{m.target}</td><td style={tdS}>{m.measurement}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {(data.leadingIndicators?.length > 0) && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Leading Indicators</p>
              <ul style={{ margin: 0, paddingLeft: 16 }}>{data.leadingIndicators.map((l, i) => <li key={i} style={{ fontSize: 12, color: '#1E40AF', marginBottom: 4 }}>{l}</li>)}</ul>
            </div>
          )}
          {(data.laggingIndicators?.length > 0) && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#166534', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lagging Indicators</p>
              <ul style={{ margin: 0, paddingLeft: 16 }}>{data.laggingIndicators.map((l, i) => <li key={i} style={{ fontSize: 12, color: '#15803D', marginBottom: 4 }}>{l}</li>)}</ul>
            </div>
          )}
        </div>
        {data.successThreshold && (
          <div>
            <SecHead num="4.0">Success Threshold</SecHead>
            <div style={{ background: '#F0FDF4', border: '1px solid #22C55E', borderLeft: '4px solid #22C55E', borderRadius: 4, padding: '12px 16px' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#166534', fontWeight: 600 }}>{data.successThreshold}</p>
              {data.measurementCadence && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#166534' }}>Cadence: {data.measurementCadence} · {data.reportingStructure}</p>}
            </div>
          </div>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function QATestPlanContent({ data }) {
  if (!data) return null
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 12, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  function PriTag({ p }) {
    const bg = p === 'Critical' ? '#FEE2E2' : p === 'High' ? '#FEF3C7' : '#F3F4F6'
    const col = p === 'Critical' ? '#DC2626' : p === 'High' ? '#92400E' : '#6B7280'
    return <span style={{ background: bg, color: col, borderRadius: 3, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>{p}</span>
  }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="QA Test Plan" docNumber="QA-001"/>
      <DocTitleBlock category="Quality Assurance" title="QA & Test Plan" subtitle={data.testApproach || 'Functional and regression test coverage'}/>
      <DocBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '12px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scope</p>
            <p style={{ fontSize: 12.5, color: '#374151', margin: 0, lineHeight: 1.5 }}>{data.scope}</p>
          </div>
          <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '12px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Environments</p>
            <p style={{ fontSize: 12.5, color: '#374151', margin: 0 }}>{(data.testEnvironments || []).join(' → ')}</p>
          </div>
        </div>
        {(data.testCases?.length > 0) && (
          <div>
            <SecHead num="1.0">Test Cases</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={{ ...thS, width: 70 }}>ID</th><th style={thS}>Module</th><th style={thS}>Test Case</th><th style={thS}>Expected Result</th><th style={{ ...thS, width: 80 }}>Priority</th></tr></thead>
              <tbody>{data.testCases.map((tc, i) => (
                <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}>
                  <td style={{ ...tdS, fontFamily: 'monospace', fontSize: 11 }}>{tc.id}</td>
                  <td style={tdS}>{tc.module}</td>
                  <td style={tdS}>
                    <strong style={{ display: 'block', marginBottom: 3 }}>{tc.testCase}</strong>
                    {tc.preconditions && <span style={{ fontSize: 11, color: '#9CA3AF' }}>Pre: {tc.preconditions}</span>}
                  </td>
                  <td style={tdS}>{tc.expectedResult}</td>
                  <td style={{ ...tdS, textAlign: 'center' }}><PriTag p={tc.priority}/></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {(data.exitCriteria?.length > 0) && (
          <div>
            <SecHead num="2.0">Exit Criteria</SecHead>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{data.exitCriteria.map((e, i) => <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5, lineHeight: 1.5 }}>{e}</li>)}</ul>
            {data.defectManagement && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>{data.defectManagement}</p>}
          </div>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function TechnicalArchitectureContent({ data }) {
  if (!data) return null
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 12, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  const typeColor = { Frontend: '#DBEAFE', Backend: '#D1FAE5', Database: '#FEF3C7', Integration: '#F3E8FF', External: '#F3F4F6' }
  const typeText = { Frontend: '#1D4ED8', Backend: '#065F46', Database: '#92400E', Integration: '#6D28D9', External: '#374151' }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="Technical Architecture" docNumber="ARCH-001"/>
      <DocTitleBlock category="Technical Design" title="Technical Architecture Overview" subtitle={data.overview || 'System components, data flow, and infrastructure'}/>
      <DocBody>
        {data.overview && (
          <div>
            <SecHead num="1.0">Architecture Overview</SecHead>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0 }}>{data.overview}</p>
            {data.diagramDescription && <p style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', margin: '8px 0 0', lineHeight: 1.6 }}>{data.diagramDescription}</p>}
          </div>
        )}
        {(data.components?.length > 0) && (
          <div>
            <SecHead num="2.0">System Components</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Component</th><th style={{ ...thS, width: 100 }}>Type</th><th style={thS}>Description</th><th style={thS}>Technology</th></tr></thead>
              <tbody>{data.components.map((c, i) => (
                <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}>
                  <td style={{ ...tdS, fontWeight: 600 }}>{c.name}</td>
                  <td style={{ ...tdS, textAlign: 'center' }}><span style={{ background: typeColor[c.type]||'#F3F4F6', color: typeText[c.type]||'#374151', borderRadius: 3, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>{c.type}</span></td>
                  <td style={tdS}>{c.description}</td>
                  <td style={{ ...tdS, fontFamily: 'monospace', fontSize: 11 }}>{c.technology}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {(data.dataFlow?.length > 0) && (
          <div>
            <SecHead num="3.0">Data Flow</SecHead>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.dataFlow.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: i%2===0?'#F9FAFB':'#fff', border: '1px solid #E5E7EB', borderRadius: 4 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', minWidth: 20 }}>#{f.step}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{f.from}</span>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>→</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{f.to}</span>
                  <span style={{ fontSize: 11, color: '#6B7280', flex: 1 }}>— {f.description}</span>
                  {f.protocol && <span style={{ fontSize: 9.5, background: '#E0E7FF', color: '#3730A3', borderRadius: 3, padding: '1px 5px', fontFamily: 'monospace' }}>{f.protocol}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {data.infrastructure && (
          <div>
            <SecHead num="4.0">Infrastructure</SecHead>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(data.infrastructure).map(([k, v]) => (
                <div key={k} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 4, padding: '8px 12px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 3 }}>{k}</span>
                  <span style={{ fontSize: 12.5, color: '#111827' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {(data.securityArchitecture?.length > 0) && (
          <div>
            <SecHead num="5.0">Security Architecture</SecHead>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{data.securityArchitecture.map((s, i) => <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5, lineHeight: 1.5 }}>{s}</li>)}</ul>
          </div>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function IntegrationSpecContent({ data }) {
  if (!data) return null
  const integrations = data.integrations || []
  const thS = { padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '7px 10px', fontSize: 11.5, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  const dirColor = { Inbound: '#DBEAFE', Outbound: '#D1FAE5', Bidirectional: '#F3E8FF' }
  const dirText = { Inbound: '#1D4ED8', Outbound: '#065F46', Bidirectional: '#6D28D9' }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="Integration Specification" docNumber="INT-001"/>
      <DocTitleBlock category="Systems Integration" title="Integration Specification" subtitle={`${integrations.length} integration(s) defined`}/>
      <DocBody>
        {integrations.map((int, ii) => (
          <div key={ii} style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: '#F8FAFC', padding: '10px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B7280' }}>{int.id}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', flex: 1 }}>{int.system}</span>
              <span style={{ background: dirColor[int.direction]||'#F3F4F6', color: dirText[int.direction]||'#374151', borderRadius: 3, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{int.direction}</span>
              <span style={{ fontSize: 11, color: '#6B7280' }}>{int.type}</span>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#374151', lineHeight: 1.5 }}>{int.purpose}</p>
              {(int.endpoints?.length > 0) && (
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB', marginBottom: 10 }}>
                  <thead><tr><th style={{ ...thS, width: 60 }}>Method</th><th style={thS}>Endpoint</th><th style={thS}>Description</th><th style={thS}>Auth</th></tr></thead>
                  <tbody>{int.endpoints.map((ep, ei) => <tr key={ei}><td style={{ ...tdS, fontFamily: 'monospace', fontWeight: 700, color: ep.method === 'POST' ? '#DC2626' : '#1D4ED8' }}>{ep.method}</td><td style={{ ...tdS, fontFamily: 'monospace', fontSize: 11 }}>{ep.endpoint}</td><td style={tdS}>{ep.description}</td><td style={tdS}>{ep.authentication}</td></tr>)}</tbody>
                </table>
              )}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {int.frequency && <span style={{ fontSize: 11, color: '#6B7280' }}>Frequency: <strong>{int.frequency}</strong></span>}
                {int.sla && <span style={{ fontSize: 11, color: '#6B7280' }}>SLA: <strong>{int.sla}</strong></span>}
                {int.errorHandling && <span style={{ fontSize: 11, color: '#6B7280' }}>Error handling: {int.errorHandling}</span>}
              </div>
            </div>
          </div>
        ))}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function BusinessCaseContent({ data }) {
  if (!data) return null
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  const fin = data.financialSummary || {}
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="Business Case" docNumber="BC-001"/>
      <DocTitleBlock category="Strategic Justification" title="Business Case" subtitle="Investment rationale, benefits, and alternatives analysis"/>
      <DocBody>
        <div>
          <SecHead num="1.0">Executive Summary</SecHead>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0 }}>{data.executiveSummary}</p>
        </div>
        {fin.investmentRequired && (
          <div>
            <SecHead num="2.0">Financial Summary</SecHead>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[['Investment Required', fin.investmentRequired, '#FEF3C7', '#92400E'], ['Expected Savings', fin.expectedSavings, '#D1FAE5', '#065F46'], ['Payback Period', fin.paybackPeriod, '#DBEAFE', '#1D4ED8'], ['ROI', fin.roi, '#F3E8FF', '#6D28D9']].map(([label, val, bg, col]) => (
                <div key={label} style={{ background: bg, borderRadius: 6, padding: '12px 14px' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: col, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: col, margin: 0 }}>{val}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {(data.benefits?.length > 0) && (
          <div>
            <SecHead num="3.0">Benefits</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={{ ...thS, width: 100 }}>Type</th><th style={thS}>Benefit</th><th style={thS}>Value</th></tr></thead>
              <tbody>{data.benefits.map((b, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={tdS}><span style={{ fontSize: 11, fontWeight: 700, color: b.type === 'Quantitative' ? '#065F46' : '#6D28D9' }}>{b.type}</span></td><td style={tdS}>{b.benefit}</td><td style={{ ...tdS, fontWeight: 600 }}>{b.value}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.alternatives?.length > 0) && (
          <div>
            <SecHead num="4.0">Alternatives Considered</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Alternative</th><th style={thS}>Reason Rejected</th></tr></thead>
              <tbody>{data.alternatives.map((a, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={tdS}>{a.option}</td><td style={tdS}>{a.reason}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {data.recommendation && (
          <div>
            <SecHead num="5.0">Recommendation</SecHead>
            <div style={{ background: '#F0FDF4', border: '1px solid #22C55E', borderLeft: '4px solid #22C55E', borderRadius: 4, padding: '14px 18px' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#166534', lineHeight: 1.6 }}>{data.recommendation}</p>
            </div>
          </div>
        )}
        {(data.strategicAlignment?.length > 0) && (
          <div>
            <SecHead num="6.0">Strategic Alignment</SecHead>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{data.strategicAlignment.map((s, i) => <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5 }}>{s}</li>)}</ul>
          </div>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function CostBreakdownContent({ data }) {
  if (!data) return null
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 12.5, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  const numS = { ...tdS, textAlign: 'right', fontFamily: 'monospace' }
  function fmt(n) { return n ? `${(data.currency || 'USD')} ${Number(n).toLocaleString()}` : '—' }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="Cost Breakdown" docNumber="COST-001"/>
      <DocTitleBlock category="Financial Planning" title="Cost Breakdown" subtitle={`Total: ${fmt(data.grandTotal)} · Currency: ${data.currency || 'USD'}`}/>
      <DocBody>
        {(data.categories || []).map((cat, ci) => (
          <div key={ci}>
            <SecHead num={`${ci + 1}.0`}>{cat.category}</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Item</th><th style={thS}>Description</th><th style={{ ...thS, textAlign: 'right', width: 70 }}>Unit</th><th style={{ ...thS, textAlign: 'right', width: 60 }}>Qty</th><th style={{ ...thS, textAlign: 'right', width: 90 }}>Unit Cost</th><th style={{ ...thS, textAlign: 'right', width: 90 }}>Total</th></tr></thead>
              <tbody>
                {(cat.items || []).map((item, ii) => (
                  <tr key={ii} style={{ background: ii%2===0?'#fff':'#F9FAFB' }}>
                    <td style={{ ...tdS, fontWeight: 600 }}>{item.item}</td>
                    <td style={tdS}>{item.description}</td>
                    <td style={numS}>{item.unit}</td>
                    <td style={numS}>{item.quantity}</td>
                    <td style={numS}>{fmt(item.unitCost)}</td>
                    <td style={{ ...numS, fontWeight: 700 }}>{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div style={{ background: '#1C3557', borderRadius: 6, padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: 40 }}>
          {data.totalCapex != null && <span style={{ fontSize: 12, color: '#93C5FD' }}>CapEx: <strong style={{ color: '#fff' }}>{fmt(data.totalCapex)}</strong></span>}
          {data.totalOpex != null && <span style={{ fontSize: 12, color: '#93C5FD' }}>OpEx: <strong style={{ color: '#fff' }}>{fmt(data.totalOpex)}</strong></span>}
          <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Grand Total: {fmt(data.grandTotal)}</span>
        </div>
        {(data.assumptions?.length > 0) && (
          <div>
            <SecHead num="Notes">Assumptions</SecHead>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{data.assumptions.map((a, i) => <li key={i} style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{a}</li>)}</ul>
          </div>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function ROIAnalysisContent({ data }) {
  if (!data) return null
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 12.5, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="ROI Analysis" docNumber="ROI-001"/>
      <DocTitleBlock category="Financial Analysis" title="ROI & Savings Analysis" subtitle={`${data.timeframe || '24 months'} analysis · ROI: ${data.roi || '—'} · Payback: ${data.paybackPeriod || '—'}`}/>
      <DocBody>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[['Net Benefit', data.netBenefit, '#D1FAE5', '#065F46'], ['ROI', data.roi, '#F3E8FF', '#6D28D9'], ['Payback', data.paybackPeriod, '#DBEAFE', '#1D4ED8'], ['Ongoing Cost/yr', data.ongoingCost, '#FEF3C7', '#92400E']].map(([label, val, bg, col]) => val && (
            <div key={label} style={{ background: bg, borderRadius: 6, padding: '12px 14px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: col, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
              <p style={{ fontSize: 15, fontWeight: 800, color: col, margin: 0 }}>{typeof val === 'number' ? `$${Number(val).toLocaleString()}` : val}</p>
            </div>
          ))}
        </div>
        {(data.currentCosts?.length > 0) && (
          <div>
            <SecHead num="1.0">Current Costs (As-Is)</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Cost Item</th><th style={thS}>Description</th><th style={{ ...thS, textAlign: 'right', width: 120 }}>Annual Cost</th></tr></thead>
              <tbody>{data.currentCosts.map((c, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontWeight: 600 }}>{c.item}</td><td style={tdS}>{c.description}</td><td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace', color: '#DC2626', fontWeight: 600 }}>${Number(c.annualCost).toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.projectedSavings?.length > 0) && (
          <div>
            <SecHead num="2.0">Projected Savings (To-Be)</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Saving Category</th><th style={thS}>How Achieved</th><th style={{ ...thS, width: 90 }}>Confidence</th><th style={{ ...thS, textAlign: 'right', width: 130 }}>Annual Saving</th></tr></thead>
              <tbody>{data.projectedSavings.map((s, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontWeight: 600 }}>{s.item}</td><td style={tdS}>{s.description}</td><td style={{ ...tdS, textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 700, color: s.confidence === 'High' ? '#065F46' : '#92400E', background: s.confidence === 'High' ? '#D1FAE5' : '#FEF3C7', borderRadius: 3, padding: '2px 6px' }}>{s.confidence}</span></td><td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace', color: '#166534', fontWeight: 700 }}>${Number(s.annualSaving).toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.sensitivity?.length > 0) && (
          <div>
            <SecHead num="3.0">Sensitivity Analysis</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Scenario</th><th style={{ ...thS, textAlign: 'center' }}>ROI</th><th style={{ ...thS, textAlign: 'center' }}>Payback Period</th></tr></thead>
              <tbody>{data.sensitivity.map((s, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontWeight: 600 }}>{s.scenario}</td><td style={{ ...tdS, textAlign: 'center', fontWeight: 700, color: '#166534' }}>{s.roi}</td><td style={{ ...tdS, textAlign: 'center' }}>{s.payback}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function LegalComplianceContent({ data }) {
  if (!data) return null
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 12.5, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  function StatusTag({ s }) {
    const cfg = { Required: ['#FEE2E2', '#DC2626'], 'In Progress': ['#FEF3C7', '#92400E'], Complete: ['#D1FAE5', '#065F46'], 'N/A': ['#F3F4F6', '#9CA3AF'] }
    const [bg, col] = cfg[s] || ['#F3F4F6', '#6B7280']
    return <span style={{ background: bg, color: col, borderRadius: 3, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>{s}</span>
  }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="Legal & Compliance" docNumber="COMP-001"/>
      <DocTitleBlock category="Compliance & Risk" title="Legal & Compliance Checklist" subtitle={`Data Classification: ${data.dataClassification || 'Internal'}`}/>
      <DocBody>
        {(data.applicableRegulations?.length > 0) && (
          <div>
            <SecHead num="1.0">Applicable Regulations</SecHead>
            {data.applicableRegulations.map((reg, ri) => (
              <div key={ri} style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '12px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1C3557' }}>{reg.regulation}</span>
                  <span style={{ fontSize: 11, color: '#6B7280' }}>— {reg.applicability}</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{(reg.requirements || []).map((r, i) => <li key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 3 }}>{r}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
        {(data.complianceChecklist?.length > 0) && (
          <div>
            <SecHead num="2.0">Compliance Checklist</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Item</th><th style={{ ...thS, width: 100 }}>Status</th><th style={{ ...thS, width: 130 }}>Owner</th><th style={thS}>Notes</th></tr></thead>
              <tbody>{data.complianceChecklist.map((c, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={tdS}>{c.item}</td><td style={{ ...tdS, textAlign: 'center' }}><StatusTag s={c.status}/></td><td style={tdS}>{c.owner}</td><td style={{ ...tdS, color: '#9CA3AF' }}>{c.notes}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.privacyConsiderations?.length > 0) && (
          <div>
            <SecHead num="3.0">Privacy Considerations</SecHead>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{data.privacyConsiderations.map((p, i) => <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5, lineHeight: 1.5 }}>{p}</li>)}</ul>
          </div>
        )}
        {(data.approvals?.length > 0) && (
          <div>
            <SecHead num="4.0">Required Approvals</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Approver</th><th style={{ ...thS, width: 100 }}>Type</th><th style={{ ...thS, width: 100 }}>Status</th></tr></thead>
              <tbody>{data.approvals.map((a, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={tdS}>{a.approver}</td><td style={tdS}>{a.type}</td><td style={{ ...tdS, textAlign: 'center' }}><StatusTag s={a.status}/></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function DataSecurityContent({ data }) {
  if (!data) return null
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 12.5, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  const sensColor = { High: ['#FEE2E2', '#DC2626'], Medium: ['#FEF3C7', '#92400E'], Low: ['#D1FAE5', '#065F46'] }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="Data Privacy & Security" docNumber="SEC-001"/>
      <DocTitleBlock category="Security Architecture" title="Data Privacy & Security Considerations" subtitle="Data inventory, access controls, and security requirements"/>
      <DocBody>
        {(data.dataInventory?.length > 0) && (
          <div>
            <SecHead num="1.0">Data Inventory</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Data Type</th><th style={{ ...thS, width: 90 }}>Sensitivity</th><th style={thS}>Storage</th><th style={thS}>Access</th></tr></thead>
              <tbody>{data.dataInventory.map((d, i) => {
                const [bg, col] = sensColor[d.sensitivity] || ['#F3F4F6', '#374151']
                return <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontWeight: 600 }}>{d.dataType}</td><td style={{ ...tdS, textAlign: 'center' }}><span style={{ background: bg, color: col, borderRadius: 3, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>{d.sensitivity}</span></td><td style={tdS}>{d.storage}</td><td style={tdS}>{d.access}</td></tr>
              })}</tbody>
            </table>
          </div>
        )}
        {(data.accessControls?.length > 0) && (
          <div>
            <SecHead num="2.0">Access Controls</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Role</th><th style={thS}>Permissions</th><th style={thS}>Restrictions</th></tr></thead>
              <tbody>{data.accessControls.map((ac, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontWeight: 600 }}>{ac.role}</td><td style={tdS}>{(ac.permissions || []).join(', ')}</td><td style={{ ...tdS, color: '#DC2626' }}>{ac.restrictions}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.encryptionRequirements?.length > 0) && (
          <div>
            <SecHead num="3.0">Encryption Requirements</SecHead>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{data.encryptionRequirements.map((e, i) => <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 5 }}>{e}</li>)}</ul>
          </div>
        )}
        {(data.securityControls?.length > 0) && (
          <div>
            <SecHead num="4.0">Security Controls</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Control</th><th style={thS}>Description</th><th style={{ ...thS, width: 80 }}>Required</th></tr></thead>
              <tbody>{data.securityControls.map((c, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontWeight: 600 }}>{c.control}</td><td style={tdS}>{c.description}</td><td style={{ ...tdS, textAlign: 'center' }}><span style={{ fontSize: 11, color: c.required ? '#065F46' : '#9CA3AF', fontWeight: 700 }}>{c.required ? '✓ Yes' : '— No'}</span></td></tr>)}</tbody>
            </table>
          </div>
        )}
        {data.incidentResponse && (
          <div>
            <SecHead num="5.0">Incident Response</SecHead>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0 }}>{data.incidentResponse}</p>
          </div>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function PermissionsMatrixContent({ data }) {
  if (!data) return null
  const roles = (data.roles || []).map(r => r.role)
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 10px', fontSize: 12, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  function PermCell({ val }) {
    if (!val) return <span style={{ color: '#E5E7EB' }}>—</span>
    const icon = val === true || val === 'Full' ? '✓' : val === 'Read' ? '◎' : val === 'Own' ? '◑' : typeof val === 'string' ? val : '—'
    const col = val === true || val === 'Full' ? '#065F46' : val === 'Read' ? '#1D4ED8' : '#92400E'
    return <span style={{ color: col, fontWeight: 700, fontSize: 13 }}>{icon}</span>
  }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="Permissions Matrix" docNumber="PERM-001"/>
      <DocTitleBlock category="Access Control" title="Permissions & Role Access Matrix" subtitle={`${roles.length} role(s) · ${(data.features || []).length} feature(s)`}/>
      <DocBody>
        {(data.roles?.length > 0) && (
          <div>
            <SecHead num="1.0">Roles</SecHead>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {data.roles.map((r, i) => (
                <div key={i} style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 14px', minWidth: 140 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>{r.role}</p>
                  <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{r.description}</p>
                  {r.userCount && <p style={{ fontSize: 10, color: '#9CA3AF', margin: '3px 0 0' }}>~{r.userCount} users</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {(data.features?.length > 0) && (
          <div>
            <SecHead num="2.0">Feature Permissions</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead>
                <tr>
                  <th style={thS}>Feature</th>
                  {roles.map(r => <th key={r} style={{ ...thS, textAlign: 'center', width: 80 }}>{r}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.features.map((f, i) => (
                  <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}>
                    <td style={tdS}>{f.feature}</td>
                    {roles.map(r => <td key={r} style={{ ...tdS, textAlign: 'center' }}><PermCell val={f.permissions[r]}/></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(data.specialPermissions?.length > 0) && (
          <div>
            <SecHead num="3.0">Special Permissions</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Permission</th><th style={thS}>Roles</th><th style={thS}>Notes</th></tr></thead>
              <tbody>{data.specialPermissions.map((sp, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontWeight: 600 }}>{sp.permission}</td><td style={tdS}>{(sp.roles || []).join(', ')}</td><td style={tdS}>{sp.notes}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function WorkflowDeltaContent({ data, variant }) {
  if (!data) return null
  const isCurrentState = variant === 'current'
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: isCurrentState ? '#92400E' : '#065F46', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 12.5, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  const accentColor = isCurrentState ? '#92400E' : '#065F46'
  const accentBg = isCurrentState ? '#FEF3C7' : '#D1FAE5'
  const accentBorder = isCurrentState ? '#F59E0B' : '#22C55E'
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType={isCurrentState ? 'Current State Analysis' : 'Future State Design'} docNumber={isCurrentState ? 'AS-IS-001' : 'TO-BE-001'}/>
      <DocTitleBlock
        category={isCurrentState ? 'Process Analysis' : 'Process Design'}
        title={data.title || (isCurrentState ? 'Current State Workflow (As-Is)' : 'Future State Workflow (To-Be)')}
        subtitle={data.description}
      />
      <DocBody>
        {(data.actors?.length > 0) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {data.actors.map((a, i) => <span key={i} style={{ background: accentBg, color: accentColor, borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>{a}</span>)}
          </div>
        )}
        {(data.steps?.length > 0) && (
          <div>
            <SecHead num="1.0">Process Steps</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead>
                <tr>
                  <th style={{ ...thS, width: 40 }}>#</th>
                  <th style={thS}>Actor</th>
                  <th style={thS}>Action</th>
                  <th style={thS}>{isCurrentState ? 'Tool Used' : 'System / Tool'}</th>
                  {isCurrentState ? <th style={thS}>Pain Point</th> : <th style={thS}>Improvement</th>}
                  {isCurrentState ? <th style={{ ...thS, width: 90 }}>Time Spent</th> : <th style={{ ...thS, width: 80 }}>Automated?</th>}
                </tr>
              </thead>
              <tbody>
                {data.steps.map((s, i) => (
                  <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}>
                    <td style={{ ...tdS, textAlign: 'center', fontWeight: 700, color: '#9CA3AF' }}>{s.step}</td>
                    <td style={{ ...tdS, fontWeight: 600 }}>{s.actor}</td>
                    <td style={tdS}>{s.action}</td>
                    <td style={{ ...tdS, fontFamily: 'monospace', fontSize: 11 }}>{s.tool}</td>
                    {isCurrentState
                      ? <td style={{ ...tdS, color: '#DC2626', fontSize: 11 }}>{s.painPoint}</td>
                      : <td style={{ ...tdS, color: '#065F46', fontSize: 11 }}>{s.improvement}</td>}
                    {isCurrentState
                      ? <td style={{ ...tdS, textAlign: 'center' }}>{s.timeSpent}</td>
                      : <td style={{ ...tdS, textAlign: 'center' }}><span style={{ fontSize: 12, fontWeight: 700, color: s.automated ? '#065F46' : '#9CA3AF' }}>{s.automated ? '✓ Auto' : 'Manual'}</span></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isCurrentState ? (
          <>
            {(data.painPoints?.length > 0) && (
              <div>
                <SecHead num="2.0">Pain Points</SecHead>
                <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderLeft: '4px solid #F59E0B', borderRadius: 4, padding: '12px 16px' }}>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>{data.painPoints.map((p, i) => <li key={i} style={{ fontSize: 13, color: '#92400E', marginBottom: 4 }}>{p}</li>)}</ul>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 16 }}>
              {data.totalTime && <div style={{ background: '#F3F4F6', borderRadius: 6, padding: '10px 14px', flex: 1 }}><p style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', margin: '0 0 3px', textTransform: 'uppercase' }}>Total Cycle Time</p><p style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: 0 }}>{data.totalTime}</p></div>}
              {data.errorRate && <div style={{ background: '#FEE2E2', borderRadius: 6, padding: '10px 14px', flex: 1 }}><p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', margin: '0 0 3px', textTransform: 'uppercase' }}>Error / Rework Rate</p><p style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', margin: 0 }}>{data.errorRate}</p></div>}
            </div>
          </>
        ) : (
          <>
            {(data.improvements?.length > 0) && (
              <div>
                <SecHead num="2.0">Key Improvements</SecHead>
                <div style={{ background: '#F0FDF4', border: '1px solid #22C55E', borderLeft: '4px solid #22C55E', borderRadius: 4, padding: '12px 16px' }}>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>{data.improvements.map((imp, i) => <li key={i} style={{ fontSize: 13, color: '#166534', marginBottom: 4 }}>{imp}</li>)}</ul>
                </div>
              </div>
            )}
            {data.timeReduction && <div style={{ background: '#D1FAE5', borderRadius: 6, padding: '10px 14px' }}><p style={{ fontSize: 10, fontWeight: 700, color: '#065F46', margin: '0 0 3px', textTransform: 'uppercase' }}>Time Reduction Per Transaction</p><p style={{ fontSize: 14, fontWeight: 700, color: '#065F46', margin: 0 }}>{data.timeReduction}</p></div>}
          </>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function LaunchPlanContent({ data }) {
  if (!data) return null
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 12.5, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  const statusColor = { Planned: ['#F3F4F6', '#6B7280'], 'In Progress': ['#DBEAFE', '#1D4ED8'], Complete: ['#D1FAE5', '#065F46'], Blocked: ['#FEE2E2', '#DC2626'] }
  function StatusBadge({ s }) {
    const [bg, col] = statusColor[s] || ['#F3F4F6', '#6B7280']
    return <span style={{ background: bg, color: col, borderRadius: 3, padding: '2px 6px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{s}</span>
  }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="Launch Plan" docNumber="LAUNCH-001"/>
      <DocTitleBlock category="Go-to-Market" title="Launch & Rollout Plan" subtitle={`Launch type: ${data.launchType || 'Phased'}`}/>
      <DocBody>
        {(data.timeline?.length > 0) && (
          <div>
            <SecHead num="1.0">Milestone Timeline</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Milestone</th><th style={{ ...thS, width: 80 }}>Date</th><th style={{ ...thS, width: 130 }}>Owner</th><th style={thS}>Dependencies</th><th style={{ ...thS, width: 100 }}>Status</th></tr></thead>
              <tbody>{data.timeline.map((m, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontWeight: 600 }}>{m.milestone}</td><td style={tdS}>{m.date}</td><td style={tdS}>{m.owner}</td><td style={{ ...tdS, fontSize: 11, color: '#6B7280' }}>{(m.dependencies || []).join(', ')}</td><td style={{ ...tdS, textAlign: 'center' }}><StatusBadge s={m.status}/></td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.communicationPlan?.length > 0) && (
          <div>
            <SecHead num="2.0">Communication Plan</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Audience</th><th style={thS}>Message</th><th style={{ ...thS, width: 90 }}>Channel</th><th style={{ ...thS, width: 120 }}>Timing</th></tr></thead>
              <tbody>{data.communicationPlan.map((c, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={tdS}>{c.audience}</td><td style={tdS}>{c.message}</td><td style={tdS}>{c.channel}</td><td style={tdS}>{c.timing}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.trainingPlan?.length > 0) && (
          <div>
            <SecHead num="3.0">Training Plan</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Audience</th><th style={thS}>Type</th><th style={{ ...thS, width: 90 }}>Duration</th><th style={thS}>Materials</th></tr></thead>
              <tbody>{data.trainingPlan.map((t, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontWeight: 600 }}>{t.audience}</td><td style={tdS}>{t.type}</td><td style={tdS}>{t.duration}</td><td style={tdS}>{t.materials}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(data.goLiveChecklist?.length > 0) && (
          <div>
            <SecHead num="4.0">Go-Live Checklist</SecHead>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.goLiveChecklist.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 4 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid #D1D5DB', borderRadius: 3, flexShrink: 0 }}/>
                  <span style={{ fontSize: 13, color: '#374151' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {data.rollbackPlan && (
          <div>
            <SecHead num="5.0">Rollback Plan</SecHead>
            <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderLeft: '4px solid #F59E0B', borderRadius: 4, padding: '12px 16px' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#92400E' }}>{data.rollbackPlan}</p>
            </div>
          </div>
        )}
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

function StakeholderSignoffContent({ data }) {
  if (!data) return null
  const thS = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#1C3557', textAlign: 'left' }
  const tdS = { padding: '8px 12px', fontSize: 12.5, color: '#374151', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
  function StatusTag({ s }) {
    const cfg = { Pending: ['#FEF3C7', '#92400E'], Approved: ['#D1FAE5', '#065F46'], Rejected: ['#FEE2E2', '#DC2626'] }
    const [bg, col] = cfg[s] || ['#F3F4F6', '#6B7280']
    return <span style={{ background: bg, color: col, borderRadius: 3, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{s}</span>
  }
  return (
    <div style={D.canvas}><div style={D.page}>
      <DocLetterhead docType="Stakeholder Sign-off" docNumber="SIGN-001"/>
      <DocTitleBlock category="Project Governance" title="Stakeholder Sign-off Checklist" subtitle={`${data.projectName || 'Project'} · Version ${data.version || '1.0'} · ${data.date || ''}`}/>
      <DocBody>
        {(data.approvers?.length > 0) && (
          <div>
            <SecHead num="1.0">Required Approvers</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Name / Role</th><th style={thS}>Title</th><th style={thS}>Department</th><th style={thS}>Sign-off Scope</th><th style={{ ...thS, width: 90 }}>Status</th><th style={thS}>Date</th></tr></thead>
              <tbody>{data.approvers.map((a, i) => (
                <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}>
                  <td style={{ ...tdS, fontWeight: 600 }}>{a.name}</td>
                  <td style={tdS}>{a.title}</td>
                  <td style={tdS}>{a.department}</td>
                  <td style={tdS}>{a.signoffScope}</td>
                  <td style={{ ...tdS, textAlign: 'center' }}><StatusTag s={a.status}/></td>
                  <td style={{ ...tdS, color: '#9CA3AF', fontStyle: 'italic' }}>{a.date || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {(data.reviewers?.length > 0) && (
          <div>
            <SecHead num="2.0">Reviewers (Advisory)</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={thS}>Reviewer</th><th style={thS}>Department</th><th style={thS}>Review Scope</th></tr></thead>
              <tbody>{data.reviewers.map((r, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontWeight: 600 }}>{r.name}</td><td style={tdS}>{r.department}</td><td style={tdS}>{r.reviewScope}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {data.approvalNotes && (
          <div>
            <SecHead num="3.0">Approval Notes</SecHead>
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderLeft: '4px solid #3B82F6', borderRadius: 4, padding: '12px 16px' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#1E40AF', lineHeight: 1.6 }}>{data.approvalNotes}</p>
            </div>
          </div>
        )}
        {(data.changeLog?.length > 0) && (
          <div>
            <SecHead num="4.0">Change Log</SecHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB' }}>
              <thead><tr><th style={{ ...thS, width: 70 }}>Version</th><th style={{ ...thS, width: 120 }}>Date</th><th style={{ ...thS, width: 130 }}>Author</th><th style={thS}>Changes</th></tr></thead>
              <tbody>{data.changeLog.map((c, i) => <tr key={i} style={{ background: i%2===0?'#fff':'#F9FAFB' }}><td style={{ ...tdS, fontFamily: 'monospace' }}>{c.version}</td><td style={tdS}>{c.date}</td><td style={tdS}>{c.author}</td><td style={tdS}>{c.changes}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {/* Signature block */}
        <div style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '16px 20px', background: '#FAFBFC' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Signature Block</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {(data.approvers || []).slice(0, 4).map((a, i) => (
              <div key={i}>
                <div style={{ borderBottom: '1px solid #9CA3AF', height: 32, marginBottom: 4 }}/>
                <p style={{ fontSize: 11, color: '#374151', margin: 0, fontWeight: 600 }}>{a.name}</p>
                <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>{a.title} · {a.department}</p>
              </div>
            ))}
          </div>
        </div>
      </DocBody>
      <DocFooter/>
    </div></div>
  )
}

// ─── Role-specific Content components ────────────────────────────────────────

// Shared doc primitives
function DocTable({ columns, rows, accent = '#374151' }) {
  if (!rows?.length) return null
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>{columns.map(c => <th key={c} style={{ padding: '7px 12px', background: '#1E293B', color: '#E2E8F0', fontWeight: 600, fontSize: 10, textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
              {columns.map(c => <td key={c} style={{ padding: '8px 12px', borderBottom: '1px solid #E5E7EB', color: '#374151', verticalAlign: 'top' }}>{row[c] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DocSection({ title, accent = '#4F46E5', children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ height: 1, width: 16, background: accent, opacity: 0.5 }}/>
        {title}
        <div style={{ height: 1, flex: 1, background: accent, opacity: 0.15 }}/>
      </div>
      {children}
    </div>
  )
}

function TagList({ items, accent = '#4F46E5', bg = '#EEF2FF' }) {
  if (!items?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
      {items.map((item, i) => (
        <span key={i} style={{ fontSize: 11, background: bg, color: accent, border: `1px solid ${accent}22`, borderRadius: 5, padding: '3px 10px' }}>{item}</span>
      ))}
    </div>
  )
}

function RiskBadge({ level }) {
  const map = { High: ['#FEF2F2', '#DC2626'], Medium: ['#FFFBEB', '#D97706'], Low: ['#F0FDF4', '#16A34A'] }
  const [bg, color] = map[level] || ['#F1F5F9', '#64748B']
  return <span style={{ fontSize: 10, fontWeight: 700, background: bg, color, borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap' }}>{level || '—'}</span>
}

// ── SOP Document ─────────────────────────────────────────────────────────────
function SOPContent({ data }) {
  if (!data) return null
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px', fontFamily: 'inherit' }}>
      <div style={{ borderBottom: '3px solid #0F172A', paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Standard Operating Procedure</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{data.title || 'SOP Document'}</div>
        <div style={{ fontSize: 13, color: '#475569' }}>{data.purpose}</div>
      </div>

      {data.scope && (
        <DocSection title="Scope"><p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0 }}>{data.scope}</p></DocSection>
      )}

      {data.roles?.length > 0 && (
        <DocSection title="Roles & Responsibilities">
          <DocTable columns={['Role', 'Responsibilities']} rows={data.roles.map(r => ({ Role: r.role, Responsibilities: Array.isArray(r.responsibilities) ? r.responsibilities.join('; ') : r.responsibilities }))}/>
        </DocSection>
      )}

      {data.procedure?.length > 0 && (
        <DocSection title="Procedure">
          {data.procedure.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{step.step}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 3 }}>{step.action}</div>
                {step.actor && <div style={{ fontSize: 11, color: '#64748B' }}>Actor: <strong>{step.actor}</strong></div>}
                {step.expectedOutcome && <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>→ {step.expectedOutcome}</div>}
              </div>
            </div>
          ))}
        </DocSection>
      )}

      {data.exceptions?.length > 0 && (
        <DocSection title="Exception Handling">
          <DocTable columns={['Scenario', 'Action']} rows={data.exceptions.map(e => ({ Scenario: e.scenario, Action: e.action }))}/>
        </DocSection>
      )}
    </div>
  )
}

// ── Escalation / Approval Matrix ─────────────────────────────────────────────
function EscalationMatrixContent({ data }) {
  if (!data) return null
  const levels = data.levels || data.tiers || data.stages || []
  const rows = levels.map(l => ({ Level: l.level ?? l.tier ?? l.stage, Trigger: l.trigger ?? l.condition ?? l.criteria, 'Escalate To': l.escalateTo ?? l.approver ?? '—', SLA: l.sla ?? '—', Action: l.action ?? '—' }))
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{data.overview ? 'Escalation Matrix' : 'Approval Matrix'}</div>
      {data.overview && <p style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>{data.overview}</p>}
      <DocSection title="Levels / Tiers">
        <DocTable columns={['Level', 'Trigger', 'Escalate To', 'SLA', 'Action']} rows={rows}/>
      </DocSection>
      {data.costCenterRules?.length > 0 && (
        <DocSection title="Cost Center Rules">
          <DocTable columns={['Cost Center', 'Approver', 'Budget']} rows={data.costCenterRules.map(r => ({ 'Cost Center': r.costCenter, Approver: r.approver, Budget: r.budget || '—' }))}/>
        </DocSection>
      )}
      {data.delegationRules?.length > 0 && (
        <DocSection title="Delegation Rules"><TagList items={data.delegationRules} accent="#7C3AED" bg="#F5F3FF"/></DocSection>
      )}
    </div>
  )
}

// ── Controls Framework ────────────────────────────────────────────────────────
function ControlsFrameworkContent({ data }) {
  if (!data) return null
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Controls Framework</div>
      {data.overview && <p style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>{data.overview}</p>}
      <DocSection title="Control Register">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>{['ID', 'Control', 'Category', 'Owner', 'Frequency', 'Risk', 'Evidence'].map(c => <th key={c} style={{ padding: '7px 10px', background: '#1E293B', color: '#E2E8F0', fontWeight: 600, fontSize: 10, textAlign: 'left', whiteSpace: 'nowrap' }}>{c}</th>)}</tr></thead>
            <tbody>
              {(data.controls || []).map((c, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#4F46E5', whiteSpace: 'nowrap' }}>{c.id}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 500, color: '#0F172A' }}>{c.name}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #E5E7EB', color: '#475569' }}>{c.category}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #E5E7EB', color: '#475569' }}>{c.owner}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #E5E7EB', color: '#475569' }}>{c.frequency}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #E5E7EB' }}><RiskBadge level={c.riskRating}/></td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #E5E7EB', color: '#64748B', fontSize: 11 }}>{c.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>
    </div>
  )
}

// ── Risk Matrix ───────────────────────────────────────────────────────────────
function RiskMatrixContent({ data }) {
  if (!data) return null
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 20 }}>Risk Assessment</div>
      <DocSection title="Risk Register">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>{['ID', 'Risk', 'Likelihood', 'Impact', 'Inherent', 'Controls', 'Residual', 'Owner'].map(c => <th key={c} style={{ padding: '7px 10px', background: '#7F1D1D', color: '#FEE2E2', fontWeight: 600, fontSize: 10, textAlign: 'left', whiteSpace: 'nowrap' }}>{c}</th>)}</tr></thead>
            <tbody>
              {(data.risks || []).map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FFF8F8' }}>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #FEE2E2', fontWeight: 700, color: '#DC2626' }}>{r.id}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #FEE2E2', fontWeight: 500, color: '#0F172A' }}>{r.risk}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #FEE2E2' }}><RiskBadge level={r.likelihood}/></td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #FEE2E2' }}><RiskBadge level={r.impact}/></td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #FEE2E2' }}><RiskBadge level={r.inherentRisk}/></td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #FEE2E2', color: '#475569', fontSize: 11 }}>{Array.isArray(r.controls) ? r.controls.join(', ') : r.controls}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #FEE2E2' }}><RiskBadge level={r.residualRisk}/></td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #FEE2E2', color: '#475569' }}>{r.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>
    </div>
  )
}

// ── Process Analysis ──────────────────────────────────────────────────────────
function ProcessAnalysisContent({ data }) {
  if (!data) return null
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 20 }}>Process Analysis</div>
      {data.currentState && (
        <DocSection title="Current State"><p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0 }}>{data.currentState}</p></DocSection>
      )}
      {data.painPoints?.length > 0 && (
        <DocSection title="Pain Points">
          {data.painPoints.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <span style={{ color: '#DC2626', fontWeight: 700, flexShrink: 0 }}>✕</span>
              <span style={{ fontSize: 13, color: '#374151' }}>{p}</span>
            </div>
          ))}
        </DocSection>
      )}
      {data.automationOpportunities?.length > 0 && (
        <DocSection title="Automation Opportunities">
          {data.automationOpportunities.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <span style={{ color: '#059669', fontWeight: 700, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 13, color: '#374151' }}>{o}</span>
            </div>
          ))}
        </DocSection>
      )}
      {data.estimatedTimeSavings && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '14px 18px', marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Estimated Time Savings</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#065F46' }}>{data.estimatedTimeSavings}</div>
        </div>
      )}
    </div>
  )
}

// ── Architecture Document ─────────────────────────────────────────────────────
function ArchitectureDocContent({ data }) {
  if (!data) return null
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Systems Architecture</div>
      {data.overview && <p style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>{data.overview}</p>}
      {data.components?.length > 0 && (
        <DocSection title="System Components">
          <DocTable columns={['Component', 'Role', 'Technology', 'Owner']} rows={data.components.map(c => ({ Component: c.name, Role: c.role, Technology: c.technology, Owner: c.owner }))}/>
        </DocSection>
      )}
      {data.dataFlow && (
        <DocSection title="Data Flow"><p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0 }}>{data.dataFlow}</p></DocSection>
      )}
      {data.securityModel && (
        <DocSection title="Security Model"><p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0 }}>{data.securityModel}</p></DocSection>
      )}
      {data.deploymentTarget && (
        <DocSection title="Deployment Target">
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#1D4ED8', fontWeight: 500 }}>{data.deploymentTarget}</div>
        </DocSection>
      )}
    </div>
  )
}

// ── Deployment Runbook ────────────────────────────────────────────────────────
function RunbookContent({ data }) {
  if (!data) return null
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 20 }}>Deployment Runbook</div>
      {data.prerequisites?.length > 0 && (
        <DocSection title="Prerequisites"><TagList items={data.prerequisites} accent="#0E7490" bg="#ECFEFF"/></DocSection>
      )}
      {data.steps?.length > 0 && (
        <DocSection title="Deployment Steps">
          {data.steps.map((phase, i) => (
            <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
              <div style={{ background: '#1E293B', padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#E2E8F0' }}>Phase {i + 1}: {phase.phase}</div>
              <div style={{ padding: '12px 16px' }}>
                {(phase.actions || []).map((a, j) => <div key={j} style={{ fontSize: 12, color: '#374151', marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #CBD5E1' }}>→ {a}</div>)}
                {phase.verificationSteps?.length > 0 && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#F0FDF4', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', marginBottom: 4 }}>VERIFY</div>
                    {phase.verificationSteps.map((v, j) => <div key={j} style={{ fontSize: 11, color: '#065F46' }}>✓ {v}</div>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </DocSection>
      )}
      {data.rollbackPlan && (
        <DocSection title="Rollback Plan">
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#7F1D1D' }}>{data.rollbackPlan}</div>
        </DocSection>
      )}
    </div>
  )
}

// ── Employee Journey Map ──────────────────────────────────────────────────────
function JourneyMapContent({ data }) {
  if (!data) return null
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Employee Journey Map</div>
      {data.event && <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>Event: <strong>{data.event}</strong></div>}
      {data.phases?.length > 0 && (
        <DocSection title="Journey Phases">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {data.phases.map((phase, i) => (
              <div key={i} style={{ display: 'flex', gap: 0, position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EC4899', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, zIndex: 1 }}>{i + 1}</div>
                  {i < data.phases.length - 1 && <div style={{ width: 2, flex: 1, background: '#FCE7F3', minHeight: 20 }}/>}
                </div>
                <div style={{ flex: 1, padding: '0 0 20px 12px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>{phase.phase}</div>
                  <div style={{ fontSize: 11, color: '#EC4899', marginBottom: 6 }}>Actor: {phase.actor} · {phase.duration}</div>
                  {phase.activities?.length > 0 && <div style={{ fontSize: 12, color: '#475569' }}>{phase.activities.join(' · ')}</div>}
                  {phase.systems?.length > 0 && <TagList items={phase.systems} accent="#9D174D" bg="#FDF2F8"/>}
                </div>
              </div>
            ))}
          </div>
        </DocSection>
      )}
      {data.touchpoints?.length > 0 && (
        <DocSection title="Key Touchpoints">
          <DocTable columns={['Touchpoint', 'Medium', 'Owner']} rows={data.touchpoints.map(t => ({ Touchpoint: t.touchpoint, Medium: t.medium, Owner: t.owner }))}/>
        </DocSection>
      )}
    </div>
  )
}

// ── Policy Documentation ──────────────────────────────────────────────────────
function PolicyContent({ data }) {
  if (!data) return null
  const policies = data.policies || []
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 20 }}>Policy Documentation</div>
      {policies.map((policy, i) => (
        <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ background: '#1E293B', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{policy.policy}</span>
            {policy.approvalRequired && <span style={{ fontSize: 9, background: '#F59E0B22', color: '#F59E0B', border: '0.5px solid #F59E0B44', borderRadius: 3, padding: '2px 6px', fontWeight: 700 }}>APPROVAL REQUIRED</span>}
          </div>
          <div style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>{policy.description}</p>
            {policy.eligibility && <div style={{ fontSize: 12, color: '#059669', marginBottom: 8 }}>✓ Eligibility: {policy.eligibility}</div>}
            {policy.limitations?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Limitations</div>
                {policy.limitations.map((l, j) => <div key={j} style={{ fontSize: 12, color: '#475569', marginBottom: 3 }}>• {l}</div>)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Notification Plan ─────────────────────────────────────────────────────────
function NotificationPlanContent({ data }) {
  if (!data) return null
  const notifications = data.notifications || []
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 20 }}>Notification Plan</div>
      <DocSection title="Notification Rules">
        <DocTable
          columns={['Event', 'Recipient', 'Channel', 'Timing', 'Message']}
          rows={notifications.map(n => ({ Event: n.event, Recipient: n.recipient, Channel: n.channel, Timing: n.timing || 'Immediately', Message: n.template || n.message || '—' }))}
        />
      </DocSection>
    </div>
  )
}

// ── Financial Controls ────────────────────────────────────────────────────────
function FinancialControlsContent({ data }) {
  if (!data) return null
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 20 }}>Financial Controls</div>
      {data.controls?.length > 0 && (
        <DocSection title="Control Register">
          <DocTable columns={['Control', 'Purpose', 'Enforcement']} rows={data.controls.map(c => ({ Control: c.control, Purpose: c.purpose, Enforcement: c.enforcement }))}/>
        </DocSection>
      )}
      {data.auditRequirements?.length > 0 && (
        <DocSection title="Audit Requirements"><TagList items={data.auditRequirements} accent="#065F46" bg="#F0FDF4"/></DocSection>
      )}
      {data.segregationOfDuties && (
        <DocSection title="Segregation of Duties">
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#92400E' }}>{data.segregationOfDuties}</div>
        </DocSection>
      )}
    </div>
  )
}

// ── Routing Logic ─────────────────────────────────────────────────────────────
function RoutingLogicContent({ data }) {
  if (!data) return null
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 20 }}>Routing Logic</div>
      {data.rules?.length > 0 && (
        <DocSection title="Routing Rules">
          {data.rules.map((rule, i) => (
            <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ background: '#1E293B', padding: '7px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', letterSpacing: '0.1em' }}>RULE {i + 1}</span>
                <span style={{ fontSize: 10, color: '#FDE68A', fontWeight: 600 }}>IF</span>
                <span style={{ fontSize: 11, color: '#7DD3FC' }}>{rule.condition}</span>
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#059669' }}>ROUTE →</span>
                <span style={{ fontSize: 12, color: '#374151' }}>{rule.route}</span>
                {rule.priority && <span style={{ fontSize: 9, background: rule.priority === 'High' ? '#FEF2F2' : '#F1F5F9', color: rule.priority === 'High' ? '#DC2626' : '#64748B', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>{rule.priority}</span>}
              </div>
            </div>
          ))}
        </DocSection>
      )}
      {data.exceptionHandling?.length > 0 && (
        <DocSection title="Exception Handling">
          <DocTable columns={['Scenario', 'Action', 'Notifies']} rows={data.exceptionHandling.map(e => ({ Scenario: e.scenario, Action: e.action, Notifies: e.notifies || '—' }))}/>
        </DocSection>
      )}
    </div>
  )
}

// ── Audit Trail Design ────────────────────────────────────────────────────────
function AuditTrailContent({ data }) {
  if (!data) return null
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 20 }}>Audit Trail Design</div>
      {data.eventsLogged?.length > 0 && (
        <DocSection title="Logged Events"><TagList items={data.eventsLogged} accent="#6D28D9" bg="#F5F3FF"/></DocSection>
      )}
      {data.logFields?.length > 0 && (
        <DocSection title="Log Fields"><TagList items={data.logFields} accent="#0E7490" bg="#ECFEFF"/></DocSection>
      )}
      {data.retentionPolicy && (
        <DocSection title="Retention Policy">
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#1D4ED8' }}>{data.retentionPolicy}</div>
        </DocSection>
      )}
      {data.accessControl && (
        <DocSection title="Access Control"><p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{data.accessControl}</p></DocSection>
      )}
    </div>
  )
}

// ── ERP / HRIS Integration ────────────────────────────────────────────────────
function SystemIntegrationContent({ data }) {
  if (!data) return null
  // handle both erpIntegration and hrisIntegration shapes
  const system = data.system || data.name || 'External System'
  const syncedFields = data.syncedFields || data.syncFields || []
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '24px 28px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>System Integration</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#4F46E5', marginBottom: 20 }}>{system}</div>
      {data.direction && <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>Direction: <strong>{data.direction}</strong></div>}
      {data.frequency && <div style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>Sync Frequency: <strong>{data.frequency}</strong></div>}
      {syncedFields.length > 0 && (
        <DocSection title="Synced Fields"><TagList items={syncedFields} accent="#4F46E5" bg="#EEF2FF"/></DocSection>
      )}
      {data.authMethod && <div style={{ fontSize: 12, color: '#64748B' }}>Auth: {data.authMethod}</div>}
      {data.failureHandling && (
        <DocSection title="Failure Handling">
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#7F1D1D' }}>{data.failureHandling}</div>
        </DocSection>
      )}
    </div>
  )
}

// ─── Stage definition ─────────────────────────────────────────────────────────
// ─── Full stage catalogue ─────────────────────────────────────────────────────
const ALL_STAGE_DEFS = [
  // Core (always)
  { id: 'intakeSummary',          label: 'Intake Summary',                  sublabel: 'What Aria understood',                            component: IntakeSummaryContent,         group: 'core' },
  { id: 'problemStatement',       label: 'Problem Statement',               sublabel: 'Root cause, impact, and proposed solution',       component: ProblemStatementContent,      group: 'core' },
  { id: 'productBrief',           label: 'Product Brief',                   sublabel: 'Objectives, roles, workflows, rules',             component: ProductBriefContent,          group: 'core' },
  { id: 'prd',                    label: 'Product Requirements (PRD)',       sublabel: 'Goals, personas, requirements, risks',            component: PRDContent,                   group: 'core' },
  { id: 'userStories',            label: 'User Stories & AC',               sublabel: 'Epics, stories, acceptance criteria',             component: UserStoriesContent,           group: 'core' },
  { id: 'workflowMap',            label: 'Workflow Map',                    sublabel: 'Process steps, decisions, exceptions',            component: WorkflowMapContent,           group: 'core' },
  { id: 'dataModel',              label: 'Data Model',                      sublabel: 'Entities, fields, statuses, relationships',       component: DataModelContent,             group: 'core' },
  { id: 'automationModel',        label: 'Automation Model',                sublabel: 'Triggers, notifications, escalations, integrations', component: AutomationModelContent,    group: 'core' },
  { id: 'uxRecommendation',       label: 'UX Recommendation',               sublabel: 'Layout, screens, visual direction',               component: UXRecommendationContent,      group: 'core' },
  { id: 'successMetrics',         label: 'Success Metrics & KPIs',          sublabel: 'Primary KPIs, measurement cadence, thresholds',   component: SuccessMetricsContent,        group: 'core' },
  { id: 'qaTestPlan',             label: 'QA & Test Plan',                  sublabel: 'Test cases, exit criteria, defect management',    component: QATestPlanContent,            group: 'core' },
  // Enterprise add-ons
  { id: 'businessCase',           label: 'Business Case',                   sublabel: 'Investment rationale and strategic alignment',     component: BusinessCaseContent,          group: 'enterprise' },
  { id: 'costBreakdown',          label: 'Cost Breakdown',                  sublabel: 'CapEx, OpEx, and line-item cost plan',             component: CostBreakdownContent,         group: 'enterprise' },
  { id: 'roiAnalysis',            label: 'ROI & Savings Analysis',          sublabel: 'Net benefit, payback period, sensitivity',        component: ROIAnalysisContent,           group: 'enterprise' },
  { id: 'legalCompliance',        label: 'Legal & Compliance',              sublabel: 'Regulations, checklist, required approvals',      component: LegalComplianceContent,       group: 'enterprise' },
  { id: 'dataSecurity',           label: 'Data Privacy & Security',         sublabel: 'Data inventory, access controls, encryption',     component: DataSecurityContent,          group: 'enterprise' },
  { id: 'permissionsMatrix',      label: 'Permissions Matrix',              sublabel: 'Role-based access across features and data',      component: PermissionsMatrixContent,     group: 'enterprise' },
  { id: 'stakeholderSignoff',     label: 'Stakeholder Sign-off',            sublabel: 'Approval workflow and signature block',           component: StakeholderSignoffContent,    group: 'enterprise' },
  // Full lifecycle add-ons
  { id: 'technicalArchitecture',  label: 'Technical Architecture',          sublabel: 'Components, data flow, infrastructure',           component: TechnicalArchitectureContent, group: 'full_lifecycle' },
  { id: 'integrationSpec',        label: 'Integration Spec',                sublabel: 'API endpoints, data mapping, error handling',     component: IntegrationSpecContent,       group: 'full_lifecycle' },
  { id: 'currentStateWorkflow',   label: 'Current State Workflow (As-Is)',  sublabel: 'Current process, tools, and pain points',         component: (p) => <WorkflowDeltaContent {...p} variant="current"/>, group: 'full_lifecycle' },
  { id: 'futureStateWorkflow',    label: 'Future State Workflow (To-Be)',   sublabel: 'New process, automations, and improvements',      component: (p) => <WorkflowDeltaContent {...p} variant="future"/>, group: 'full_lifecycle' },
  { id: 'launchPlan',             label: 'Launch & Rollout Plan',           sublabel: 'Milestones, comms, training, go-live checklist',  component: LaunchPlanContent,            group: 'full_lifecycle' },
  // App spec (non-PM, always present)
  { id: 'appSpec',                label: 'App Spec',                        sublabel: 'Implementation-ready specification',               component: AppSpecContent,               group: 'core' },
]

// Non-PM flow uses just the original 7 stages
const STAGES_CLASSIC = ALL_STAGE_DEFS.filter(s =>
  ['intakeSummary', 'productBrief', 'workflowMap', 'dataModel', 'automationModel', 'uxRecommendation', 'appSpec'].includes(s.id)
)

// ── Role-specific stage sets ──────────────────────────────────────────────────
const _s = id => ALL_STAGE_DEFS.find(s => s.id === id)

// Document-only roles — no appSpec
const STAGES_OPERATIONS = [
  _s('intakeSummary'),
  { id: 'processAnalysis',    label: 'Process Analysis',    sublabel: 'Current state, pain points, automation opportunities', component: ProcessAnalysisContent,    group: 'core' },
  _s('workflowMap'),
  { id: 'sop',                label: 'SOP Document',        sublabel: 'Numbered procedure, roles, exception handling',        component: SOPContent,                group: 'core' },
  { id: 'escalationMatrix',   label: 'Escalation Matrix',   sublabel: 'Escalation levels, delegation rules, cost centers',    component: EscalationMatrixContent,   group: 'core' },
  _s('automationModel'),
  { id: 'systemIntegration',  label: 'System Integration',  sublabel: 'Connected systems, sync frequency, failure handling',  component: SystemIntegrationContent,  group: 'core' },
  _s('dataModel'),
].filter(Boolean)

// IT Admin produces systems/technical docs + app/system spec
const STAGES_IT_ADMIN = [
  _s('intakeSummary'),
  { id: 'architectureDoc',    label: 'Architecture Document', sublabel: 'Components, data flow, security model, deployment',  component: ArchitectureDocContent,    group: 'core' },
  _s('permissionsMatrix'),
  { id: 'systemIntegration',  label: 'System Integration',    sublabel: 'Connected systems, sync frequency, failure handling', component: SystemIntegrationContent,  group: 'core' },
  _s('workflowMap'),
  { id: 'runbook',            label: 'Deployment Runbook',    sublabel: 'Prerequisites, phased steps, verify blocks, rollback', component: RunbookContent,            group: 'core' },
  _s('dataModel'),
  _s('appSpec'),
].filter(Boolean)

// Document-only roles — no appSpec
const STAGES_COMPLIANCE = [
  _s('intakeSummary'),
  { id: 'controlsFramework',  label: 'Controls Framework',   sublabel: 'Control register, categories, owners, risk ratings',  component: ControlsFrameworkContent,  group: 'core' },
  { id: 'riskMatrix',         label: 'Risk Matrix',          sublabel: 'Risk register with likelihood, impact, controls',     component: RiskMatrixContent,         group: 'core' },
  _s('workflowMap'),
  { id: 'auditTrail',         label: 'Audit Trail Design',   sublabel: 'Logged events, retention policy, access control',     component: AuditTrailContent,         group: 'core' },
  _s('permissionsMatrix'),
  _s('dataModel'),
].filter(Boolean)

const STAGES_FINANCE = [
  _s('intakeSummary'),
  { id: 'routingLogic',       label: 'Routing Logic',        sublabel: 'IF/ROUTE rules, exception handling table',            component: RoutingLogicContent,       group: 'core' },
  _s('workflowMap'),
  { id: 'financialControls',  label: 'Financial Controls',   sublabel: 'Controls, audit requirements, segregation of duties', component: FinancialControlsContent,  group: 'core' },
  { id: 'systemIntegration',  label: 'ERP Integration',      sublabel: 'ERP/system connections, sync frequency, fields',      component: SystemIntegrationContent,  group: 'core' },
  _s('dataModel'),
].filter(Boolean)

const STAGES_HR = [
  _s('intakeSummary'),
  { id: 'employeeJourneyMap', label: 'Employee Journey Map', sublabel: 'Phase timeline, actors, activities, touchpoints',     component: JourneyMapContent,         group: 'core' },
  { id: 'policyDocumentation',label: 'Policy Documentation', sublabel: 'Per-policy cards, eligibility, limitations, approvals', component: PolicyContent,             group: 'core' },
  _s('workflowMap'),
  { id: 'notificationPlan',   label: 'Notification Plan',    sublabel: 'Notification rules, channels, timing, messages',     component: NotificationPlanContent,   group: 'core' },
  _s('permissionsMatrix'),
  { id: 'systemIntegration',  label: 'HRIS Integration',     sublabel: 'HRIS/system connections, sync frequency, fields',     component: SystemIntegrationContent,  group: 'core' },
  _s('dataModel'),
].filter(Boolean)

function getStages(brief, pmPackage, buildMode) {
  if (buildMode === 'operations') return STAGES_OPERATIONS.filter(s => brief?.[s.id] !== undefined && brief?.[s.id] !== null)
  if (buildMode === 'it_admin')   return STAGES_IT_ADMIN.filter(s => brief?.[s.id] !== undefined && brief?.[s.id] !== null)
  if (buildMode === 'compliance') return STAGES_COMPLIANCE.filter(s => brief?.[s.id] !== undefined && brief?.[s.id] !== null)
  if (buildMode === 'finance')    return STAGES_FINANCE.filter(s => brief?.[s.id] !== undefined && brief?.[s.id] !== null)
  if (buildMode === 'hr')         return STAGES_HR.filter(s => brief?.[s.id] !== undefined && brief?.[s.id] !== null)
  if (buildMode !== 'product_manager') return STAGES_CLASSIC
  const pkg = pmPackage || 'lean'
  // Groups to include based on package
  const include = new Set(['core'])
  if (['enterprise', 'full_lifecycle', 'custom'].includes(pkg)) include.add('enterprise')
  if (pkg === 'full_lifecycle') include.add('full_lifecycle')
  return ALL_STAGE_DEFS.filter(s => {
    if (!include.has(s.group)) return false
    // Only include stages that have actual data
    const d = brief?.[s.id]
    return d !== null && d !== undefined
  })
}

// ─── Format labels for download buttons ──────────────────────────────────────
const STAGE_FORMATS = {
  intakeSummary:          ['pdf', 'docx'],
  problemStatement:       ['pdf', 'docx'],
  productBrief:           ['pdf', 'docx'],
  prd:                    ['pdf', 'docx'],
  userStories:            ['pdf', 'docx'],
  workflowMap:            ['pdf', 'md'],
  dataModel:              ['xlsx', 'csv', 'json'],
  automationModel:        ['pdf', 'json'],
  uxRecommendation:       ['pdf', 'docx'],
  successMetrics:         ['xlsx', 'pdf'],
  qaTestPlan:             ['pdf', 'xlsx'],
  businessCase:           ['pdf', 'docx'],
  costBreakdown:          ['xlsx', 'pdf'],
  roiAnalysis:            ['xlsx', 'pdf'],
  legalCompliance:        ['pdf', 'docx'],
  dataSecurity:           ['pdf', 'docx'],
  permissionsMatrix:      ['xlsx', 'pdf'],
  stakeholderSignoff:     ['pdf', 'docx'],
  technicalArchitecture:  ['pdf', 'docx'],
  integrationSpec:        ['pdf', 'docx', 'json'],
  currentStateWorkflow:   ['pdf', 'docx'],
  futureStateWorkflow:    ['pdf', 'docx'],
  launchPlan:             ['pdf', 'docx', 'xlsx'],
  appSpec:                ['pdf', 'docx', 'xlsx'],
  // Operations
  processAnalysis:        ['pdf', 'docx'],
  sop:                    ['pdf', 'docx'],
  escalationMatrix:       ['xlsx', 'pdf'],
  systemIntegration:      ['pdf', 'docx', 'json'],
  // IT Admin
  architectureDoc:        ['pdf', 'docx'],
  runbook:                ['pdf', 'docx'],
  // Compliance
  controlsFramework:      ['xlsx', 'pdf'],
  riskMatrix:             ['xlsx', 'pdf'],
  auditTrail:             ['pdf', 'docx'],
  // Finance
  routingLogic:           ['pdf', 'docx'],
  financialControls:      ['xlsx', 'pdf'],
  // HR
  employeeJourneyMap:     ['pdf', 'docx'],
  policyDocumentation:    ['pdf', 'docx'],
  notificationPlan:       ['xlsx', 'pdf'],
}
const FMT = { pdf: 'PDF', docx: 'Word', xlsx: 'Excel', csv: 'CSV', json: 'JSON', md: 'Markdown' }
const FMT_ICON = { pdf: '📄', docx: '📝', xlsx: '📊', csv: '📋', json: '{ }', md: '#' }

// ─── Client-side export engine ───────────────────────────────────────────────

// ── helpers ──────────────────────────────────────────────────────────────────
function slugify(s) { return (s || 'document').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) }

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ── PDF via html2canvas + jsPDF ───────────────────────────────────────────────
async function exportPDF(domNode, title) {
  // Temporarily remove scroll constraints so html2canvas captures full content
  const origMaxHeight = domNode.style.maxHeight
  const origOverflow = domNode.style.overflow
  domNode.style.maxHeight = 'none'
  domNode.style.overflow = 'visible'
  await new Promise(r => setTimeout(r, 60)) // let browser re-layout

  const canvas = await html2canvas(domNode, {
    scale: 2, useCORS: true, backgroundColor: '#ffffff',
    height: domNode.scrollHeight,
    width: domNode.scrollWidth,
    windowHeight: domNode.scrollHeight,
  })

  // Restore original styles
  domNode.style.maxHeight = origMaxHeight
  domNode.style.overflow = origOverflow

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgW = pageW
  const imgH = (canvas.height / canvas.width) * imgW

  let heightLeft = imgH
  let position = 0
  pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH)
  heightLeft -= pageH
  while (heightLeft > 0) {
    position -= pageH
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH)
    heightLeft -= pageH
  }
  pdf.save(`${slugify(title)}.pdf`)
}

// ── JSON ─────────────────────────────────────────────────────────────────────
function exportJSON(data, title) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `${slugify(title)}.json`)
}

// ── Markdown ──────────────────────────────────────────────────────────────────
function dataToMarkdown(stageId, data, title) {
  const lines = [`# ${title}`, '', `_Generated by Aria — ${new Date().toLocaleDateString()}_`, '', '---', '']
  function item(label, val) { if (val) lines.push(`**${label}:** ${val}`, '') }
  function list(label, arr) {
    if (!arr?.length) return
    lines.push(`## ${label}`, '')
    arr.forEach(v => lines.push(typeof v === 'string' ? `- ${v}` : `- ${JSON.stringify(v)}`))
    lines.push('')
  }

  if (stageId === 'workflowMap') {
    item('Trigger', data.trigger)
    lines.push('## Steps', '')
    ;(data.steps || []).forEach((s, i) => {
      lines.push(`### Step ${i + 1}: ${s.step}`)
      lines.push(`- **Actor:** ${s.actor || '—'}`)
      lines.push(`- **Action:** ${s.action || '—'}`)
      lines.push(`- **Output:** ${s.output || '—'}`)
      if (s.sla) lines.push(`- **SLA:** ${s.sla}`)
      lines.push('')
    })
    list('Decision Points', data.decisionPoints)
    list('Exception Paths', data.exceptionPaths)
  } else if (stageId === 'automationModel') {
    lines.push('## Logic Rules', '')
    ;(data.triggers || []).forEach((t, i) => {
      lines.push(`### Rule ${i + 1}`)
      lines.push(`- **Event:** ${t.event}`)
      lines.push(`- **If:** ${t.condition}`)
      lines.push(`- **Then:** ${t.action}`)
      lines.push('')
    })
    list('Notifications', (data.notifications || []).map(n => `${n.event} → ${n.recipient} via ${n.channel}`))
    list('Escalations', (data.escalations || []).map(e => `${e.condition} → ${e.action}`))
    list('Integrations', (data.integrations || []).map(i => `${i.system} (${i.type}): ${i.purpose}`))
  } else {
    function walk(obj, depth = 0) {
      if (!obj || typeof obj !== 'object') return
      Object.entries(obj).forEach(([k, v]) => {
        const h = '#'.repeat(Math.min(depth + 2, 6))
        if (Array.isArray(v)) list(k, v.map(x => typeof x === 'string' ? x : JSON.stringify(x)))
        else if (typeof v === 'object' && v) { lines.push(`${h} ${k}`, ''); walk(v, depth + 1) }
        else item(k, v)
      })
    }
    walk(data)
  }
  return lines.join('\n')
  const blob = new Blob([md], { type: 'text/markdown' })
  triggerDownload(blob, `${slugify(title)}.md`)
}

// ── CSV ───────────────────────────────────────────────────────────────────────
function exportCSV(stageId, data, title) {
  let rows = []
  if (stageId === 'dataModel') {
    rows = [['Field Name','Label','Type','Required','Options'], ...(data.fields || []).map(f => [f.name, f.label, f.type, f.required ? 'Yes' : 'No', (f.options || []).join('|')])]
  } else if (stageId === 'appSpec') {
    rows = [['Field','Label','Type','Required'], ...(data.fields || []).map(f => [f.name, f.label, f.type, f.required ? 'Yes' : 'No'])]
  } else {
    rows = [['Key', 'Value'], ...Object.entries(data || {}).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])]
  }
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  triggerDownload(blob, `${slugify(title)}.csv`)
}

// ── XLSX ──────────────────────────────────────────────────────────────────────
function exportXLSX(stageId, data, title) {
  const wb = XLSX.utils.book_new()

  if (stageId === 'dataModel') {
    const rows = [['Field Name','Label','Type','Required','Options'],
      ...(data.fields || []).map(f => [f.name, f.label, f.type, f.required ? 'Yes' : 'No', (f.options || []).join(', ')])]
    if (data.statusFlow?.length) { rows.push([], ['Status Flow'], data.statusFlow) }
    if (data.relationships?.length) { rows.push([], ['Relationships'], ...data.relationships.map(r => [r])) }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Data Model')
  } else if (stageId === 'appSpec') {
    const fields = [['Field','Label','Type','Required'], ...(data.fields || []).map(f => [f.name, f.label, f.type, f.required ? 'Yes' : 'No'])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fields), 'Fields')
    const features = [['#','Feature'], ...(data.features || []).map((f, i) => [i + 1, f])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(features), 'Features')
    const overview = [['Property','Value'], ['App Title', data.appTitle], ['App Type', data.appType], ['Layout', data.layoutType], ['Workflow Type', data.workflowType], ['Primary Action', data.primaryActionLabel]]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overview), 'Overview')
  } else {
    const rows = [['Key', 'Value'], ...Object.entries(data || {}).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Data')
  }

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  triggerDownload(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${slugify(title)}.xlsx`)
}

// ── DOCX ──────────────────────────────────────────────────────────────────────
async function exportDOCX(stageId, data, title) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const h1 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } })
  const h2 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } })
  const p  = t => new Paragraph({ children: [new TextRun({ text: t || '', size: 24 })], spacing: { after: 120 } })
  const bold = (label, val) => new Paragraph({ children: [new TextRun({ text: label + ': ', bold: true, size: 24 }), new TextRun({ text: val || '—', size: 24 })], spacing: { after: 80 } })
  const li = t => new Paragraph({ text: '• ' + t, spacing: { after: 60 }, indent: { left: 360 } })
  const hr = () => new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB' } }, spacing: { after: 200 } })

  const makeTable = (headers, rows) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map(h => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 22 })], alignment: AlignmentType.LEFT })], shading: { fill: '1C3557' } })) }),
      ...rows.map((row, ri) => new TableRow({ children: row.map(cell => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(cell ?? '—'), size: 22 })], alignment: AlignmentType.LEFT })], shading: { fill: ri % 2 === 0 ? 'F9FAFB' : 'FFFFFF' } })) }))
    ]
  })

  const children = []

  // Header
  children.push(new Paragraph({ children: [new TextRun({ text: '[Company Name]', bold: true, size: 28 })], spacing: { after: 40 } }))
  children.push(new Paragraph({ children: [new TextRun({ text: `${title}  |  ${today}  |  CONFIDENTIAL`, size: 20, color: '6B7280' })], spacing: { after: 200 } }))
  children.push(hr())
  children.push(h1(title))

  if (stageId === 'intakeSummary') {
    children.push(h2('Executive Summary')); children.push(p(data.understood))
    children.push(h2('Business Problem')); children.push(p(data.businessProblem))
    children.push(h2('Primary Users')); (data.primaryUsers || []).forEach(u => children.push(li(u)))
    if (data.secondaryUsers?.length) { children.push(h2('Secondary Users')); data.secondaryUsers.forEach(u => children.push(li(u))) }
    children.push(h2('Current Process')); children.push(p(data.currentProcess))
    children.push(h2('Expected Outcome')); children.push(p(data.mainOutcome))
  } else if (stageId === 'productBrief') {
    children.push(h2('Objective')); children.push(p(data.objective))
    if (data.userRoles?.length) { children.push(h2('User Roles')); children.push(makeTable(['Role','Access Level','Est. Users'], data.userRoles.map(r => [r.role, r.access, r.estimated || '—']))) }
    if (data.coreWorkflows?.length) { children.push(h2('Core Workflows')); data.coreWorkflows.forEach((w, i) => children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}.  `, bold: true, size: 24 }), new TextRun({ text: w, size: 24 })], spacing: { after: 80 } }))) }
    if (data.businessRules?.length) { children.push(h2('Business Rules')); data.businessRules.forEach((r, i) => children.push(bold(`BR-${String(i+1).padStart(2,'0')}`, r))) }
    if (data.successCriteria?.length) { children.push(h2('Success Criteria')); data.successCriteria.forEach(s => children.push(li(s))) }
    if (data.openQuestions?.length) { children.push(h2('Open Questions')); data.openQuestions.forEach((q, i) => children.push(bold(`OQ-${String(i+1).padStart(2,'0')}`, q))) }
  } else if (stageId === 'workflowMap') {
    children.push(h2('Trigger')); children.push(p(data.trigger))
    children.push(h2('Steps'))
    if (data.steps?.length) children.push(makeTable(['#','Step','Actor','Action','Output','SLA'], data.steps.map((s, i) => [i+1, s.step, s.actor, s.action, s.output, s.sla || '—'])))
    if (data.decisionPoints?.length) { children.push(h2('Decision Points')); data.decisionPoints.forEach(d => children.push(li(d))) }
    if (data.exceptionPaths?.length) { children.push(h2('Exception Paths')); data.exceptionPaths.forEach(e => children.push(li(e))) }
  } else if (stageId === 'dataModel') {
    children.push(h2(`Entity: ${data.primaryEntity}`))
    if (data.fields?.length) children.push(makeTable(['Field','Label','Type','Required','Options'], data.fields.map(f => [f.name, f.label, f.type, f.required ? 'Yes' : 'No', (f.options||[]).join(', ')])))
    if (data.statusFlow?.length) { children.push(h2('Status Flow')); children.push(p(data.statusFlow.join(' → '))) }
    if (data.relationships?.length) { children.push(h2('Relationships')); data.relationships.forEach(r => children.push(li(r))) }
  } else if (stageId === 'automationModel') {
    if (data.triggers?.length) {
      children.push(h2('Logic Rules'))
      data.triggers.forEach((t, i) => { children.push(bold(`Rule ${i+1} — WHEN`, t.event)); children.push(bold('IF', t.condition)); children.push(bold('THEN', t.action)); if (t.output) children.push(bold('OUTPUT', t.output)); children.push(p('')) })
    }
    if (data.notifications?.length) { children.push(h2('Notifications')); children.push(makeTable(['Event','Recipient','Channel','Message'], data.notifications.map(n => [n.event, n.recipient, n.channel, n.template || n.message]))) }
    if (data.escalations?.length) { children.push(h2('Escalations')); children.push(makeTable(['Condition','Action','Escalate To'], data.escalations.map(e => [e.condition, e.action, e.recipient]))) }
    if (data.integrations?.length) { children.push(h2('Integrations')); children.push(makeTable(['System','Type','Purpose'], data.integrations.map(i => [i.system, i.type, i.purpose]))) }
  } else if (stageId === 'appSpec') {
    children.push(p(data.purpose))
    children.push(h2('App Classification')); children.push(makeTable(['Property','Value'], [['App Type', data.appType],['Layout', data.layoutType],['Workflow Type', data.workflowType],['Primary Action', data.primaryActionLabel]].filter(([,v])=>v)))
    if (data.features?.length) { children.push(h2('Features')); data.features.forEach((f, i) => children.push(bold(`F-${String(i+1).padStart(2,'0')}`, f))) }
    if (data.fields?.length) { children.push(h2('Data Schema')); children.push(makeTable(['Field','Label','Type','Required'], data.fields.map(f => [f.name, f.label, f.type, f.required ? 'Yes' : 'No']))) }
    if (data.statusFlow?.length) { children.push(h2('Status Workflow')); children.push(p(data.statusFlow.join(' → '))) }
  } else if (stageId === 'problemStatement') {
    children.push(h2('Current State')); children.push(p(data.currentState))
    if (data.painPoints?.length) { children.push(h2('Pain Points')); data.painPoints.forEach(pt => children.push(li(pt))) }
    if (data.rootCauses?.length) { children.push(h2('Root Causes')); data.rootCauses.forEach(r => children.push(li(r))) }
    children.push(h2('Business Impact')); children.push(p(`Impacted: ${(data.impactedUsers||[]).join(', ')}`)); children.push(p(data.businessImpact))
    children.push(h2('Proposed Solution')); children.push(p(data.proposedSolution))
    if (data.outOfScope?.length) { children.push(h2('Out of Scope')); data.outOfScope.forEach(s => children.push(li(s))) }
  } else if (stageId === 'prd') {
    children.push(p(`Version ${data.version || '1.0'} — ${data.status || 'Draft'}`))
    children.push(h2('Overview')); children.push(p(data.overview))
    if (data.goals?.length) { children.push(h2('Goals')); data.goals.forEach(g => children.push(li(g))) }
    if (data.nonGoals?.length) { children.push(h2('Non-Goals')); data.nonGoals.forEach(g => children.push(li(g))) }
    if (data.userPersonas?.length) { children.push(h2('User Personas')); children.push(makeTable(['Persona','Role','Needs','Pain Points'], data.userPersonas.map(p => [p.name, p.role, p.needs, p.painPoints]))) }
    if (data.functionalRequirements?.length) { children.push(h2('Functional Requirements')); children.push(makeTable(['ID','Category','Requirement','Priority'], data.functionalRequirements.map(r => [r.id, r.category, r.requirement, r.priority]))) }
    if (data.nonFunctionalRequirements?.length) { children.push(h2('Non-Functional Requirements')); children.push(makeTable(['ID','Category','Requirement'], data.nonFunctionalRequirements.map(r => [r.id, r.category, r.requirement]))) }
    if (data.risksAndMitigations?.length) { children.push(h2('Risks & Mitigations')); children.push(makeTable(['Risk','Mitigation','Likelihood'], data.risksAndMitigations.map(r => [r.risk, r.mitigation, r.likelihood]))) }
  } else if (stageId === 'userStories') {
    ;(data.epics || []).forEach(epic => {
      children.push(h2(`Epic ${epic.id}: ${epic.title}`))
      ;(epic.stories || []).forEach(s => {
        children.push(bold(s.id, `[${s.priority}] ${s.title}`))
        children.push(p(`As a ${s.asA}, I want ${s.iWant}, so that ${s.soThat}.`))
        if (s.acceptanceCriteria?.length) { children.push(p('Acceptance Criteria:')); s.acceptanceCriteria.forEach(ac => children.push(li(ac))) }
        children.push(p(''))
      })
    })
  } else if (stageId === 'successMetrics') {
    if (data.primaryKPIs?.length) { children.push(h2('Primary KPIs')); children.push(makeTable(['Metric','Baseline','Target','Timeline','Measurement'], data.primaryKPIs.map(k => [k.metric, k.baseline, k.target, k.timeline, k.measurement]))) }
    if (data.secondaryMetrics?.length) { children.push(h2('Secondary Metrics')); children.push(makeTable(['Metric','Target','Measurement'], data.secondaryMetrics.map(m => [m.metric, m.target, m.measurement]))) }
    if (data.successThreshold) { children.push(h2('Success Threshold')); children.push(p(data.successThreshold)) }
  } else if (stageId === 'qaTestPlan') {
    children.push(h2('Scope')); children.push(p(data.scope))
    children.push(h2('Test Approach')); children.push(p(data.testApproach))
    if (data.testCases?.length) { children.push(h2('Test Cases')); children.push(makeTable(['ID','Module','Test Case','Expected Result','Priority'], data.testCases.map(tc => [tc.id, tc.module, tc.testCase, tc.expectedResult, tc.priority]))) }
    if (data.exitCriteria?.length) { children.push(h2('Exit Criteria')); data.exitCriteria.forEach(e => children.push(li(e))) }
  } else if (stageId === 'businessCase') {
    children.push(h2('Executive Summary')); children.push(p(data.executiveSummary))
    if (data.financialSummary) { children.push(h2('Financial Summary')); children.push(makeTable(['Metric','Value'], [['Investment Required', data.financialSummary.investmentRequired],['Expected Savings', data.financialSummary.expectedSavings],['Payback Period', data.financialSummary.paybackPeriod],['ROI', data.financialSummary.roi]])) }
    if (data.benefits?.length) { children.push(h2('Benefits')); children.push(makeTable(['Type','Benefit','Value'], data.benefits.map(b => [b.type, b.benefit, b.value]))) }
    if (data.alternatives?.length) { children.push(h2('Alternatives Considered')); children.push(makeTable(['Alternative','Reason Rejected'], data.alternatives.map(a => [a.option, a.reason]))) }
    children.push(h2('Recommendation')); children.push(p(data.recommendation))
  } else if (stageId === 'costBreakdown') {
    ;(data.categories || []).forEach(cat => {
      children.push(h2(cat.category))
      children.push(makeTable(['Item','Description','Unit','Qty','Unit Cost','Total'], (cat.items || []).map(i => [i.item, i.description, i.unit, i.quantity, i.unitCost, i.total])))
    })
    children.push(h2('Summary')); children.push(makeTable(['','Amount'], [['CapEx', data.totalCapex], ['OpEx', data.totalOpex], ['Grand Total', data.grandTotal]]))
    if (data.assumptions?.length) { children.push(h2('Assumptions')); data.assumptions.forEach(a => children.push(li(a))) }
  } else if (stageId === 'roiAnalysis') {
    children.push(makeTable(['Metric','Value'], [['Timeframe', data.timeframe],['Net Benefit', data.netBenefit],['ROI', data.roi],['Payback Period', data.paybackPeriod]]))
    if (data.currentCosts?.length) { children.push(h2('Current Costs')); children.push(makeTable(['Item','Annual Cost','Description'], data.currentCosts.map(c => [c.item, c.annualCost, c.description]))) }
    if (data.projectedSavings?.length) { children.push(h2('Projected Savings')); children.push(makeTable(['Item','Annual Saving','Confidence','Description'], data.projectedSavings.map(s => [s.item, s.annualSaving, s.confidence, s.description]))) }
    if (data.sensitivity?.length) { children.push(h2('Sensitivity Analysis')); children.push(makeTable(['Scenario','ROI','Payback'], data.sensitivity.map(s => [s.scenario, s.roi, s.payback]))) }
  } else if (stageId === 'legalCompliance') {
    children.push(p(`Data Classification: ${data.dataClassification || 'Internal'}`))
    if (data.applicableRegulations?.length) { children.push(h2('Applicable Regulations')); children.push(makeTable(['Regulation','Applicability'], data.applicableRegulations.map(r => [r.regulation, r.applicability]))) }
    if (data.complianceChecklist?.length) { children.push(h2('Compliance Checklist')); children.push(makeTable(['Item','Status','Owner'], data.complianceChecklist.map(c => [c.item, c.status, c.owner]))) }
    if (data.privacyConsiderations?.length) { children.push(h2('Privacy Considerations')); data.privacyConsiderations.forEach(p2 => children.push(li(p2))) }
  } else if (stageId === 'dataSecurity') {
    if (data.dataInventory?.length) { children.push(h2('Data Inventory')); children.push(makeTable(['Data Type','Sensitivity','Storage','Access'], data.dataInventory.map(d => [d.dataType, d.sensitivity, d.storage, d.access]))) }
    if (data.accessControls?.length) { children.push(h2('Access Controls')); children.push(makeTable(['Role','Permissions','Restrictions'], data.accessControls.map(a => [a.role, (a.permissions||[]).join(', '), a.restrictions]))) }
    if (data.encryptionRequirements?.length) { children.push(h2('Encryption Requirements')); data.encryptionRequirements.forEach(e => children.push(li(e))) }
  } else if (stageId === 'permissionsMatrix') {
    if (data.roles?.length) { children.push(h2('Roles')); children.push(makeTable(['Role','Description','User Count'], data.roles.map(r => [r.role, r.description, r.userCount || '—']))) }
    if (data.features?.length) {
      const roleNames = (data.roles || []).map(r => r.role)
      children.push(h2('Feature Permissions'))
      children.push(makeTable(['Feature', ...roleNames], data.features.map(f => [f.feature, ...roleNames.map(r => String(f.permissions[r] ?? '—'))])))
    }
  } else if (stageId === 'technicalArchitecture') {
    children.push(h2('Overview')); children.push(p(data.overview))
    if (data.components?.length) { children.push(h2('Components')); children.push(makeTable(['Component','Type','Description','Technology'], data.components.map(c => [c.name, c.type, c.description, c.technology]))) }
    if (data.infrastructure) children.push(makeTable(['Property','Value'], Object.entries(data.infrastructure).map(([k, v]) => [k, v])))
  } else if (stageId === 'integrationSpec') {
    ;(data.integrations || []).forEach(int => {
      children.push(h2(`${int.id}: ${int.system}`))
      children.push(p(`${int.direction} · ${int.type} · ${int.frequency}`))
      children.push(p(int.purpose))
      if (int.endpoints?.length) children.push(makeTable(['Method','Endpoint','Description','Auth'], int.endpoints.map(ep => [ep.method, ep.endpoint, ep.description, ep.authentication])))
      children.push(p(''))
    })
  } else if (stageId === 'currentStateWorkflow' || stageId === 'futureStateWorkflow') {
    children.push(p(data.description))
    if (data.steps?.length) children.push(makeTable(['#','Actor','Action','Tool', stageId === 'currentStateWorkflow' ? 'Pain Point' : 'Improvement'], data.steps.map(s => [s.step, s.actor, s.action, s.tool, stageId === 'currentStateWorkflow' ? s.painPoint : s.improvement])))
    if (stageId === 'currentStateWorkflow' && data.painPoints?.length) { children.push(h2('Process Pain Points')); data.painPoints.forEach(pt => children.push(li(pt))) }
    if (stageId === 'futureStateWorkflow' && data.improvements?.length) { children.push(h2('Key Improvements')); data.improvements.forEach(imp => children.push(li(imp))) }
  } else if (stageId === 'launchPlan') {
    if (data.timeline?.length) { children.push(h2('Milestones')); children.push(makeTable(['Milestone','Date','Owner','Status'], data.timeline.map(m => [m.milestone, m.date, m.owner, m.status]))) }
    if (data.communicationPlan?.length) { children.push(h2('Communication Plan')); children.push(makeTable(['Audience','Message','Channel','Timing'], data.communicationPlan.map(c => [c.audience, c.message, c.channel, c.timing]))) }
    if (data.goLiveChecklist?.length) { children.push(h2('Go-Live Checklist')); data.goLiveChecklist.forEach(item => children.push(li(item))) }
  } else if (stageId === 'stakeholderSignoff') {
    children.push(p(`Project: ${data.projectName} · Version ${data.version} · ${data.date}`))
    if (data.approvers?.length) { children.push(h2('Required Approvers')); children.push(makeTable(['Name/Role','Title','Department','Sign-off Scope','Status'], data.approvers.map(a => [a.name, a.title, a.department, a.signoffScope, a.status]))) }
    if (data.reviewers?.length) { children.push(h2('Reviewers (Advisory)')); children.push(makeTable(['Reviewer','Department','Review Scope'], data.reviewers.map(r => [r.name, r.department, r.reviewScope]))) }
    if (data.approvalNotes) { children.push(h2('Approval Notes')); children.push(p(data.approvalNotes)) }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] })
  const buf = await Packer.toBlob(doc)
  triggerDownload(buf, `${slugify(title)}.docx`)
}

// ─── Export dropdown ──────────────────────────────────────────────────────────
function ExportDropdown({ formats, stageId, activeData, contentRef, title }) {
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
    setLoading(l => ({ ...l, [fmt]: true }))
    setOpen(false)
    try {
      const label = title || stageId || 'document'
      if (fmt === 'pdf') {
        const node = contentRef?.current
        if (node) await exportPDF(node, label)
      } else if (fmt === 'docx') {
        await exportDOCX(stageId, activeData, label)
      } else if (fmt === 'xlsx') {
        exportXLSX(stageId, activeData, label)
      } else if (fmt === 'csv') {
        exportCSV(stageId, activeData, label)
      } else if (fmt === 'json') {
        exportJSON(activeData, label)
      } else if (fmt === 'md') {
        exportMarkdown(stageId, activeData, label)
      }
    } catch (err) {
      console.error('Export failed:', err)
      alert(`Export failed: ${err.message}`)
    } finally {
      setLoading(l => ({ ...l, [fmt]: false }))
    }
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
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', color: '#D4D4D4', fontSize: 12, cursor: loading[fmt] ? 'wait' : 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E1E1E'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span>{FMT_ICON[fmt]}</span>
              <span>{FMT[fmt]}</span>
              {loading[fmt]
                ? <span style={{ marginLeft: 'auto', fontSize: 10, color: '#525252' }}>...</span>
                : <span style={{ marginLeft: 'auto', fontSize: 9, color: '#525252' }}>↓</span>}
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

    case 'problemStatement':
      return [
        `Current State\n${data.currentState || ''}`,
        data.painPoints?.length ? `\nPain Points\n${list(data.painPoints)}` : '',
        data.rootCauses?.length ? `\nRoot Causes\n${list(data.rootCauses)}` : '',
        `\nBusiness Impact\n${data.businessImpact || ''}`,
        `\nImpacted Users\n${(data.impactedUsers || []).join(', ')}`,
        `\nProposed Solution\n${data.proposedSolution || ''}`,
        data.outOfScope?.length ? `\nOut of Scope\n${list(data.outOfScope)}` : '',
      ].filter(Boolean).join('\n')

    case 'prd':
      return [
        `Version ${data.version || '1.0'} — ${data.status || 'Draft'}`,
        `\nOverview\n${data.overview || ''}`,
        data.goals?.length ? `\nGoals\n${list(data.goals)}` : '',
        data.nonGoals?.length ? `\nNon-Goals\n${list(data.nonGoals)}` : '',
        data.functionalRequirements?.length ? `\nFunctional Requirements\n${data.functionalRequirements.map(r => `  • ${r.id} [${r.priority}] ${r.requirement}`).join('\n')}` : '',
        data.nonFunctionalRequirements?.length ? `\nNon-Functional Requirements\n${data.nonFunctionalRequirements.map(r => `  • ${r.id} — ${r.requirement}`).join('\n')}` : '',
        data.risksAndMitigations?.length ? `\nRisks & Mitigations\n${data.risksAndMitigations.map(r => `  • Risk: ${r.risk}\n    Mitigation: ${r.mitigation}`).join('\n')}` : '',
      ].filter(Boolean).join('\n')

    case 'userStories':
      return (data.epics || []).map(epic =>
        `Epic ${epic.id}: ${epic.title}\n` +
        (epic.stories || []).map(s =>
          `  ${s.id} [${s.priority}]: ${s.title}\n  As a ${s.asA}, I want ${s.iWant}, so that ${s.soThat}\n  AC: ${(s.acceptanceCriteria || []).join(' | ')}`
        ).join('\n')
      ).join('\n\n')

    case 'successMetrics':
      return [
        data.primaryKPIs?.length ? `Primary KPIs\n${data.primaryKPIs.map(k => `  • ${k.metric}: ${k.baseline} → ${k.target} by ${k.timeline}`).join('\n')}` : '',
        data.secondaryMetrics?.length ? `\nSecondary Metrics\n${data.secondaryMetrics.map(m => `  • ${m.metric}: ${m.target}`).join('\n')}` : '',
        data.successThreshold ? `\nSuccess Threshold\n${data.successThreshold}` : '',
        data.measurementCadence ? `\nMeasurement Cadence\n${data.measurementCadence}` : '',
      ].filter(Boolean).join('\n')

    case 'qaTestPlan':
      return [
        `Scope\n${data.scope || ''}`,
        `\nTest Approach\n${data.testApproach || ''}`,
        data.testCases?.length ? `\nTest Cases\n${data.testCases.map(tc => `  • ${tc.id} [${tc.priority}] ${tc.testCase}\n    Expected: ${tc.expectedResult}`).join('\n')}` : '',
        data.exitCriteria?.length ? `\nExit Criteria\n${list(data.exitCriteria)}` : '',
      ].filter(Boolean).join('\n')

    case 'businessCase':
      return [
        `Executive Summary\n${data.executiveSummary || ''}`,
        data.financialSummary ? `\nFinancial Summary\n  Investment: ${data.financialSummary.investmentRequired}\n  Savings: ${data.financialSummary.expectedSavings}\n  ROI: ${data.financialSummary.roi}\n  Payback: ${data.financialSummary.paybackPeriod}` : '',
        data.benefits?.length ? `\nBenefits\n${data.benefits.map(b => `  • [${b.type}] ${b.benefit}: ${b.value}`).join('\n')}` : '',
        data.recommendation ? `\nRecommendation\n${data.recommendation}` : '',
      ].filter(Boolean).join('\n')

    case 'costBreakdown':
      return [
        ...(data.categories || []).map(cat => `${cat.category}\n${(cat.items || []).map(i => `  • ${i.item}: ${i.quantity} × ${i.unitCost} = ${i.total}`).join('\n')}`),
        `\nGrand Total\n  ${data.currency || 'USD'} ${data.grandTotal?.toLocaleString?.() || data.grandTotal}`,
      ].join('\n')

    case 'roiAnalysis':
      return [
        `Timeframe: ${data.timeframe}`,
        data.roi ? `ROI: ${data.roi}` : '',
        data.paybackPeriod ? `Payback: ${data.paybackPeriod}` : '',
        data.currentCosts?.length ? `\nCurrent Costs\n${data.currentCosts.map(c => `  • ${c.item}: $${c.annualCost?.toLocaleString?.()}/yr`).join('\n')}` : '',
        data.projectedSavings?.length ? `\nProjected Savings\n${data.projectedSavings.map(s => `  • ${s.item}: $${s.annualSaving?.toLocaleString?.()}/yr (${s.confidence})`).join('\n')}` : '',
      ].filter(Boolean).join('\n')

    case 'legalCompliance':
      return [
        `Data Classification: ${data.dataClassification || 'Internal'}`,
        data.applicableRegulations?.length ? `\nRegulations\n${data.applicableRegulations.map(r => `  • ${r.regulation}: ${r.applicability}`).join('\n')}` : '',
        data.complianceChecklist?.length ? `\nCompliance Checklist\n${data.complianceChecklist.map(c => `  • [${c.status}] ${c.item} (${c.owner})`).join('\n')}` : '',
      ].filter(Boolean).join('\n')

    case 'dataSecurity':
      return [
        data.dataInventory?.length ? `Data Inventory\n${data.dataInventory.map(d => `  • ${d.dataType} [${d.sensitivity}]: stored in ${d.storage}`).join('\n')}` : '',
        data.encryptionRequirements?.length ? `\nEncryption\n${list(data.encryptionRequirements)}` : '',
        data.incidentResponse ? `\nIncident Response\n${data.incidentResponse}` : '',
      ].filter(Boolean).join('\n')

    case 'permissionsMatrix':
      return [
        data.roles?.length ? `Roles\n${data.roles.map(r => `  • ${r.role}: ${r.description}`).join('\n')}` : '',
        data.features?.length ? `\nFeature Permissions\n${data.features.map(f => `  • ${f.feature}: ${JSON.stringify(f.permissions)}`).join('\n')}` : '',
        data.specialPermissions?.length ? `\nSpecial Permissions\n${data.specialPermissions.map(sp => `  • ${sp.permission} → ${(sp.roles || []).join(', ')}`).join('\n')}` : '',
      ].filter(Boolean).join('\n')

    case 'technicalArchitecture':
      return [
        `Overview\n${data.overview || ''}`,
        data.components?.length ? `\nComponents\n${data.components.map(c => `  • ${c.name} [${c.type}]: ${c.description} (${c.technology})`).join('\n')}` : '',
        data.infrastructure ? `\nInfrastructure\n  Hosting: ${data.infrastructure.hosting}\n  Platform: ${data.infrastructure.platform}\n  Availability: ${data.infrastructure.availability}` : '',
      ].filter(Boolean).join('\n')

    case 'integrationSpec':
      return (data.integrations || []).map(int =>
        `${int.id}: ${int.system} (${int.type}, ${int.direction})\n  ${int.purpose}\n  Frequency: ${int.frequency} | SLA: ${int.sla}`
      ).join('\n\n')

    case 'currentStateWorkflow':
    case 'futureStateWorkflow':
      return [
        `${data.title || ''}\n${data.description || ''}`,
        data.steps?.length ? `\nSteps\n${data.steps.map(s => `  ${s.step}. [${s.actor}] ${s.action} (${s.tool})`).join('\n')}` : '',
        stageId === 'currentStateWorkflow' && data.totalTime ? `\nTotal Cycle Time: ${data.totalTime}` : '',
        stageId === 'futureStateWorkflow' && data.timeReduction ? `\nTime Reduction: ${data.timeReduction}` : '',
      ].filter(Boolean).join('\n')

    case 'launchPlan':
      return [
        `Launch Type: ${data.launchType || 'Phased'}`,
        data.timeline?.length ? `\nMilestones\n${data.timeline.map(m => `  • ${m.date}: ${m.milestone} (${m.owner})`).join('\n')}` : '',
        data.goLiveChecklist?.length ? `\nGo-Live Checklist\n${list(data.goLiveChecklist)}` : '',
      ].filter(Boolean).join('\n')

    case 'stakeholderSignoff':
      return [
        `${data.projectName || 'Project'} v${data.version || '1.0'} — ${data.date || ''}`,
        data.approvers?.length ? `\nApprovers\n${data.approvers.map(a => `  • ${a.name} (${a.title}, ${a.department}) — ${a.status}`).join('\n')}` : '',
        data.approvalNotes ? `\nNotes\n${data.approvalNotes}` : '',
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

// System artifacts (visual): always render component, no editing.
// Business docs: render component; when editing=true, wrap in contentEditable so
// the exact document template becomes directly editable in-place.
const SYSTEM_ARTIFACTS = new Set(['workflowMap', 'dataModel', 'automationModel', 'uxRecommendation'])
const BUSINESS_DOCS    = new Set([
  'intakeSummary', 'problemStatement', 'productBrief', 'prd', 'userStories',
  'successMetrics', 'qaTestPlan', 'businessCase', 'costBreakdown', 'roiAnalysis',
  'legalCompliance', 'dataSecurity', 'permissionsMatrix', 'stakeholderSignoff',
  'technicalArchitecture', 'integrationSpec', 'currentStateWorkflow', 'futureStateWorkflow',
  'launchPlan', 'appSpec',
])

// ─── Stage row ────────────────────────────────────────────────────────────────
function StageRow({ stage, index, data, isOpen, approved, onToggle, onApprove, onOpen, hasArtifact, artifact, conversationId }) {
  const Component = stage.component
  const fileUrls = artifact?.file_urls || {}
  const formats = STAGE_FORMATS[stage.id] || ['pdf']
  const isSystemArtifact = SYSTEM_ARTIFACTS.has(stage.id)
  const isBusinessDoc    = BUSINESS_DOCS.has(stage.id)
  const [editing, setEditing] = useState(false)

  // Always scope localStorage to the specific conversationId (a UUID).
  // If we don't have a real conversationId yet, use null — never fall back to 'local'
  // which would bleed edits across different conversations.
  const lsKey = conversationId ? `aria_html_${conversationId}_${stage.id}` : null

  // savedHTML stores innerHTML captured after the user clicks Done.
  // Only load if we have a real conversation-scoped key (never load 'local' saves).
  const [savedHTML, setSavedHTML] = useState(() => {
    if (!lsKey) return null
    const v = localStorage.getItem(lsKey)
    return v && v.includes('<') ? v : null
  })
  const editRef = useRef(null)
  const contentRef = useRef(null)  // points to the rendered content DOM node for PDF export

  // ── System artifact data editing (JSON-based, not HTML) ────────────────────
  const dataLsKey = (isSystemArtifact && conversationId) ? `aria_data_${conversationId}_${stage.id}` : null
  const [savedData, setSavedData] = useState(() => {
    if (!dataLsKey) return null
    try { return JSON.parse(localStorage.getItem(dataLsKey)) } catch { return null }
  })
  // The data actually shown: saved edits override the original AI-generated data
  const activeData = (isSystemArtifact && savedData) ? savedData : data

  // Auto-save handler — called on every canvas/editor change; persists immediately
  const handleAutoSave = React.useCallback((updatedData) => {
    if (!isSystemArtifact) return
    setSavedData(updatedData)
    if (dataLsKey) {
      try { localStorage.setItem(dataLsKey, JSON.stringify(updatedData)) } catch {}
    }
  }, [isSystemArtifact, dataLsKey])

  // Scrub ALL old-format localStorage keys on mount so stale data never bleeds in
  useEffect(() => {
    ;['local', conversationId].filter(Boolean).forEach(ns => {
      localStorage.removeItem(`aria_edit_${ns}_${stage.id}`)
    })
    localStorage.removeItem(`aria_html_local_${stage.id}`)
  }, [stage.id, conversationId])

  // ── Done / Revert handlers ─────────────────────────────────────────────────
  const handleDone = () => {
    // Business docs: capture innerHTML of contentEditable wrapper
    if (editRef.current) {
      const html = editRef.current.innerHTML
      setSavedHTML(html)
      if (lsKey) localStorage.setItem(lsKey, html)
    }
    setEditing(false)
  }

  const handleSystemDone = () => {
    // Data is already auto-saved on every change — just exit edit mode
    setEditing(false)
  }

  const handleRevert = () => {
    setSavedHTML(null)
    if (lsKey) localStorage.removeItem(lsKey)
    setEditing(false)
  }

  const handleSystemRevert = () => {
    setSavedData(null)
    if (dataLsKey) localStorage.removeItem(dataLsKey)
    setEditing(false)
  }

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
        <div style={{ borderTop: '0.5px solid #1A1A1A', background: '#0D0D0D' }}>

          {/* Scrollable content area */}
          <div ref={contentRef} style={{ maxHeight: 640, overflow: 'auto', padding: (isBusinessDoc && !editing) ? '10px' : '14px 16px' }}>
            {isSystemArtifact
              ? /* ── System artifacts: structured JSON editor or visual component ── */
                editing
                  ? <Component data={activeData} editing={true} onDataChange={handleAutoSave} />
                  : <Component data={activeData} />
              : /* ── Business docs: contentEditable in edit mode ── */
                editing
                  ? (
                    <div>
                      <div style={{ background: '#1A1A2A', borderBottom: '1px solid #3A1E5F', padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: '4px 4px 0 0' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A78BFA' }}/>
                        <span style={{ fontSize: 10, color: '#A78BFA', fontWeight: 600, letterSpacing: '0.06em' }}>EDITING — click any text in the document to edit it</span>
                      </div>
                      <div
                        ref={editRef}
                        contentEditable
                        suppressContentEditableWarning
                        style={{ outline: 'none', cursor: 'text', border: '1.5px solid #3A1E5F', borderTop: 'none', borderRadius: '0 0 4px 4px' }}
                        {...(savedHTML ? { dangerouslySetInnerHTML: { __html: savedHTML } } : {})}
                      >
                        {!savedHTML && <Component data={data} />}
                      </div>
                    </div>
                  )
                  : savedHTML
                    ? <div dangerouslySetInnerHTML={{ __html: savedHTML }} />
                    : <Component data={data} />
            }
          </div>

          {/* Action bar — always visible, outside scroll area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '0.5px solid #1A1A1A', padding: '8px 16px' }}>
            {editing
              ? /* Done + Revert */
                <>
                  <button
                    onClick={isSystemArtifact ? handleSystemDone : handleDone}
                    style={{ background: '#0D1F16', color: '#34D399', border: '0.5px solid #34D39966', borderRadius: 6, padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    ✓ Done
                  </button>
                  <button
                    onClick={isSystemArtifact ? handleSystemRevert : handleRevert}
                    style={{ background: '#1A1A1A', color: '#6B7280', border: '0.5px solid #2A2A2A', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Revert
                  </button>
                </>
              : /* Normal action bar */
                <>
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

                  {/* Edit button — all stages except UX Recommendation */}
                  {stage.id !== 'uxRecommendation' && (
                    <button
                      onClick={() => setEditing(true)}
                      style={{ background: '#1A1A2A', color: '#A78BFA', border: '0.5px solid #3A1E5F', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <EditIcon /> {(isBusinessDoc && savedHTML) || (isSystemArtifact && savedData) ? 'Edit again' : 'Edit'}
                    </button>
                  )}

                  {/* Open full viewer */}
                  {hasArtifact && onOpen && (
                    <button
                      onClick={onOpen}
                      style={{ background: 'transparent', color: '#525252', border: '0.5px solid #222', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      ↗ Open
                    </button>
                  )}

                  {/* Export dropdown */}
                  <div style={{ marginLeft: 'auto' }}>
                    <ExportDropdown
                      formats={formats}
                      stageId={stage.id}
                      activeData={activeData}
                      contentRef={contentRef}
                      title={stage.label}
                    />
                  </div>
                </>
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EnterpriseStagesCard({ brief, buildMode, pmPackage, onBuild, onOpenArtifact, artifactIds, artifacts = [], conversationId: conversationIdProp }) {
  const [openStage, setOpenStage] = useState('intakeSummary')
  const [approved, setApproved] = useState({})
  const [building, setBuilding] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)
  // Auto-collapse: no onBuild = already built; building started = collapse
  const isAnswered = !onBuild || building
  const [userCollapse, setUserCollapse] = useState(null)
  const collapsed = userCollapse !== null ? userCollapse : isAnswered

  if (!brief) return null

  // Derive a stable conversationId: prefer explicit prop, then first artifact's conversation_id.
  // Never fall back to a generic string — null means "no valid scope, don't load localStorage".
  const conversationId = conversationIdProp || artifacts[0]?.conversation_id || null

  const DOC_ONLY_MODES = ['operations', 'compliance', 'finance', 'hr']
  const isDocOnly = DOC_ONLY_MODES.includes(buildMode)

  const STAGES = getStages(brief, pmPackage, buildMode)
  const approvedCount = Object.values(approved).filter(Boolean).length
  const specApproved = approved['appSpec']
  const allApproved = approvedCount === STAGES.length
  const modeLabel = buildMode === 'product_manager'
    ? `PM — ${pmPackage === 'lean' ? 'Lean' : pmPackage === 'enterprise' ? 'Enterprise' : pmPackage === 'full_lifecycle' ? 'Full Lifecycle' : 'Custom'}`
    : buildMode === 'docs' ? 'Documentation First' : 'Guided Build'

  // Artifact type map covers all known stage IDs
  const ARTIFACT_TYPE_MAP = {
    intakeSummary: 'intake_summary', problemStatement: 'problem_statement',
    productBrief: 'product_brief', prd: 'prd',
    userStories: 'user_stories', successMetrics: 'success_metrics',
    qaTestPlan: 'qa_test_plan', workflowMap: 'workflow_map',
    dataModel: 'data_model', automationModel: 'automation_model',
    uxRecommendation: 'ux_recommendation', appSpec: 'app_spec',
    businessCase: 'business_case', costBreakdown: 'cost_breakdown',
    roiAnalysis: 'roi_analysis', legalCompliance: 'legal_compliance',
    dataSecurity: 'data_security', permissionsMatrix: 'permissions_matrix',
    stakeholderSignoff: 'stakeholder_signoff', technicalArchitecture: 'technical_architecture',
    integrationSpec: 'integration_spec', currentStateWorkflow: 'current_state_workflow',
    futureStateWorkflow: 'future_state_workflow', launchPlan: 'launch_plan',
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
            conversationId={conversationId}
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

          {/* Build button — only for app-producing roles (PM, IT Admin, task modes) */}
          {onBuild && !isDocOnly && (
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

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

// ── Shared business document styles ──────────────────────────────────────────
// Outer canvas: light gray surround (like Google Docs), white page card inside
const D = {
  canvas: { background: '#E8EAED', padding: '28px 24px' },
  page: {
    background: '#FFFFFF',
    maxWidth: 740,
    margin: '0 auto',
    padding: '56px 64px',
    fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    color: '#374151',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 4px 20px rgba(0,0,0,0.10)',
    borderRadius: 2,
    lineHeight: 1.6,
  },
  title: { fontSize: 26, fontWeight: 700, color: '#111827', margin: '0 0 6px', letterSpacing: '-0.02em' },
  subtitle: { fontSize: 14, color: '#6B7280', margin: 0, fontWeight: 400 },
  h2: { fontSize: 15, fontWeight: 700, color: '#1E3A5F', margin: '0 0 10px', paddingBottom: 7, borderBottom: '2px solid #DBEAFE', textTransform: 'uppercase', letterSpacing: '0.04em' },
  h3: { fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 6px' },
  body: { fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0 },
  hr: { border: 'none', borderTop: '2px solid #E5E7EB', margin: '28px 0' },
  label: { fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' },
}

// Company header block reused across all business docs
function DocHeader({ title, subtitle }) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, border: '1.5px dashed #D1D5DB', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#F9FAFB' }}>
            <span style={{ fontSize: 8, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.3 }}>LOGO</span>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>[Company Name]</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>Confidential — Internal Use</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#6B7280' }}>{today}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Version 1.0 — Draft</div>
        </div>
      </div>
      <div style={{ borderLeft: '4px solid #1D4ED8', paddingLeft: 16, marginBottom: 24 }}>
        <h1 style={D.title}>{title}</h1>
        {subtitle && <p style={D.subtitle}>{subtitle}</p>}
      </div>
      <hr style={D.hr}/>
    </>
  )
}

// ── 1. IntakeSummaryContent ────────────────────────────────────────────────────
function IntakeSummaryContent({ data }) {
  if (!data) return null
  return (
    <div style={D.canvas}>
      <div style={D.page}>
        <DocHeader title="Intake Summary" subtitle="Project intake and requirements capture document"/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <section>
            <h2 style={D.h2}>Executive Summary</h2>
            <p style={{ ...D.body, fontSize: 15, color: '#1E293B', fontWeight: 400, lineHeight: 1.8 }}>{data.understood}</p>
          </section>
          <section>
            <h2 style={D.h2}>Business Problem</h2>
            <p style={D.body}>{data.businessProblem}</p>
          </section>
          <section>
            <h2 style={D.h2}>Stakeholders</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 6 }}>
              <div>
                <div style={D.label}>Primary Users</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {(data.primaryUsers || []).map((u, i) => (
                    <span key={i} style={{ fontSize: 13, color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 4, padding: '4px 12px', fontWeight: 500 }}>{u}</span>
                  ))}
                </div>
              </div>
              {(data.secondaryUsers || []).length > 0 && (
                <div>
                  <div style={D.label}>Secondary Users</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {data.secondaryUsers.map((u, i) => (
                      <span key={i} style={{ fontSize: 13, color: '#6B7280', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 4, padding: '4px 12px' }}>{u}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
          <section>
            <h2 style={D.h2}>Current Process Being Replaced</h2>
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: '14px 18px' }}>
              <p style={{ ...D.body, color: '#9A3412', margin: 0 }}>{data.currentProcess}</p>
            </div>
          </section>
          <section>
            <h2 style={D.h2}>Expected Outcome</h2>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '14px 18px' }}>
              <p style={{ ...D.body, color: '#065F46', fontWeight: 500, margin: 0 }}>{data.mainOutcome}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── 2. ProductBriefContent ─────────────────────────────────────────────────────
function ProductBriefContent({ data }) {
  if (!data) return null
  return (
    <div style={D.canvas}>
      <div style={D.page}>
        <DocHeader title="Product Brief" subtitle="Objectives, roles, workflows, and business rules"/>

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

// ── 3. WorkflowMapContent — Proper swimlane flowchart ─────────────────────────
const SL_FILL   = ['#EFF6FF','#F0FDF4','#FFFBEB','#F5F3FF','#FFF1F2','#ECFDF5']
const SL_ACCENT = ['#2563EB','#16A34A','#D97706','#7C3AED','#E11D48','#059669']
const SL_LABEL  = ['#1E40AF','#14532D','#92400E','#4C1D95','#9F1239','#064E3B']

function WorkflowMapContent({ data }) {
  if (!data) return null
  const steps = data.steps || []
  const decisions = data.decisionPoints || []
  const exceptions = data.exceptionPaths || []

  // Unique ordered actors
  const actors = []
  steps.forEach(s => { if (s.actor && !actors.includes(s.actor)) actors.push(s.actor) })
  if (!actors.length) actors.push('Process')

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

  // Include END oval (rx=30) + right padding so nothing clips
  const svgW = LABEL_W + START_W + steps.length * (BOX_W + COL_GAP) + COL_GAP + 30 + 40
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

function AutomationModelContent({ data }) {
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

// ── 6. AppSpecContent ──────────────────────────────────────────────────────────
function AppSpecContent({ data }) {
  if (!data) return null
  const primary = data.colorTheme?.primary || '#7C3AED'

  return (
    <div style={D.canvas}>
      <div style={D.page}>
        {/* Color accent bar */}
        <div style={{ height: 5, background: primary, borderRadius: 2, marginBottom: 28 }} />

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

// System artifacts always render their visual component — never plain-text fallback
const SYSTEM_ARTIFACTS = new Set(['workflowMap', 'dataModel', 'automationModel', 'uxRecommendation'])

// ─── Stage row ────────────────────────────────────────────────────────────────
function StageRow({ stage, index, data, isOpen, approved, onToggle, onApprove, onOpen, hasArtifact, artifact }) {
  const Component = stage.component
  const fileUrls = artifact?.file_urls || {}
  const formats = STAGE_FORMATS[stage.id] || ['pdf']
  const isSystemArtifact = SYSTEM_ARTIFACTS.has(stage.id)
  const [editing, setEditing] = useState(false)
  const lsKey = `aria_edit_${artifact?.conversation_id || 'local'}_${stage.id}`

  // System artifacts never use savedText — they always show their visual component.
  // Business docs (intakeSummary, productBrief, appSpec) use savedText for manual edits.
  const [savedText, setSavedText] = useState(() => {
    if (isSystemArtifact) return null // always ignore for visual components
    return artifact?.content?._manualEdit || localStorage.getItem(lsKey) || null
  })

  // Clear any stale localStorage for system artifact stages
  useEffect(() => {
    if (isSystemArtifact) localStorage.removeItem(lsKey)
  }, [isSystemArtifact, lsKey])

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
          {/* Scrollable content area — caps height so long docs don't push page */}
          <div style={{ maxHeight: 640, overflow: 'auto', padding: '14px 16px' }}>
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

          </div>{/* end scrollable content */}

          {/* Action bar — always visible, outside scroll area */}
          {!editing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '0.5px solid #1A1A1A', padding: '8px 16px' }}>
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

              {/* ✏ Edit — only for business docs; system artifacts have inline editing built in */}
              {!isSystemArtifact && (
                <button
                  onClick={() => setEditing(true)}
                  style={{ background: '#1A1A2A', color: '#A78BFA', border: '0.5px solid #3A1E5F', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <EditIcon /> {savedText ? 'Edit again' : 'Edit'}
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

import React, { useState } from 'react'
import { logAction } from '../lib/devlog'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

// The 7 canonical PM document categories Aria is style-trained on
// (see api/lib/docStyleProfiles.js + docs/samples/). Each `request` is the
// natural-language prompt handed to /api/pm-document, which resolves it to the
// matching template + distilled style profile.
const DOC_TYPES = [
  { id: 'competitive_analysis', label: 'Competitive Analysis',        description: 'Market & competitor landscape, positioning', icon: '🔍', color: '#60A5FA', request: 'Create a Competitive Analysis for this project' },
  { id: 'strategy_vision_okrs', label: 'Strategy, Vision & OKRs',     description: 'Product strategy, vision, and quarterly OKRs',  icon: '🧭', color: '#A78BFA', request: 'Create a Product Strategy, Vision & OKRs document for this project' },
  { id: 'prd',                  label: 'PRD & User Stories',           description: 'Requirements, specs, and acceptance criteria', icon: '📋', color: '#818CF8', request: 'Create a PRD with specs and user stories for this project' },
  { id: 'roadmap_release',      label: 'Roadmap & Release Plan',       description: 'Phased roadmap + alpha/beta/GA release plan',  icon: '🗺️', color: '#34D399', request: 'Create a Product Roadmap & Release Plan for this project' },
  { id: 'product_design',       label: 'Product Design',               description: 'UX flows, IA, and design direction',          icon: '🎨', color: '#F472B6', request: 'Create a Product Design document for this project' },
  { id: 'business_case',        label: 'Business Case & Proposal',     description: 'ROI, costs, and stakeholder justification',   icon: '💼', color: '#F59E0B', request: 'Create a Business Case & Product Proposal for this project' },
  { id: 'pitch_deck',           label: 'Pitch Deck',                   description: 'Investor / stakeholder presentation',         icon: '📊', color: '#FB923C', request: 'Create a Pitch Deck for this project' },
]

// Multi-select doc picker. The user CHECKS the docs they want; Aria then generates
// them in order. `done` (set once submitted) locks the card and shows the summary.
export default function DocsTypeCard({ onGenerate, done = false, doneLabels = [] }) {
  const [hovered, setHovered] = useState(null)
  const [picked, setPicked] = useState(() => new Set())
  const [collapsed, setCollapsed] = useState(done)

  const toggle = (id) => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // Preserve the on-screen order of the 7 types in the returned selection.
  const submit = () => {
    if (done) return
    const selected = DOC_TYPES.filter(d => picked.has(d.id))
    if (!selected.length) return
    logAction('docs_engine.types_selected', { docTypes: selected.map(d => d.id) })
    onGenerate && onGenerate(selected)
  }

  return (
    <div style={{
      background: '#0D0D0D',
      border: `0.5px solid ${done ? '#1A3A28' : '#1E1E1E'}`,
      borderRadius: 14, overflow: 'hidden', maxWidth: '92%',
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(v => !v)}
        style={{ padding: '14px 18px 12px', borderBottom: collapsed ? 'none' : '0.5px solid #1A1A1A', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#D4D4D4' }}>
              Which documents should I create?
            </p>
            {done ? (
              <span style={{ fontSize: 11, color: '#34D399' }}>✓ Generating {doneLabels.length} document{doneLabels.length === 1 ? '' : 's'}{doneLabels.length ? `: ${doneLabels.join(', ')}` : ''}</span>
            ) : (
              <span style={{ fontSize: 11, color: '#3D3D3D' }}>Check all you want — I'll generate them in order and save each to this project.</span>
            )}
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#525252', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {!collapsed && !done && (
        <>
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {DOC_TYPES.map(doc => {
              const isChecked = picked.has(doc.id)
              const isHov = hovered === doc.id
              return (
                <button
                  key={doc.id}
                  onClick={() => toggle(doc.id)}
                  onMouseEnter={() => setHovered(doc.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: isChecked ? '#0A1A14' : isHov ? '#111' : '#0D0D0D',
                    border: `0.5px solid ${isChecked ? '#34D39955' : isHov ? '#2A2A2A' : '#1A1A1A'}`,
                    borderRadius: 10, padding: '12px 12px',
                    display: 'flex', alignItems: 'flex-start', gap: 9,
                    cursor: 'pointer', transition: 'all 0.12s', textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  {/* Checkbox */}
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                    border: `1.5px solid ${isChecked ? '#34D399' : '#3A3A3A'}`,
                    background: isChecked ? '#34D399' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isChecked && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="#0D0D0D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isChecked ? '#E5E5E5' : '#A3A3A3' }}>{doc.icon} {doc.label}</span>
                    <span style={{ fontSize: 10, color: '#3D3D3D', lineHeight: 1.4 }}>{doc.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {/* Footer: generate button */}
          <div style={{ padding: '4px 12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#525252' }}>{picked.size} selected</span>
            <button
              onClick={submit}
              disabled={picked.size === 0}
              style={{
                background: picked.size ? glareGradient : '#1A1A1A',
                color: picked.size ? '#111' : '#525252',
                border: '0.5px solid #2A2A2A', borderRadius: 7,
                padding: '7px 16px', fontSize: 12, fontWeight: 600,
                cursor: picked.size ? 'pointer' : 'default', fontFamily: 'inherit',
              }}
            >
              Generate {picked.size || ''} document{picked.size === 1 ? '' : 's'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

import React, { useState } from 'react'

const MODES = [
  {
    id: 'quick',
    label: 'Quick Build',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L10 6H14L11 9L12 13L8 11L4 13L5 9L2 6H6L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      </svg>
    ),
    tagline: 'Build fast, iterate later',
    description: 'Skip the deep scoping. Aria asks 1-2 critical questions and starts building immediately.',
    forWho: 'Best for: Prototypes, simple workflows, solo teams, urgent needs',
    steps: ['1-2 quick questions', 'App spec', 'Build'],
    accent: '#525252',
    accentLight: '#1A1A1A',
  },
  {
    id: 'guided',
    label: 'Guided Build',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M11.5 9v6M9 11.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    tagline: 'Deep scoping. Enterprise-ready.',
    description: 'Aria acts as PM and solutions architect. Maps the full workflow, data model, and automation before building.',
    forWho: 'Best for: Multi-role workflows, approvals, automations, integrations',
    steps: ['Discovery questions', 'Workflow brief', 'Data + automation model', 'UX plan', 'App spec', 'Build'],
    accent: '#C4C4C4',
    accentLight: '#1C1C1C',
    recommended: true,
  },
  {
    id: 'docs',
    label: 'Documentation First',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M6 5h4M6 8h4M6 11h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    tagline: 'Approve first. Build after.',
    description: 'Generates a full PRD, workflow map, and technical architecture. Stakeholders approve the spec before any app is built.',
    forWho: 'Best for: Compliance environments, multi-stakeholder projects, sign-off required',
    steps: ['Discovery questions', 'PRD + workflow map', 'Technical architecture', 'Stakeholder approval', 'Build'],
    accent: '#6B7280',
    accentLight: '#161616',
  },
]

export default function BuildModeCard({ recommendedMode, complexityReason, onSelect, selected }) {
  const [hovered, setHovered] = useState(null)
  const isReadOnly = !onSelect
  const activeMode = selected || (isReadOnly ? recommendedMode : null)

  return (
    <div style={{
      background: '#111111',
      border: '0.5px solid #2A2A2A',
      borderRadius: 14,
      overflow: 'hidden',
      maxWidth: '92%',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 12px', borderBottom: '0.5px solid #1E1E1E' }}>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#D4D4D4' }}>
          How would you like to build this?
        </p>
        {complexityReason && (
          <p style={{ margin: 0, fontSize: 11, color: '#525252', lineHeight: 1.5 }}>
            {complexityReason}
          </p>
        )}
      </div>

      {/* Mode options */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MODES.map(mode => {
          const isRecommended = mode.id === recommendedMode
          const isHovered = hovered === mode.id

          return (
            <div
              key={mode.id}
              onClick={() => onSelect && onSelect(mode.id)}
              onMouseEnter={() => !isReadOnly && setHovered(mode.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: activeMode === mode.id ? '#191919' : (isHovered ? '#191919' : '#141414'),
                border: `0.5px solid ${activeMode === mode.id ? '#3D3D3D' : (isRecommended ? '#2A2A2A' : '#222')}`,
                borderRadius: 10, padding: '12px 14px',
                cursor: isReadOnly ? 'default' : 'pointer',
                transition: 'all 0.12s', position: 'relative',
                opacity: isReadOnly && activeMode && activeMode !== mode.id ? 0.4 : 1,
              }}
            >
              {/* Recommended badge */}
              {isRecommended && (
                <div style={{
                  position: 'absolute',
                  top: 10,
                  right: 12,
                  background: '#1A2A1A',
                  color: '#34D399',
                  border: '0.5px solid #34D39933',
                  borderRadius: 4,
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 6px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>Recommended</div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {/* Icon */}
                <div style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: '#1E1E1E',
                  border: '0.5px solid #2E2E2E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isRecommended ? '#D4D4D4' : '#525252',
                  flexShrink: 0,
                  transition: 'color 0.12s',
                }}>
                  {mode.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0, paddingRight: isRecommended ? 90 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isRecommended ? '#E5E5E5' : '#A3A3A3' }}>
                      {mode.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#3D3D3D' }}>·</span>
                    <span style={{ fontSize: 10, color: '#525252' }}>{mode.tagline}</span>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: '#525252', lineHeight: 1.55 }}>
                    {mode.description}
                  </p>

                  {/* Steps flow */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                    {mode.steps.map((step, i) => (
                      <React.Fragment key={i}>
                        <span style={{
                          fontSize: 9,
                          color: '#3D3D3D',
                          background: '#1A1A1A',
                          border: '0.5px solid #222',
                          borderRadius: 3,
                          padding: '2px 6px',
                          whiteSpace: 'nowrap',
                        }}>{step}</span>
                        {i < mode.steps.length - 1 && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1.5 4h5M4.5 2L6 4l-1.5 2" stroke="#2A2A2A" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  <p style={{ margin: '8px 0 0', fontSize: 10, color: '#3D3D3D', fontStyle: 'italic' }}>
                    {mode.forWho}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import React, { useState } from 'react'

const PACKAGES = [
  {
    id: 'lean',
    label: 'Lean',
    tagline: 'Move fast',
    description: 'Core documents only: intake summary, PRD, user stories, workflow map, data model, and app spec. Everything you need to build and ship.',
    includes: ['Intake Summary', 'PRD', 'User Stories', 'Workflow Map', 'Data Model', 'App Spec'],
    forWho: 'Startups, small teams, fast-moving projects',
    accent: '#34D399',
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    tagline: 'Stakeholder-ready',
    description: 'Full lean stack plus business case, cost breakdown, ROI analysis, permissions matrix, and sign-off workflow for executive approval.',
    includes: ['Everything in Lean', 'Business Case', 'Cost Breakdown', 'ROI Analysis', 'Permissions Matrix', 'Sign-off Flow'],
    forWho: 'Mid-market and enterprise teams, budget approvals required',
    recommended: true,
    accent: '#818CF8',
  },
  {
    id: 'full_lifecycle',
    label: 'Full Lifecycle',
    tagline: 'End-to-end',
    description: 'Complete enterprise stack plus legal compliance checklist, data security spec, current vs future state analysis, and launch plan.',
    includes: ['Everything in Enterprise', 'Legal Compliance', 'Data Security Spec', 'Current vs Future State', 'Launch Plan'],
    forWho: 'Regulated industries, complex rollouts, compliance-heavy environments',
    accent: '#F59E0B',
  },
]

export default function PMPackageCard({ intro, onSelect, selected }) {
  const [hovered, setHovered] = useState(null)
  const isReadOnly = !onSelect
  const activePackage = selected
  const isAnswered = isReadOnly && !!activePackage

  const [userCollapse, setUserCollapse] = useState(null)
  const collapsed = userCollapse !== null ? userCollapse : isAnswered
  const activePkg = PACKAGES.find(p => p.id === activePackage)

  return (
    <div style={{
      background: '#111111',
      border: '0.5px solid #2A2A2A',
      borderRadius: 14,
      overflow: 'hidden',
      maxWidth: '92%',
    }}>
      {/* Header */}
      <div
        onClick={() => setUserCollapse(!collapsed)}
        style={{ padding: '14px 18px 12px', borderBottom: collapsed ? 'none' : '0.5px solid #1E1E1E', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: '#1A1A3E', border: '0.5px solid #2A2A5E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1 3h9M1 6h6M1 9h4" stroke="#818CF8" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#D4D4D4' }}>
                PM PACKAGE · Select your document depth
              </p>
            </div>
            {collapsed && activePkg ? (
              <span style={{ fontSize: 11, color: '#525252', marginLeft: 28 }}>
                ✓ {activePkg.label}
                <span style={{ color: '#34D399', marginLeft: 6, fontSize: 10 }}>Selected</span>
              </span>
            ) : intro ? (
              <p style={{ margin: '0 0 0 28px', fontSize: 11, color: '#525252', lineHeight: 1.5 }}>{intro}</p>
            ) : null}
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#525252', transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'none', flexShrink: 0, marginLeft: 10 }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PACKAGES.map(pkg => {
            const isHovered = hovered === pkg.id
            const isActive = activePackage === pkg.id

            return (
              <div
                key={pkg.id}
                onClick={() => onSelect && onSelect(pkg.id)}
                onMouseEnter={() => !isReadOnly && setHovered(pkg.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: isActive ? '#191919' : (isHovered ? '#191919' : '#141414'),
                  border: `0.5px solid ${isActive ? '#3D3D3D' : (pkg.recommended ? '#2A2A4A' : '#222')}`,
                  borderRadius: 10, padding: '12px 14px',
                  cursor: isReadOnly ? 'default' : 'pointer',
                  transition: 'all 0.12s', position: 'relative',
                  opacity: isReadOnly && activePackage && !isActive ? 0.4 : 1,
                }}
              >
                {pkg.recommended && (
                  <div style={{
                    position: 'absolute', top: 10, right: 12,
                    background: '#1A1A3E', color: '#818CF8',
                    border: '0.5px solid #818CF833',
                    borderRadius: 4, fontSize: 9, fontWeight: 700,
                    padding: '2px 6px', letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>Recommended</div>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 7,
                    background: '#1E1E1E', border: '0.5px solid #2E2E2E',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: pkg.accent }}>{pkg.label[0]}</span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0, paddingRight: pkg.recommended ? 90 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: pkg.recommended ? '#E5E5E5' : '#A3A3A3' }}>
                        {pkg.label}
                      </span>
                      <span style={{ fontSize: 10, color: '#3D3D3D' }}>·</span>
                      <span style={{ fontSize: 10, color: '#525252' }}>{pkg.tagline}</span>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: 11, color: '#525252', lineHeight: 1.55 }}>
                      {pkg.description}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {pkg.includes.map((item, i) => (
                        <span key={i} style={{
                          fontSize: 9, color: '#3D3D3D', background: '#1A1A1A',
                          border: '0.5px solid #222', borderRadius: 3,
                          padding: '2px 6px',
                        }}>{item}</span>
                      ))}
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: 10, color: '#3D3D3D', fontStyle: 'italic' }}>
                      {pkg.forWho}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

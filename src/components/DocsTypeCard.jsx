import React, { useState } from 'react'
import { logAction } from '../lib/devlog'

// DOC_TYPES duplicated here (keep in sync with api/engines/docs.js)
const DOC_TYPES = [
  { id: 'prd', label: 'PRD', description: 'Product requirements document', icon: '📋', color: '#818CF8' },
  { id: 'sop', label: 'SOP', description: 'Standard operating procedure', icon: '📖', color: '#34D399' },
  { id: 'business_case', label: 'Business Case', description: 'ROI, costs, and stakeholder justification', icon: '💼', color: '#F59E0B' },
  { id: 'architecture', label: 'Architecture Doc', description: 'System design and integration map', icon: '🏗️', color: '#60A5FA' },
  { id: 'roadmap', label: 'Roadmap', description: 'Phased delivery plan with milestones', icon: '🗺️', color: '#A78BFA' },
  { id: 'executive_summary', label: 'Executive Summary', description: 'C-suite briefing document', icon: '📊', color: '#F472B6' },
  { id: 'compliance', label: 'Compliance Doc', description: 'Policy, controls, and audit trails', icon: '🔒', color: '#FB923C' },
  { id: 'runbook', label: 'Runbook', description: 'Operational procedures and incident response', icon: '⚙️', color: '#94A3B8' },
]

export default function DocsTypeCard({ onSelect, selected }) {
  const [hovered, setHovered] = useState(null)
  const isAnswered = !!selected
  const [collapsed, setCollapsed] = useState(isAnswered)
  const selectedDoc = DOC_TYPES.find(d => d.id === selected)

  return (
    <div style={{
      background: '#0D0D0D',
      border: `0.5px solid ${isAnswered ? '#1A3A28' : '#1E1E1E'}`,
      borderRadius: 14,
      overflow: 'hidden',
      maxWidth: '92%',
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(v => !v)}
        style={{ padding: '14px 18px 12px', borderBottom: collapsed ? 'none' : '0.5px solid #1A1A1A', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#D4D4D4' }}>
              What type of document?
            </p>
            {collapsed && selectedDoc ? (
              <span style={{ fontSize: 11, color: '#525252' }}>
                {selectedDoc.icon} {selectedDoc.label}
                <span style={{ color: '#34D399', marginLeft: 6, fontSize: 10 }}>✓ Selected</span>
              </span>
            ) : (
              <span style={{ fontSize: 11, color: '#3D3D3D' }}>Select the document type to generate</span>
            )}
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#525252', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {DOC_TYPES.map(doc => {
            const isSelected = selected === doc.id
            const isHov = hovered === doc.id
            return (
              <button
                key={doc.id}
                onClick={() => { logAction('docs_engine.type_selected', { docType: doc.id }); onSelect && onSelect(doc.id) }}
                onMouseEnter={() => setHovered(doc.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: isSelected ? '#0A1A14' : isHov ? '#111' : '#0D0D0D',
                  border: `0.5px solid ${isSelected ? '#34D39955' : isHov ? '#2A2A2A' : '#1A1A1A'}`,
                  borderRadius: 10, padding: '12px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                  cursor: 'pointer', transition: 'all 0.12s', textAlign: 'left',
                  fontFamily: 'inherit',
                  opacity: selected && !isSelected ? 0.4 : 1,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>{doc.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#E5E5E5' : '#A3A3A3' }}>{doc.label}</span>
                <span style={{ fontSize: 10, color: '#3D3D3D', lineHeight: 1.4 }}>{doc.description}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

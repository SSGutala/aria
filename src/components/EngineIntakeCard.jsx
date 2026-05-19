import React, { useState } from 'react'
import { logAction } from '../lib/devlog'

const ENGINE_CONFIG = {
  software: {
    label: 'Software Builder',
    tagline: 'Internal app & tool development',
    color: '#818CF8',
    bg: '#0F0F1A',
    border: '#1E1E3A',
    steps: ['Goal & users', 'Core workflow', 'Data model', 'Integrations', 'App spec', 'Build'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="10" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="1" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M12.5 10v7M10 13.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  docs: {
    label: 'Document Engine',
    tagline: 'Enterprise documentation & artifacts',
    color: '#34D399',
    bg: '#0A1A14',
    border: '#1A3A28',
    steps: ['Document type', 'Context & scope', 'Structure', 'Artifact generation', 'Edit & export'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="1" width="11" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 5h5M5 8h5M5 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M14 6l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  automation: {
    label: 'Automation Engine',
    tagline: 'Workflow design & process orchestration',
    color: '#F59E0B',
    bg: '#1A1400',
    border: '#3A2E00',
    steps: ['Current process', 'Triggers & events', 'Conditions & routing', 'Integrations', 'Escalations', 'Workflow', 'Deploy'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="3" cy="9" r="2" stroke="currentColor" strokeWidth="1.3"/>
        <circle cx="15" cy="9" r="2" stroke="currentColor" strokeWidth="1.3"/>
        <circle cx="9" cy="3" r="2" stroke="currentColor" strokeWidth="1.3"/>
        <circle cx="9" cy="15" r="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 9h4M9 5v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M9 9l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  analytics: {
    label: 'Analytics Engine',
    tagline: 'Dashboards, KPIs & operational intelligence',
    color: '#60A5FA',
    bg: '#0A0F1A',
    border: '#1A2A3A',
    steps: ['Business objective', 'Key metrics', 'Data sources', 'Audience', 'Visualization', 'Dashboard spec', 'Build'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="10" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="7" y="6" width="4" height="11" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="13" y="2" width="4" height="15" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
}

export default function EngineIntakeCard({ engine, engineFocus, onConfirm, confirmed }) {
  const [collapsed, setCollapsed] = useState(!!confirmed)
  const cfg = ENGINE_CONFIG[engine] || ENGINE_CONFIG.software

  return (
    <div style={{
      background: '#111',
      border: `0.5px solid ${confirmed ? cfg.border : '#2A2A2A'}`,
      borderRadius: 14,
      overflow: 'hidden',
      maxWidth: '92%',
      transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(v => !v)}
        style={{
          padding: '14px 18px 12px',
          borderBottom: collapsed ? 'none' : '0.5px solid #1E1E1E',
          cursor: 'pointer',
          background: confirmed ? cfg.bg : 'transparent',
          transition: 'background 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: '#1A1A1A', border: `0.5px solid ${cfg.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: cfg.color, flexShrink: 0,
          }}>
            {cfg.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#D4D4D4' }}>{cfg.label}</span>
              {confirmed && <span style={{ fontSize: 10, color: cfg.color }}>✓ Active</span>}
            </div>
            <span style={{ fontSize: 11, color: '#525252' }}>{engineFocus || cfg.tagline}</span>
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#525252', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: '16px 18px' }}>
          {/* Step pipeline */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 10, color: '#3D3D3D', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Workflow
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
              {cfg.steps.map((step, i) => (
                <React.Fragment key={i}>
                  <span style={{
                    fontSize: 10, color: '#525252',
                    background: '#161616', border: '0.5px solid #222',
                    borderRadius: 4, padding: '3px 8px', whiteSpace: 'nowrap',
                  }}>{step}</span>
                  {i < cfg.steps.length - 1 && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4h5M4.5 2L6 4l-1.5 2" stroke="#2A2A2A" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {!confirmed && onConfirm && (
            <button
              onClick={() => { logAction('engine.confirmed', { engine }); onConfirm(engine) }}
              style={{
                background: `linear-gradient(135deg, ${cfg.color}22, ${cfg.color}11)`,
                border: `0.5px solid ${cfg.color}55`,
                borderRadius: 8, padding: '9px 20px',
                fontSize: 12, fontWeight: 500,
                color: cfg.color,
                cursor: 'pointer', fontFamily: 'inherit',
                width: '100%',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${cfg.color}33, ${cfg.color}22)` }}
              onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${cfg.color}22, ${cfg.color}11)` }}
            >
              Start with {cfg.label} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

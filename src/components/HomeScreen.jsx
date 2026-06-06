import React, { useState } from 'react'
import { logAction } from '../lib/devlog'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

const SUGGESTIONS = [
  {
    category: 'Build a tool',
    engine: 'software',
    color: '#818CF8',
    bg: '#0F0F1A',
    border: '#1E1E3A',
    prompts: [
      { label: 'Resume screener', detail: 'Score applicants against custom criteria', text: 'Build a resume screening tool that scores candidates based on criteria I define each session' },
      { label: 'Approval workflow', detail: 'Multi-step with roles and notifications', text: 'Build an approval workflow tool with role-based routing and automatic notifications' },
    ],
  },
  {
    category: 'Generate docs',
    engine: 'docs',
    color: '#34D399',
    bg: '#0A1A14',
    border: '#1A3A28',
    prompts: [
      { label: 'Project PRD', detail: 'Full product requirements document', text: 'Generate a complete PRD for my product initiative including user stories, data model, and success metrics' },
      { label: 'SOP document', detail: 'Standard operating procedure', text: 'Create a standard operating procedure document for my team\'s process' },
    ],
  },
  {
    category: 'Automate a process',
    engine: 'automation',
    color: '#F59E0B',
    bg: '#1A1400',
    border: '#3A2E00',
    prompts: [
      { label: 'Data pipeline', detail: 'Ingest, transform, and route data', text: 'Build an automated data pipeline that ingests files, transforms the data, and routes to the right destination' },
      { label: 'Employee onboarding', detail: 'Task assignment and tracking', text: 'Build an employee onboarding automation that assigns tasks, tracks completion, and notifies managers' },
    ],
  },
  {
    category: 'Analyse & report',
    engine: 'analytics',
    color: '#60A5FA',
    bg: '#0A0F1A',
    border: '#1A2A3A',
    prompts: [
      { label: 'KPI dashboard', detail: 'Live metrics with drill-down', text: 'Build a KPI dashboard that tracks key business metrics with drill-down by team and time period' },
      { label: 'Compliance tracker', detail: 'Audit trail and status monitoring', text: 'Build a compliance tracking tool that monitors policy adherence and maintains a full audit trail' },
    ],
  },
]

export default function HomeScreen({ user, onStartConversation }) {
  const [hoveredPrompt, setHoveredPrompt] = useState(null)

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] || null

  function handleSuggestion(promptText, label, engine) {
    logAction('home.suggestion_clicked', { label, engine })
    onStartConversation(promptText, engine)
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px 80px',
      overflowY: 'auto',
      minHeight: 0,
    }}>

      {/* Logo + greeting */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          fontSize: 32, fontWeight: 500, letterSpacing: '-0.5px',
          background: glareGradient,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          marginBottom: 10,
        }}>
          aria.
        </div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: '#D4D4D4', marginBottom: 6 }}>
          {firstName ? `What are we building today, ${firstName}?` : 'What are we building today?'}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>
          Describe your need below, or pick a starting point.
        </p>
      </div>

      {/* Suggestion grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 12,
        width: '100%',
        maxWidth: 780,
      }}>
        {SUGGESTIONS.map((group) => (
          <div key={group.category} style={{
            background: '#0D0D0D',
            border: '0.5px solid #1E1E1E',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {/* Category header */}
            <div style={{
              padding: '10px 14px 8px',
              borderBottom: '0.5px solid #1A1A1A',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: group.color, flexShrink: 0,
                boxShadow: `0 0 6px ${group.color}66`,
              }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: '#B5B5B5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {group.category}
              </span>
            </div>

            {/* Prompts */}
            {group.prompts.map((p) => {
              const key = `${group.category}:${p.label}`
              const isHovered = hoveredPrompt === key
              return (
                <button
                  key={p.label}
                  onClick={() => handleSuggestion(p.text, p.label, group.engine)}
                  onMouseEnter={() => setHoveredPrompt(key)}
                  onMouseLeave={() => setHoveredPrompt(null)}
                  style={{
                    width: '100%',
                    background: isHovered ? group.bg : 'transparent',
                    border: 'none',
                    borderBottom: '0.5px solid #141414',
                    padding: '11px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    transition: 'background 0.12s',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: isHovered ? '#FFFFFF' : '#E5E5E5' }}>
                      {p.label}
                    </span>
                    {isHovered && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#525252', flexShrink: 0 }}>
                        <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke={group.color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: '#9CA3AF', lineHeight: 1.4 }}>{p.detail}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Bottom nudge */}
      <p style={{ marginTop: 36, fontSize: 11, color: '#8A8A8A', textAlign: 'center' }}>
        Or describe exactly what you need in the input below
      </p>

    </div>
  )
}

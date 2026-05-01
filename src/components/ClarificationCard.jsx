import React, { useState } from 'react'

export default function ClarificationCard({ questions, onSubmit, onRestart, answered: isAnswered }) {
  const [selected, setSelected] = useState({})
  const [extra, setExtra] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  function toggle(qIdx, option) {
    setSelected(prev => {
      const current = new Set(prev[qIdx] || [])
      current.has(option) ? current.delete(option) : current.add(option)
      return { ...prev, [qIdx]: current }
    })
  }

  function handleSubmit() {
    const parts = questions.map((q, i) => {
      const picks = [...(selected[i] || [])]
      if (!picks.length) return null
      return `${q.question}: ${picks.join(', ')}`
    }).filter(Boolean)
    if (extra.trim()) parts.push(`Additional context: ${extra.trim()}`)
    onSubmit(parts.join('. ') || extra.trim() || 'No preference')
  }

  const hasAnyAnswer = Object.values(selected).some(s => s.size > 0) || extra.trim()
  const totalSelected = Object.values(selected).reduce((acc, s) => acc + s.size, 0)

  return (
    <div style={{
      background: '#161616',
      border: '0.5px solid #2A2A2A',
      borderRadius: 12,
      overflow: 'hidden',
      maxWidth: '88%',
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(v => !v)}
        style={{ padding: '12px 16px 10px', borderBottom: collapsed ? 'none' : '0.5px solid #1E1E1E', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Clarification · {questions.length} questions
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isAnswered && <span style={{ fontSize: 10, color: '#34D399' }}>✓ Submitted</span>}
            {!isAnswered && <span style={{ fontSize: 10, color: '#3D3D3D' }}>{totalSelected}/{questions.length} answered</span>}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#525252', transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'none' }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        {/* Progress bar */}
        {!collapsed && (
          <div style={{ height: 2, background: '#1E1E1E', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${isAnswered ? 100 : Math.round((totalSelected / questions.length) * 100)}%`,
              background: 'linear-gradient(90deg, #34D399, #60A5FA)',
              borderRadius: 1, transition: 'width 0.3s ease',
            }} />
          </div>
        )}
      </div>

      {/* Questions + extra context — hidden when collapsed */}
      {!collapsed && (
        <>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {questions.map((q, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#C4C4C4', fontWeight: 500, lineHeight: 1.4 }}>
                  {q.question}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {q.options.map(opt => {
                    const isSelected = (selected[i] || new Set()).has(opt)
                    return (
                      <button
                        key={opt}
                        onClick={() => toggle(i, opt)}
                        style={{
                          background: isSelected ? '#0D1F16' : '#1C1C1C',
                          color: isSelected ? '#34D399' : '#737373',
                          border: `0.5px solid ${isSelected ? '#34D39966' : '#2E2E2E'}`,
                          borderRadius: 6,
                          padding: '5px 11px',
                          fontSize: 11,
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontFamily: 'inherit',
                        }}
                      >
                        {isSelected && (
                          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                            <path d="M1.5 4.5l2 2 4-4" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Extra context */}
          <div style={{ padding: '0 16px 14px' }}>
            <textarea
              value={extra}
              onChange={e => setExtra(e.target.value)}
              placeholder="Anything else to add? (optional)"
              rows={2}
              style={{
                width: '100%',
                background: '#1A1A1A',
                border: '0.5px solid #2A2A2A',
                borderRadius: 8,
                color: '#C4C4C4',
                fontSize: 12,
                padding: '8px 10px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </>
      )}

      {/* Footer — always visible */}
      <div style={{
        borderTop: '0.5px solid #222',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#111',
      }}>
        {isAnswered ? (
          <>
            <span style={{ fontSize: 11, color: '#34D399', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5l2.5 2.5 5-5" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Answers submitted
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {onRestart && (
                <button
                  onClick={onRestart}
                  style={{
                    background: 'transparent', color: '#525252', border: '0.5px solid #2A2A2A',
                    borderRadius: 6, fontSize: 11, cursor: 'pointer', padding: '5px 10px', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#A3A3A3'; e.currentTarget.style.borderColor = '#3D3D3D' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.borderColor = '#2A2A2A' }}
                >
                  ↩ Restart from here
                </button>
              )}
              {onSubmit && (
                <button
                  onClick={handleSubmit}
                  style={{
                    background: '#1C1C1C', color: '#737373', border: '0.5px solid #2A2A2A',
                    borderRadius: 6, fontSize: 11, cursor: 'pointer', padding: '5px 10px', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#A3A3A3' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#737373' }}
                >
                  Change answers
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <span style={{ fontSize: 11, color: '#3D3D3D' }}>
              {totalSelected} selected
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => onSubmit('No preference')}
                style={{
                  background: 'transparent', color: '#525252', border: 'none',
                  fontSize: 11, cursor: 'pointer', padding: '5px 8px', fontFamily: 'inherit',
                }}
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={!hasAnyAnswer}
                style={{
                  background: hasAnyAnswer
                    ? 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'
                    : '#1C1C1C',
                  color: hasAnyAnswer ? '#111111' : '#3D3D3D',
                  border: `0.5px solid ${hasAnyAnswer ? '#484848' : '#2A2A2A'}`,
                  borderRadius: 7, padding: '6px 16px',
                  fontSize: 12, fontWeight: 500, cursor: hasAnyAnswer ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                Continue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

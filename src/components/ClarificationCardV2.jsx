import React, { useState } from 'react'

function MultipleChoice({ question, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map(opt => {
        const selected = value === opt
        return (
          <button
            key={opt}
            onClick={() => onChange(selected ? null : opt)}
            style={{
              background: selected ? '#0D1F16' : '#1C1C1C',
              color: selected ? '#34D399' : '#737373',
              border: `0.5px solid ${selected ? '#34D39966' : '#2E2E2E'}`,
              borderRadius: 6, padding: '5px 11px', fontSize: 11,
              cursor: 'pointer', transition: 'all 0.12s',
              display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
            }}
          >
            {selected && (
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M1.5 4.5l2 2 4-4" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function MultiSelect({ question, options, value = [], onChange }) {
  function toggle(opt) {
    const set = new Set(value)
    set.has(opt) ? set.delete(opt) : set.add(opt)
    onChange([...set])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map(opt => {
        const selected = value.includes(opt)
        return (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            style={{
              background: selected ? '#0D1A2A' : '#1C1C1C',
              color: selected ? '#60A5FA' : '#737373',
              border: `0.5px solid ${selected ? '#60A5FA66' : '#2E2E2E'}`,
              borderRadius: 6, padding: '5px 11px', fontSize: 11,
              cursor: 'pointer', transition: 'all 0.12s',
              display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
            }}
          >
            {selected && (
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M1.5 4.5l2 2 4-4" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function YesNo({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {['Yes', 'No'].map(opt => {
        const selected = value === opt
        const isYes = opt === 'Yes'
        return (
          <button
            key={opt}
            onClick={() => onChange(selected ? null : opt)}
            style={{
              background: selected ? (isYes ? '#0D1F16' : '#2A1010') : '#1C1C1C',
              color: selected ? (isYes ? '#34D399' : '#F87171') : '#737373',
              border: `0.5px solid ${selected ? (isYes ? '#34D39966' : '#F8717166') : '#2E2E2E'}`,
              borderRadius: 6, padding: '5px 18px', fontSize: 11,
              cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit',
              fontWeight: selected ? 600 : 400,
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function ShortAnswer({ placeholder, value, onChange }) {
  return (
    <input
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || 'Type your answer...'}
      style={{
        width: '100%',
        background: '#1A1A1A',
        border: '0.5px solid #2A2A2A',
        borderRadius: 7,
        color: '#C4C4C4',
        fontSize: 12,
        padding: '8px 10px',
        outline: 'none',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
      onFocus={e => e.currentTarget.style.borderColor = '#3D3D3D'}
      onBlur={e => e.currentTarget.style.borderColor = '#2A2A2A'}
    />
  )
}

const TYPE_LABEL = {
  multiple_choice: 'Choose one',
  multi_select: 'Select all that apply',
  yes_no: 'Yes / No',
  short_answer: 'Your answer',
  role_confirm: 'Confirm role',
}

export default function ClarificationCardV2({ questions, buildMode, onSubmit, onRestart, onChangeRole, answered: isAnswered }) {
  const [answers, setAnswers] = useState({})
  const [extra, setExtra] = useState('')
  // null = use smart default (collapse when answered); true/false = user's explicit toggle
  const [userCollapse, setUserCollapse] = useState(null)
  React.useEffect(() => { if (isAnswered) setUserCollapse(null) }, [isAnswered])
  const collapsed = userCollapse !== null ? userCollapse : isAnswered

  function setAnswer(idx, val) {
    setAnswers(prev => ({ ...prev, [idx]: val }))
  }

  function answeredCount() {
    return questions.filter((q, i) => {
      if (q.type === 'role_confirm') return true // always counts as answered once visible
      const v = answers[i]
      if (Array.isArray(v)) return v.length > 0
      return v !== null && v !== undefined && v !== ''
    }).length
  }

  function handleSubmit() {
    const parts = questions.map((q, i) => {
      const val = answers[i]
      if (val === null || val === undefined || val === '') return null
      if (Array.isArray(val)) return val.length ? `${q.question}: ${val.join(', ')}` : null
      return `${q.question}: ${val}`
    }).filter(Boolean)

    if (extra.trim()) parts.push(`Additional context: ${extra.trim()}`)
    onSubmit(parts.join('. ') || 'No preference')
  }

  const answered = answeredCount()
  const total = questions.length
  const progress = isAnswered ? 100 : Math.round((answered / total) * 100)

  return (
    <div style={{
      background: '#111111',
      border: '0.5px solid #2A2A2A',
      borderRadius: 12,
      overflow: 'hidden',
      maxWidth: '92%',
    }}>
      {/* Header */}
      <div
        onClick={() => setUserCollapse(v => !collapsed)}
        style={{ padding: '12px 16px 10px', borderBottom: collapsed ? 'none' : '0.5px solid #1E1E1E', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {buildMode === 'docs' ? 'Documentation Discovery' : 'Guided Discovery'} · {total} questions
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isAnswered && <span style={{ fontSize: 10, color: '#34D399' }}>✓ Submitted</span>}
            {!isAnswered && <span style={{ fontSize: 10, color: '#3D3D3D' }}>{answered}/{total} answered</span>}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#525252', transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'none' }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        {/* Progress bar */}
        {!collapsed && (
          <div style={{ height: 2, background: '#1E1E1E', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: 'linear-gradient(90deg, #34D399, #60A5FA)',
              borderRadius: 1, transition: 'width 0.3s ease',
            }} />
          </div>
        )}
      </div>

      {/* Questions + extra context — hidden when collapsed */}
      {!collapsed && (
        <>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {questions.map((q, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 5,
                    background: answers[i] !== null && answers[i] !== undefined && answers[i] !== '' && !(Array.isArray(answers[i]) && answers[i].length === 0)
                      ? '#0D1F16' : '#1A1A1A',
                    border: `0.5px solid ${answers[i] !== null && answers[i] !== undefined && answers[i] !== '' ? '#34D39966' : '#2E2E2E'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1, fontSize: 9, color: '#34D399', fontWeight: 700,
                  }}>
                    {answers[i] !== null && answers[i] !== undefined && answers[i] !== '' && !(Array.isArray(answers[i]) && answers[i].length === 0)
                      ? '✓' : <span style={{ color: '#3D3D3D' }}>{i + 1}</span>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 12, color: '#C4C4C4', fontWeight: 500, lineHeight: 1.4 }}>
                      {q.question}
                    </p>
                    <span style={{ fontSize: 9, color: '#3D3D3D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {TYPE_LABEL[q.type] || 'Answer'}
                    </span>
                  </div>
                </div>

                <div style={{ paddingLeft: 26 }}>
                  {q.type === 'role_confirm' && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setAnswer(i, 'confirmed')}
                        style={{
                          padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                          fontFamily: 'inherit', border: '0.5px solid',
                          background: answers[i] === 'confirmed' ? '#0D1F16' : '#1A1A1A',
                          color: answers[i] === 'confirmed' ? '#34D399' : '#A3A3A3',
                          borderColor: answers[i] === 'confirmed' ? '#34D39966' : '#2E2E2E',
                        }}
                      >
                        ✓ Yes, {q.roleLabel} is correct
                      </button>
                      {!isAnswered && onChangeRole && (
                        <button
                          onClick={onChangeRole}
                          style={{
                            padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                            fontFamily: 'inherit', border: '0.5px solid #2E2E2E',
                            background: '#1A1A1A', color: '#737373',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.borderColor = '#F8717155' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#737373'; e.currentTarget.style.borderColor = '#2E2E2E' }}
                        >
                          ← Pick a different role
                        </button>
                      )}
                    </div>
                  )}
                  {q.type === 'multiple_choice' && (
                    <MultipleChoice
                      question={q.question}
                      options={q.options || []}
                      value={answers[i] ?? null}
                      onChange={val => setAnswer(i, val)}
                    />
                  )}
                  {q.type === 'multi_select' && (
                    <MultiSelect
                      question={q.question}
                      options={q.options || []}
                      value={answers[i] ?? []}
                      onChange={val => setAnswer(i, val)}
                    />
                  )}
                  {q.type === 'yes_no' && (
                    <YesNo value={answers[i] ?? null} onChange={val => setAnswer(i, val)} />
                  )}
                  {q.type === 'short_answer' && (
                    <ShortAnswer
                      placeholder={q.placeholder}
                      value={answers[i] ?? ''}
                      onChange={val => setAnswer(i, val)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Extra context */}
          <div style={{ padding: '0 16px 14px' }}>
            <textarea
              value={extra}
              onChange={e => setExtra(e.target.value)}
              placeholder="Anything else Aria should know? (optional)"
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

      {/* Footer */}
      <div style={{
        borderTop: '0.5px solid #1E1E1E',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0D0D0D',
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
              {answered} of {total} answered
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => onSubmit('No preference — use your best judgment')}
                style={{
                  background: 'transparent', color: '#525252', border: 'none',
                  fontSize: 11, cursor: 'pointer', padding: '5px 8px', fontFamily: 'inherit',
                }}
              >
                Skip all
              </button>
              <button
                onClick={handleSubmit}
                style={{
                  background: answered > 0
                    ? 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'
                    : '#1C1C1C',
                  color: answered > 0 ? '#111111' : '#3D3D3D',
                  border: `0.5px solid ${answered > 0 ? '#484848' : '#2A2A2A'}`,
                  borderRadius: 7, padding: '6px 18px',
                  fontSize: 12, fontWeight: 500, cursor: answered > 0 ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                {buildMode === 'docs' ? 'Generate documentation' : 'Generate brief'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

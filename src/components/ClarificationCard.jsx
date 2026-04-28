import React, { useState } from 'react'

export default function ClarificationCard({ questions, onSubmit }) {
  const [selected, setSelected] = useState({}) // { [questionIndex]: Set of selected options }
  const [extra, setExtra] = useState('')

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

  return (
    <div style={{
      background: '#141414',
      border: '0.5px solid #2A2A2A',
      borderRadius: 10,
      padding: '14px 16px',
      maxWidth: '88%',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <p style={{ margin: 0, fontSize: 12, color: '#A3A3A3', lineHeight: 1.5 }}>
        A few quick questions to build this right:
      </p>

      {questions.map((q, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#D4D4D4', fontWeight: 500 }}>{q.question}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {q.options.map(opt => {
              const isSelected = (selected[i] || new Set()).has(opt)
              return (
                <button
                  key={opt}
                  onClick={() => toggle(i, opt)}
                  style={{
                    background: isSelected ? '#0A2A1A' : '#1A1A1A',
                    color: isSelected ? '#34D399' : '#525252',
                    border: `0.5px solid ${isSelected ? '#34D399' : '#2A2A2A'}`,
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  {isSelected && (
                    <span style={{ marginRight: 4 }}>✓</span>
                  )}
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 11, color: '#525252' }}>Add more context (optional)</label>
        <textarea
          value={extra}
          onChange={e => setExtra(e.target.value)}
          placeholder="Any other details..."
          rows={2}
          style={{
            background: '#1A1A1A',
            border: '0.5px solid #2A2A2A',
            borderRadius: 7,
            color: '#D4D4D4',
            fontSize: 12,
            padding: '8px 10px',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.5,
          }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!hasAnyAnswer}
        style={{
          background: hasAnyAnswer
            ? 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'
            : '#1A1A1A',
          color: hasAnyAnswer ? '#111111' : '#3D3D3D',
          border: `0.5px solid ${hasAnyAnswer ? '#484848' : '#2A2A2A'}`,
          borderRadius: 7,
          padding: '8px',
          fontSize: 12,
          fontWeight: 500,
          cursor: hasAnyAnswer ? 'pointer' : 'default',
          alignSelf: 'flex-start',
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        Continue
      </button>
    </div>
  )
}

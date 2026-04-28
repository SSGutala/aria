import React, { useEffect, useState } from 'react'

const STEPS = [
  'Analyzing your prompt...',
  'Designing data structure...',
  'Planning the workflow...',
  'Crafting your form fields...',
  'Selecting the color theme...',
  'Almost ready...',
]

function AIIcon() {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: 6,
      background: 'linear-gradient(135deg, #1A1A1A, #3A3A3A)',
      border: '0.5px solid #3D3D3D',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="0" y="0" width="5.5" height="5.5" rx="1" fill="#888" />
        <rect x="6.5" y="0" width="5.5" height="5.5" rx="1" fill="#CCC" />
        <rect x="0" y="6.5" width="5.5" height="5.5" rx="1" fill="#555" />
        <rect x="6.5" y="6.5" width="5.5" height="5.5" rx="1" fill="#999" />
      </svg>
    </div>
  )
}

export default function BuildingIndicator({ label }) {
  const [stepIdx, setStepIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  const steps = label ? [label] : STEPS

  useEffect(() => {
    if (steps.length <= 1) return
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setStepIdx(i => (i + 1) % steps.length)
        setVisible(true)
      }, 300)
    }, 1800)
    return () => clearInterval(interval)
  }, [steps.length])

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
      <AIIcon />
      <div style={{
        background: '#1A1A1A',
        border: '0.5px solid #222',
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 220,
      }}>
        {/* Spinner */}
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          border: '1.5px solid #3D3D3D',
          borderTopColor: '#7C7C7C',
          animation: 'spin 0.8s linear infinite',
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 12, color: '#A3A3A3',
          transition: 'opacity 0.3s ease',
          opacity: visible ? 1 : 0,
        }}>
          {steps[stepIdx]}
        </span>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  )
}

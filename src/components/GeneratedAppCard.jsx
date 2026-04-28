import React, { useState } from 'react'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

function Toast({ message }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: 8,
      padding: '8px 16px', fontSize: 12, color: '#A3A3A3', zIndex: 9999,
    }}>
      {message}
    </div>
  )
}

export default function GeneratedAppCard({ schema, slug, appId }) {
  const [toast, setToast] = useState('')
  const appUrl = `${window.location.origin}/app/${slug}`

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  function copyLink() {
    navigator.clipboard.writeText(appUrl).then(() => showToast('Copied!'))
  }

  const fields = schema?.fields || []
  const title = schema?.appTitle || 'Generated App'

  return (
    <>
      {toast && <Toast message={toast} />}
      <div style={{
        background: '#141414',
        border: '0.5px solid #2A2A2A',
        borderRadius: 10,
        padding: 12,
        maxWidth: '88%',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#F5F5F5' }}>{title}</span>
          <span style={{
            background: '#1F1F1F',
            color: '#A3A3A3',
            border: '0.5px solid #2A2A2A',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 10,
          }}>Deployed</span>
        </div>

        <div style={{ height: 2, background: '#1A1A1A', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: '100%',
            background: 'linear-gradient(90deg, #2A2A2A, #FFFFFF, #3A3A3A)',
          }} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {fields.map(f => (
            <span key={f.name} style={{
              background: '#1A1A1A',
              color: '#525252',
              border: '0.5px solid #222',
              borderRadius: 5,
              padding: '3px 8px',
              fontSize: 10,
            }}>
              {f.label}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => window.open(appUrl, '_blank')}
            style={{
              background: glareGradient,
              color: '#111111',
              border: '0.5px solid #484848',
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            View app
          </button>
          <button
            onClick={copyLink}
            style={{
              background: '#1A1A1A',
              color: '#525252',
              border: '0.5px solid #222',
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Copy link
          </button>
          <button
            onClick={() => showToast('Field editing coming soon')}
            style={{
              background: '#1A1A1A',
              color: '#525252',
              border: '0.5px solid #222',
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Edit fields
          </button>
        </div>
      </div>
    </>
  )
}

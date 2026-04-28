import React from 'react'
import { useNavigate } from 'react-router-dom'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{ background: '#111111', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid #1A1A1A' }}>
        <span style={{
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: '-0.4px',
          background: glareGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>aria.</span>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: glareGradient,
            color: '#111111',
            border: '0.5px solid #484848',
            borderRadius: 7,
            padding: '7px 18px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Sign in
        </button>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600 }}>
          <div style={{
            display: 'inline-block',
            background: '#1A1A1A',
            border: '0.5px solid #2A2A2A',
            borderRadius: 20,
            padding: '3px 12px',
            fontSize: 10,
            color: '#525252',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 24,
          }}>
            AI-Native Enterprise Workflow Builder
          </div>

          <h1 style={{
            fontSize: 48,
            fontWeight: 600,
            color: '#F5F5F5',
            lineHeight: 1.15,
            marginBottom: 20,
            letterSpacing: '-1px',
          }}>
            Build internal tools<br />
            <span style={{
              background: glareGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>in plain English</span>
          </h1>

          <p style={{ fontSize: 15, color: '#525252', lineHeight: 1.7, marginBottom: 36 }}>
            Describe any internal workflow: approval requests, intake trackers, status boards, and more. Aria builds and deploys a fully functional app in seconds.
          </p>

          <button
            onClick={() => navigate('/login')}
            style={{
              background: glareGradient,
              color: '#111111',
              border: '0.5px solid #484848',
              borderRadius: 8,
              padding: '11px 28px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Start building for free
          </button>
        </div>

        <div style={{ marginTop: 80, display: 'flex', gap: 40, color: '#3D3D3D', fontSize: 12 }}>
          <span>Approval workflows</span>
          <span>Intake trackers</span>
          <span>Status boards</span>
          <span>And more</span>
        </div>
      </main>

      <footer style={{ padding: '20px 32px', borderTop: '0.5px solid #1A1A1A', textAlign: 'center', color: '#2A2A2A', fontSize: 11 }}>
        © 2026 Aria. All rights reserved.
      </footer>
    </div>
  )
}

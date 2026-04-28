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

export default function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState(1)
  const [toast, setToast] = useState('')

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function handleComplete() {
    localStorage.removeItem('aria_new_user')
    onComplete()
  }

  return (
    <>
      {toast && <Toast message={toast} />}
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          background: '#0D0D0D', border: '0.5px solid #2A2A2A', borderRadius: 14,
          padding: 36, maxWidth: 480, width: '100%', margin: '0 16px',
        }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <span style={{
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: '-0.4px',
                background: glareGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>aria.</span>
              <h2 style={{ color: '#F5F5F5', fontSize: 24, fontWeight: 500, margin: 0 }}>Welcome to Aria</h2>
              <div style={{
                width: '100%',
                aspectRatio: '16/9',
                background: '#1A1A1A',
                border: '0.5px solid #2A2A2A',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ color: '#3D3D3D', fontSize: 12 }}>Product walkthrough coming soon</span>
              </div>
              <button
                onClick={() => setStep(2)}
                style={{
                  background: glareGradient,
                  color: '#111111',
                  border: '0.5px solid #484848',
                  borderRadius: 7,
                  padding: '9px 28px',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  alignSelf: 'stretch',
                }}
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ color: '#F5F5F5', fontSize: 22, fontWeight: 500, margin: 0 }}>Connect Microsoft 365</h2>
              <p style={{ color: '#A3A3A3', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Your generated apps will live inside your existing Microsoft environment: SharePoint, Outlook, Teams, and Azure AD.
              </p>
              <button
                onClick={() => showToast('M365 integration coming soon. Skip for now.')}
                style={{
                  background: glareGradient,
                  color: '#111111',
                  border: '0.5px solid #484848',
                  borderRadius: 7,
                  padding: '9px',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Connect Microsoft 365
              </button>
              <button
                onClick={() => setStep(3)}
                style={{
                  background: '#1A1A1A',
                  color: '#525252',
                  border: '0.5px solid #2A2A2A',
                  borderRadius: 7,
                  padding: '9px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Skip for now
              </button>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <h2 style={{ color: '#F5F5F5', fontSize: 22, fontWeight: 500, margin: 0 }}>You're ready to build</h2>
              <p style={{ color: '#A3A3A3', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Describe any internal tool in plain English and Aria will build and deploy it instantly.
              </p>
              <button
                onClick={handleComplete}
                style={{
                  background: glareGradient,
                  color: '#111111',
                  border: '0.5px solid #484848',
                  borderRadius: 7,
                  padding: '9px 28px',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  alignSelf: 'stretch',
                  marginTop: 8,
                }}
              >
                Start building
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

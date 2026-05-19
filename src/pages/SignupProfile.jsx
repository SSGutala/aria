import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deriveAccountType, useProfile } from '../hooks/useProfile'
import { logAction } from '../lib/devlog'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

const WORK_CATEGORIES = [
  { id: 'engineering', label: 'Engineering & Development', icon: '⚙️' },
  { id: 'operations', label: 'Operations & Process', icon: '🔄' },
  { id: 'product', label: 'Product & Strategy', icon: '📋' },
  { id: 'finance', label: 'Finance & Legal', icon: '💰' },
  { id: 'hr', label: 'HR & People', icon: '👥' },
  { id: 'leadership', label: 'Leadership / General', icon: '🎯' },
]

const USE_CASES = [
  {
    id: 'apps',
    icon: '🏗️',
    label: 'Internal tools & apps',
    description: 'Build and deploy web apps for your team',
  },
  {
    id: 'automation',
    icon: '⚙️',
    label: 'Workflow automations',
    description: 'Automate manual processes and approvals',
  },
  {
    id: 'docs',
    icon: '📄',
    label: 'Product documentation',
    description: 'PRDs, briefs, specs, user stories',
  },
  {
    id: 'dashboards',
    icon: '📊',
    label: 'Dashboards & reporting',
    description: 'Data views, KPI trackers, report tools',
  },
  {
    id: 'all',
    icon: '🚀',
    label: 'All of the above / Exploring',
    description: 'Show me everything Aria can do',
  },
]

const ACCOUNT_LABELS = {
  builder: {
    icon: '🏗️',
    name: 'App Builder',
    tagline: 'Build and ship internal tools fast',
    unlocks: [
      'Quick Build — go from prompt to app in minutes',
      'Guided Build — deep scoping for complex tools',
      'Full-stack, dashboard, and automation app types',
      'App spec generation and live code output',
    ],
    accent: '#60A5FA',
  },
  automator: {
    icon: '⚙️',
    name: 'Workflow Automator',
    tagline: 'Automate and systemize your processes',
    unlocks: [
      'Guided Build with automation framing',
      'Workflow maps, SOP generation, escalation matrices',
      'Operations and IT Admin role-specific docs',
      'Integration specs for your existing tools',
    ],
    accent: '#F59E0B',
  },
  strategist: {
    icon: '📄',
    name: 'PM Strategist',
    tagline: 'Turn ideas into stakeholder-ready documents',
    unlocks: [
      'PM Package — Lean, Enterprise, or Full Lifecycle',
      'Role-specific docs for Finance, HR, Compliance, and more',
      'PRDs, user stories, business cases, and QA plans',
      'Artifact panel for managing your document workspace',
    ],
    accent: '#818CF8',
  },
  full_access: {
    icon: '🚀',
    name: 'Full Access',
    tagline: 'Everything Aria can build, all in one place',
    unlocks: [
      'All build modes — Quick, Guided, Docs, PM Package, Role-Specific',
      'Full-stack apps, automations, dashboards, and documentation',
      'AI-recommended mode per project',
      'Complete artifact workspace',
    ],
    accent: '#34D399',
  },
}

function StepIndicator({ current, total }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 2, flex: 1, borderRadius: 1,
          background: i < current ? '#D4D4D4' : '#2A2A2A',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  )
}

export default function SignupProfile() {
  const navigate = useNavigate()
  const { saveProfile } = useProfile()
  const [step, setStep] = useState(1)
  const [jobTitle, setJobTitle] = useState('')
  const [workCategory, setWorkCategory] = useState([])
  const [useCases, setUseCases] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleUseCase(id) {
    if (id === 'all') {
      setUseCases(prev => prev.includes('all') ? [] : ['all'])
      return
    }
    setUseCases(prev => {
      const next = prev.filter(u => u !== 'all')
      return next.includes(id) ? next.filter(u => u !== id) : [...next, id]
    })
  }

  async function handleFinish() {
    setSaving(true)
    setError('')
    try {
      await saveProfile({
        job_title: jobTitle.trim(),
        work_category: workCategory.join(','),
        use_cases: useCases,
      })
      logAction('user.profile_completed', { accountType: deriveAccountType(useCases), jobTitle: jobTitle.trim() })
      localStorage.removeItem('aria_new_user')
      navigate('/workspace', { replace: true })
    } catch (err) {
      setError('Failed to save profile. Please try again.')
      setSaving(false)
    }
  }

  const accountType = deriveAccountType(useCases)
  const accountInfo = ACCOUNT_LABELS[accountType]

  const inputStyle = {
    width: '100%', background: '#141414', border: '0.5px solid #2A2A2A',
    borderRadius: 7, color: '#F5F5F5', padding: '9px 12px',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  return (
    <div style={{
      background: '#111111', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '0 16px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{
            fontSize: 22, fontWeight: 500, letterSpacing: '-0.4px',
            background: glareGradient, WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>aria.</span>
        </div>

        <div style={{ background: '#0D0D0D', border: '0.5px solid #2A2A2A', borderRadius: 14, padding: 28 }}>
          <StepIndicator current={step} total={3} />

          {/* Step 1: Job title + work category */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ color: '#F5F5F5', fontSize: 20, fontWeight: 500, margin: '0 0 6px' }}>Tell us about yourself</h2>
                <p style={{ color: '#525252', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  This helps Aria tailor the experience to how you actually work.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#A3A3A3', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Job title
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                  placeholder="e.g. Product Manager, Operations Lead, CTO..."
                  style={inputStyle}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#A3A3A3', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  What kind of work do you do?
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {WORK_CATEGORIES.map(cat => {
                    const isSelected = workCategory.includes(cat.id)
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setWorkCategory(prev =>
                          prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id]
                        )}
                        style={{
                          background: isSelected ? '#1A1A1A' : '#141414',
                          border: `0.5px solid ${isSelected ? '#3D3D3D' : '#222'}`,
                          borderRadius: 8, padding: '10px 14px',
                          display: 'flex', alignItems: 'center', gap: 10,
                          cursor: 'pointer', transition: 'all 0.12s', textAlign: 'left',
                          fontFamily: 'inherit',
                        }}
                      >
                        <span style={{ fontSize: 16, lineHeight: 1 }}>{cat.icon}</span>
                        <span style={{ fontSize: 13, color: isSelected ? '#E5E5E5' : '#737373', fontWeight: isSelected ? 500 : 400 }}>
                          {cat.label}
                        </span>
                        {isSelected && (
                          <span style={{ marginLeft: 'auto', color: '#34D399', fontSize: 12 }}>✓</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!jobTitle.trim() || !workCategory.length}
                style={{
                  background: jobTitle.trim() && workCategory.length ? glareGradient : '#1C1C1C',
                  color: jobTitle.trim() && workCategory.length ? '#111111' : '#3D3D3D',
                  border: `0.5px solid ${jobTitle.trim() && workCategory.length ? '#484848' : '#2A2A2A'}`,
                  borderRadius: 7, padding: '9px',
                  fontSize: 13, fontWeight: 500,
                  cursor: jobTitle.trim() && workCategory.length ? 'pointer' : 'default',
                  marginTop: 4, fontFamily: 'inherit',
                }}
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Use cases */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ color: '#F5F5F5', fontSize: 20, fontWeight: 500, margin: '0 0 6px' }}>What will you use Aria for?</h2>
                <p style={{ color: '#525252', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  Select all that apply. This determines what Aria focuses on for you.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {USE_CASES.map(uc => {
                  const isSelected = useCases.includes(uc.id)
                  return (
                    <button
                      key={uc.id}
                      onClick={() => toggleUseCase(uc.id)}
                      style={{
                        background: isSelected ? '#141414' : '#0D0D0D',
                        border: `0.5px solid ${isSelected ? '#3D3D3D' : '#1E1E1E'}`,
                        borderRadius: 10, padding: '12px 14px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        cursor: 'pointer', transition: 'all 0.12s', textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{uc.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: isSelected ? '#E5E5E5' : '#737373', marginBottom: 2 }}>
                          {uc.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#3D3D3D' }}>{uc.description}</div>
                      </div>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        border: `0.5px solid ${isSelected ? '#34D399' : '#2A2A2A'}`,
                        background: isSelected ? '#0D2A1A' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5l2.5 2.5 5-5" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    background: 'transparent', color: '#525252',
                    border: '0.5px solid #2A2A2A', borderRadius: 7,
                    padding: '9px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!useCases.length}
                  style={{
                    flex: 1,
                    background: useCases.length ? glareGradient : '#1C1C1C',
                    color: useCases.length ? '#111111' : '#3D3D3D',
                    border: `0.5px solid ${useCases.length ? '#484848' : '#2A2A2A'}`,
                    borderRadius: 7, padding: '9px',
                    fontSize: 13, fontWeight: 500,
                    cursor: useCases.length ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Account summary */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ color: '#F5F5F5', fontSize: 20, fontWeight: 500, margin: '0 0 6px' }}>Your Aria is ready</h2>
                <p style={{ color: '#525252', fontSize: 13, margin: 0 }}>
                  Based on your answers, here's how Aria is set up for you.
                </p>
              </div>

              {/* Account type card */}
              <div style={{
                background: '#141414', border: `0.5px solid ${accountInfo.accent}33`,
                borderRadius: 12, padding: '18px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${accountInfo.accent}11`,
                    border: `0.5px solid ${accountInfo.accent}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    {accountInfo.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#F5F5F5' }}>{accountInfo.name}</div>
                    <div style={{ fontSize: 12, color: '#525252' }}>{accountInfo.tagline}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {accountInfo.unlocks.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                        <path d="M2.5 7l3 3 6-6" stroke={accountInfo.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: 12, color: '#A3A3A3', lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 11, color: '#3D3D3D', lineHeight: 1.5 }}>
                You can change your role and preferences anytime in Settings.
              </p>

              {error && <p style={{ fontSize: 12, color: '#F87171', margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    background: 'transparent', color: '#525252',
                    border: '0.5px solid #2A2A2A', borderRadius: 7,
                    padding: '9px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  style={{
                    flex: 1,
                    background: saving ? '#1C1C1C' : glareGradient,
                    color: saving ? '#3D3D3D' : '#111111',
                    border: `0.5px solid ${saving ? '#2A2A2A' : '#484848'}`,
                    borderRadius: 7, padding: '9px',
                    fontSize: 13, fontWeight: 500,
                    cursor: saving ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {saving ? 'Setting up your workspace…' : 'Enter Aria →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

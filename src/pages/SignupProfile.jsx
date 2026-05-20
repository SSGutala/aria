import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { deriveAccountType, useProfile } from '../hooks/useProfile'
import { logAction } from '../lib/devlog'
import { ROLES, SENIORITY_LEVELS, INTENDED_USE_CASES, mapCustomRoleToSupported } from '../lib/roles'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

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
  const { profile, loading, saveProfile } = useProfile()

  // If profile already exists, skip straight to workspace
  useEffect(() => {
    if (!loading && profile?.onboarding_completed) {
      navigate('/workspace', { replace: true })
    }
  }, [profile, loading, navigate])

  // Step 1: identity
  const [fullName, setFullName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [department, setDepartment] = useState('')

  // Step 2: primary role
  const [selectedRole, setSelectedRole] = useState('')
  const [customRole, setCustomRole] = useState('')

  // Step 3: seniority
  const [seniority, setSeniority] = useState('')

  // Step 4: use cases
  const [useCases, setUseCases] = useState([])

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleUseCase(id) {
    if (id === 'agentic') return // coming soon
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
      const resolvedRole = selectedRole === 'other'
        ? (mapCustomRoleToSupported(customRole) || 'other')
        : selectedRole
      const finalCustomRole = selectedRole === 'other' ? customRole.trim() : null

      // Persist name to auth user metadata so it's readable anywhere.
      await supabase.auth.updateUser({ data: { full_name: fullName.trim() } })

      // Derive a work_category-ish label from the role so legacy code still works.
      const legacyWorkCategory = selectedRoleToLegacyCategory(resolvedRole)

      await saveProfile({
        full_name: fullName.trim(),
        job_title: jobTitle.trim(),
        company: company.trim() || null,
        department: department.trim() || null,
        selected_role: resolvedRole,
        custom_role: finalCustomRole,
        seniority_level: seniority,
        intended_use_cases: useCases,
        use_cases: useCases,            // mirror to legacy column
        work_category: legacyWorkCategory,
        onboarding_completed: true,
      })

      logAction('user.onboarding_completed', {
        role: resolvedRole,
        seniority,
        useCases,
        accountType: deriveAccountType(useCases),
      })
      localStorage.removeItem('aria_new_user')
      navigate('/workspace', { replace: true })
    } catch (err) {
      setError('Failed to save profile. Please try again.')
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', background: '#141414', border: '0.5px solid #2A2A2A',
    borderRadius: 7, color: '#F5F5F5', padding: '9px 12px',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  const primaryButton = (enabled, label, onClick, options = {}) => (
    <button
      onClick={onClick}
      disabled={!enabled || options.disabled}
      style={{
        flex: options.flex ?? 1,
        background: enabled && !options.disabled ? glareGradient : '#1C1C1C',
        color: enabled && !options.disabled ? '#111111' : '#3D3D3D',
        border: `0.5px solid ${enabled && !options.disabled ? '#484848' : '#2A2A2A'}`,
        borderRadius: 7, padding: '9px',
        fontSize: 13, fontWeight: 500,
        cursor: enabled && !options.disabled ? 'pointer' : 'default',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )

  const backButton = (
    <button
      onClick={() => setStep(s => Math.max(1, s - 1))}
      style={{
        background: 'transparent', color: '#525252',
        border: '0.5px solid #2A2A2A', borderRadius: 7,
        padding: '9px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      Back
    </button>
  )

  // Step validations
  const canAdvanceStep1 = fullName.trim() && jobTitle.trim()
  const canAdvanceStep2 = selectedRole && (selectedRole !== 'other' || customRole.trim().length >= 2)
  const canAdvanceStep3 = !!seniority
  const canAdvanceStep4 = useCases.length > 0

  return (
    <div style={{
      background: '#111111', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 520, padding: '0 16px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{
            fontSize: 22, fontWeight: 500, letterSpacing: '-0.4px',
            background: glareGradient, WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>aria.</span>
        </div>

        <div style={{ background: '#0D0D0D', border: '0.5px solid #2A2A2A', borderRadius: 14, padding: 28 }}>
          <StepIndicator current={step} total={5} />

          {/* ── Step 1: Tell us about yourself ───────────────────────────── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ color: '#F5F5F5', fontSize: 20, fontWeight: 500, margin: '0 0 6px' }}>Tell us about yourself</h2>
                <p style={{ color: '#525252', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  Helps Aria speak to you the way you actually work.
                </p>
              </div>

              <Field label="First and last name" required>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Sri Gutala" autoFocus style={inputStyle} />
              </Field>

              <Field label="Job title" required>
                <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Product Manager" style={inputStyle} />
              </Field>

              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Company (optional)" flex={1}>
                  <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                    placeholder="e.g. Acme Inc" style={inputStyle} />
                </Field>
                <Field label="Department (optional)" flex={1}>
                  <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                    placeholder="e.g. Platform" style={inputStyle} />
                </Field>
              </div>

              {primaryButton(canAdvanceStep1, 'Continue', () => setStep(2))}
            </div>
          )}

          {/* ── Step 2: Primary role ─────────────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ color: '#F5F5F5', fontSize: 20, fontWeight: 500, margin: '0 0 6px' }}>Select your primary role</h2>
                <p style={{ color: '#525252', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  Aria tailors questions, artifacts, and flows to this role.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {ROLES.map(role => {
                  const isSelected = selectedRole === role.id
                  return (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      style={{
                        background: isSelected ? '#1A1A1A' : '#141414',
                        border: `0.5px solid ${isSelected ? '#3D3D3D' : '#222'}`,
                        borderRadius: 8, padding: '10px 12px',
                        display: 'flex', alignItems: 'center', gap: 9,
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        transition: 'all 0.12s',
                      }}
                    >
                      <span style={{ fontSize: 15, lineHeight: 1 }}>{role.icon}</span>
                      <span style={{ fontSize: 12, color: isSelected ? '#E5E5E5' : '#737373', fontWeight: isSelected ? 500 : 400 }}>
                        {role.label}
                      </span>
                      {isSelected && <span style={{ marginLeft: 'auto', color: '#34D399', fontSize: 11 }}>✓</span>}
                    </button>
                  )
                })}
              </div>

              {selectedRole === 'other' && (
                <Field label="Describe your role">
                  <input
                    type="text" value={customRole} onChange={e => setCustomRole(e.target.value)}
                    placeholder="e.g. Revenue Operations Lead"
                    style={inputStyle} autoFocus
                  />
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#3D3D3D', lineHeight: 1.5 }}>
                    We'll map this to the closest supported flow when possible.
                  </p>
                </Field>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {backButton}
                {primaryButton(canAdvanceStep2, 'Continue', () => setStep(3))}
              </div>
            </div>
          )}

          {/* ── Step 3: Seniority ────────────────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ color: '#F5F5F5', fontSize: 20, fontWeight: 500, margin: '0 0 6px' }}>Select your seniority level</h2>
                <p style={{ color: '#525252', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  Determines question depth and artifact depth. Senior roles get strategic framing, junior roles get execution support.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SENIORITY_LEVELS.map(s => {
                  const isSelected = seniority === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSeniority(s.id)}
                      style={{
                        background: isSelected ? '#141414' : '#0D0D0D',
                        border: `0.5px solid ${isSelected ? '#3D3D3D' : '#1E1E1E'}`,
                        borderRadius: 10, padding: '12px 14px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: isSelected ? '#E5E5E5' : '#737373' }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: '#3D3D3D', marginTop: 2 }}>{s.description}</div>
                      </div>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        border: `0.5px solid ${isSelected ? '#34D399' : '#2A2A2A'}`,
                        background: isSelected ? '#0D2A1A' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399' }} />}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {backButton}
                {primaryButton(canAdvanceStep3, 'Continue', () => setStep(4))}
              </div>
            </div>
          )}

          {/* ── Step 4: Use cases ────────────────────────────────────────── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ color: '#F5F5F5', fontSize: 20, fontWeight: 500, margin: '0 0 6px' }}>What will you use Aria for?</h2>
                <p style={{ color: '#525252', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  Select all that apply. Influences what Aria offers first.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {INTENDED_USE_CASES.map(uc => {
                  const isSelected = useCases.includes(uc.id)
                  const disabled = uc.comingSoon
                  return (
                    <button
                      key={uc.id}
                      onClick={() => toggleUseCase(uc.id)}
                      disabled={disabled}
                      style={{
                        background: isSelected ? '#141414' : '#0D0D0D',
                        border: `0.5px solid ${isSelected ? '#3D3D3D' : '#1E1E1E'}`,
                        borderRadius: 10, padding: '12px 14px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        cursor: disabled ? 'default' : 'pointer',
                        textAlign: 'left', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
                      }}
                    >
                      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{uc.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: isSelected ? '#E5E5E5' : '#737373', marginBottom: 2 }}>
                          {uc.label}
                          {uc.comingSoon && <span style={{ marginLeft: 6, fontSize: 10, color: '#525252' }}>· Coming soon</span>}
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

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {backButton}
                {primaryButton(canAdvanceStep4, 'Continue', () => setStep(5))}
              </div>
            </div>
          )}

          {/* ── Step 5: Confirmation ─────────────────────────────────────── */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ color: '#F5F5F5', fontSize: 20, fontWeight: 500, margin: '0 0 6px' }}>
                  {fullName.trim() ? `${fullName.trim().split(' ')[0]}, your Aria is ready.` : 'Your Aria is ready'}
                </h2>
                <p style={{ color: '#525252', fontSize: 13, margin: 0 }}>
                  Here's how Aria will work for you. You can change any of this in Settings.
                </p>
              </div>

              <SummaryRow label="Role"
                value={selectedRole === 'other' ? (customRole || 'Custom role') : (ROLES.find(r => r.id === selectedRole)?.label || '—')} />
              <SummaryRow label="Seniority"
                value={SENIORITY_LEVELS.find(s => s.id === seniority)?.label || '—'} />
              <SummaryRow label="Job title" value={jobTitle || '—'} />
              {(company || department) && (
                <SummaryRow label="Organization" value={[company, department].filter(Boolean).join(' · ')} />
              )}
              <SummaryRow label="Use cases" value={
                useCases.map(id => INTENDED_USE_CASES.find(u => u.id === id)?.label).filter(Boolean).join(', ') || '—'
              } />

              {error && <p style={{ fontSize: 12, color: '#F87171', margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 8 }}>
                {backButton}
                {primaryButton(true, saving ? 'Setting up your workspace…' : 'Enter Aria →', handleFinish, { disabled: saving })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function Field({ label, required, flex, children }) {
  return (
    <div style={{ flex: flex ?? undefined }}>
      <label style={{
        display: 'block', fontSize: 11, color: '#A3A3A3', marginBottom: 6,
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        {label}{required && <span style={{ color: '#525252', marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 12,
      padding: '8px 0', borderBottom: '0.5px solid #1A1A1A',
    }}>
      <div style={{ width: 92, fontSize: 11, color: '#525252', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: '#E5E5E5' }}>{value}</div>
    </div>
  )
}

// Map a role id to the legacy work_category string used by older code paths.
function selectedRoleToLegacyCategory(roleId) {
  const map = {
    product_manager: 'product',
    technical_product_manager: 'product',
    project_manager: 'operations',
    program_manager: 'operations',
    software_engineer: 'engineering',
    it_systems_admin: 'engineering',
    it_support: 'operations',
    solutions_architect: 'engineering',
    sales_account_executive: 'leadership',
    other: 'leadership',
  }
  return map[roleId] || 'leadership'
}

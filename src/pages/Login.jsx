import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/devlog'

const glareGradient = 'linear-gradient(110deg, #4A4A4A 0%, #8A8A8A 18%, #FFFFFF 34%, #E8E8E8 44%, #9A9A9A 58%, #5A5A5A 78%, #888888 100%)'

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2l12 12M6.5 6.56A2 2 0 0010 10M4.15 4.17C2.38 5.36 1 8 1 8s2.5 5 7 5a6.84 6.84 0 003.85-1.17M6.5 3.14A6.56 6.56 0 018 3c4.5 0 7 5 7 5a11.6 11.6 0 01-1.67 2.35" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const inputStyle = {
  width: '100%',
  background: '#141414',
  border: '0.5px solid #2A2A2A',
  borderRadius: 7,
  color: '#F5F5F5',
  padding: '10px 12px',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

export default function Login({ session }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (session) navigate('/workspace', { replace: true })
  }, [session, navigate])

  function switchMode(next) {
    setMode(next)
    setError('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          const msg = error.message?.toLowerCase() || ''
          if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('wrong password')) {
            throw new Error('Incorrect password. Please try again.')
          }
          if (msg.includes('user not found') || msg.includes('no user') || msg.includes('email not found')) {
            throw new Error('No account found with that email address.')
          }
          // Supabase returns "Invalid login credentials" for both wrong password
          // and non-existent account — try to distinguish by checking if email exists
          if (msg.includes('invalid login credentials')) {
            const { data: methods } = await supabase.auth.signInWithOtp({ email, shouldCreateUser: false }).catch(() => ({ data: null }))
            throw new Error('No account found with that email address, or the password is incorrect.')
          }
          throw error
        }
        // Check if they've completed profile setup
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          logAction('user.signed_in', { email })
          const { data: profile, error: profileError } = await supabase.from('profiles').select('id, onboarding_completed').eq('id', user.id).maybeSingle()
          // Redirect to signup if no profile exists OR onboarding hasn't been completed yet
          if (!profileError && (!profile || !profile.onboarding_completed)) {
            navigate('/signup/profile', { replace: true })
            return
          }
        }
        navigate('/workspace', { replace: true })
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        logAction('user.signed_up', { email })
        // Go straight into profile setup — no email confirmation required in dev
        navigate('/signup/profile', { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: '#111111', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{
            fontSize: 26, fontWeight: 500, letterSpacing: '-0.5px',
            background: glareGradient,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>aria.</span>
          <p style={{ color: '#3D3D3D', fontSize: 12, marginTop: 6 }}>
            Enterprise app builder
          </p>
        </div>

        {/* Sign in / Create account tabs */}
        <div style={{
          display: 'flex', background: '#0D0D0D',
          border: '0.5px solid #1E1E1E', borderRadius: 10,
          padding: 3, marginBottom: 20,
        }}>
          {[
            { id: 'login', label: 'Sign in' },
            { id: 'signup', label: 'Create account' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => switchMode(tab.id)}
              style={{
                flex: 1, padding: '8px 10px',
                background: mode === tab.id ? '#1C1C1C' : 'transparent',
                border: mode === tab.id ? '0.5px solid #2A2A2A' : '0.5px solid transparent',
                borderRadius: 7,
                color: mode === tab.id ? '#D4D4D4' : '#525252',
                fontSize: 13, fontWeight: mode === tab.id ? 500 : 400,
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form card */}
        <div style={{
          background: '#0D0D0D', border: '0.5px solid #1E1E1E',
          borderRadius: 14, padding: 24,
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#737373', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#737373', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Minimum 8 characters' : '••••••••'}
                  required
                  style={{ ...inputStyle, paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#525252', padding: 2, display: 'flex', alignItems: 'center' }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#737373', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Confirm password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{ ...inputStyle, paddingRight: 38 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(p => !p)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#525252', padding: 2, display: 'flex', alignItems: 'center' }}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div style={{
                background: '#1A0808', border: '0.5px solid #3A1515',
                borderRadius: 7, padding: '8px 12px',
                fontSize: 12, color: '#F87171', lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#1C1C1C' : glareGradient,
                color: loading ? '#3D3D3D' : '#111111',
                border: `0.5px solid ${loading ? '#2A2A2A' : '#484848'}`,
                borderRadius: 7, padding: '10px',
                fontSize: 13, fontWeight: 500,
                cursor: loading ? 'default' : 'pointer',
                marginTop: 4, fontFamily: 'inherit',
              }}
            >
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign in' : 'Create account →')}
            </button>

          </form>
        </div>

        {/* Hint below form */}
        {mode === 'signup' && (
          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: '#3D3D3D', lineHeight: 1.7 }}>
            After creating your account you'll set up your role<br />
            and preferences — takes about 30 seconds.
          </p>
        )}

      </div>
    </div>
  )
}

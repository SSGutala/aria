import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Derives account type from use case selections
export function deriveAccountType(useCases = []) {
  if (!useCases.length) return 'full_access'
  if (useCases.includes('all')) return 'full_access'
  const hasApps = useCases.includes('apps')
  const hasAutomation = useCases.includes('automation')
  const hasDocs = useCases.includes('docs')
  const hasDashboards = useCases.includes('dashboards')
  const selected = [hasApps, hasAutomation, hasDocs, hasDashboards].filter(Boolean).length
  if (selected >= 2) return 'full_access'
  if (hasApps || hasDashboards) return 'builder'
  if (hasAutomation) return 'automator'
  if (hasDocs) return 'strategist'
  return 'full_access'
}

// Maps account type to the default build mode shown in BuildModeCard
export function getDefaultBuildMode(accountType, workCategory) {
  if (accountType === 'builder') return 'quick'
  if (accountType === 'automator') return 'guided'
  if (accountType === 'strategist') {
    // Check if their work category suggests a specific role
    const roleMap = {
      'product': 'product_manager',
      'finance': 'finance',
      'hr': 'hr',
      'compliance': 'compliance',
      'it': 'it_admin',
      'operations': 'operations',
    }
    for (const [key, role] of Object.entries(roleMap)) {
      if (workCategory?.toLowerCase().includes(key)) return role
    }
    return 'product_manager'
  }
  return null // full_access: AI decides per prompt
}

export function useProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(data || null)
    setLoading(false)
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])

  const saveProfile = useCallback(async (updates) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const accountType = deriveAccountType(updates.use_cases)
    const payload = { id: user.id, ...updates, account_type: accountType, updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from('profiles').upsert(payload).select().single()
    if (!error) setProfile(data)
    return error ? null : data
  }, [])

  return { profile, loading, saveProfile, reload: loadProfile }
}

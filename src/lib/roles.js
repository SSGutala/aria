// ─── Aria Role Catalog ───────────────────────────────────────────────────────
// Single source of truth (frontend side) for supported roles, seniority
// levels, and intended use cases. Mirrored on the backend at
// api/lib/roles.js so prompts and orchestration can read the same labels.

export const ROLES = [
  { id: 'product_manager',           label: 'Product Manager',            icon: '📋', short: 'PM' },
  { id: 'technical_product_manager', label: 'Technical Product Manager',  icon: '⚙️', short: 'TPM' },
  { id: 'project_manager',           label: 'Project Manager',            icon: '🗂️', short: 'PjM' },
  { id: 'program_manager',           label: 'Program Manager',            icon: '🧭', short: 'PgM' },
  { id: 'software_engineer',         label: 'Software Engineer',          icon: '💻', short: 'SWE' },
  { id: 'it_systems_admin',          label: 'IT Team / Systems Admin',    icon: '🖥️', short: 'IT' },
  { id: 'it_support',                label: 'IT Support',                 icon: '🛠️', short: 'Support' },
  { id: 'solutions_architect',       label: 'Solutions Architect',        icon: '🏛️', short: 'SA' },
  { id: 'sales_account_executive',   label: 'Sales / Account Executive',  icon: '💼', short: 'AE' },
  { id: 'other',                     label: 'Other / Not sure',           icon: '✦',  short: 'Custom' },
]

export const SENIORITY_LEVELS = [
  { id: 'junior',   label: 'Junior / IC',         description: 'Hands-on execution, ramping up' },
  { id: 'mid',      label: 'Mid-Level',           description: 'Independent delivery on most work' },
  { id: 'senior',   label: 'Senior / Lead',       description: 'Owns scope and quality end-to-end' },
  { id: 'director', label: 'Manager / Director+', description: 'Sets direction, manages portfolio' },
]

export const INTENDED_USE_CASES = [
  { id: 'apps',       icon: '🏗️', label: 'Internal tools & apps',
    description: 'Build and deploy web apps for your team' },
  { id: 'automation', icon: '⚙️', label: 'Workflow automations',
    description: 'Automate manual processes, approvals, and system actions' },
  { id: 'docs',       icon: '📄', label: 'Documentation / artifacts',
    description: 'Generate PRDs, specs, SOPs, reports, decks, and role-specific documents' },
  { id: 'dashboards', icon: '📊', label: 'Dashboards & reporting',
    description: 'Create KPI trackers, reporting tools, and analytics views' },
  { id: 'all',        icon: '🚀', label: 'All of the above / exploring',
    description: 'Show me everything Aria can do' },
  { id: 'agentic',    icon: '🤖', label: 'Agentic workflows',
    description: 'AI agents for triage, routing, analysis, and task execution',
    comingSoon: true },
]

// Map a free-text custom role to the closest supported role id, or null.
export function mapCustomRoleToSupported(text) {
  if (!text) return null
  const t = text.toLowerCase()
  const rules = [
    [/technical\s+product/, 'technical_product_manager'],
    [/\bpm\b|product\s+manager/, 'product_manager'],
    [/program\s+manager/, 'program_manager'],
    [/project\s+manager|\bpmo\b/, 'project_manager'],
    [/solutions?\s+architect|enterprise\s+architect/, 'solutions_architect'],
    [/devops|sre|software|engineer|developer|backend|frontend|full.?stack/, 'software_engineer'],
    [/it\s*support|help\s*desk|service\s*desk/, 'it_support'],
    [/sys.?admin|it\s+admin|infrastructure|network/, 'it_systems_admin'],
    [/sales|account\s+(executive|manager)|\bae\b|business\s+dev/, 'sales_account_executive'],
  ]
  for (const [re, id] of rules) if (re.test(t)) return id
  return null
}

export function getRole(id) {
  return ROLES.find(r => r.id === id) || null
}

export function getSeniority(id) {
  return SENIORITY_LEVELS.find(s => s.id === id) || null
}

// Derive a friendly display label for a profile's role.
export function formatRoleLabel(profile) {
  if (!profile) return ''
  if (profile.selected_role && profile.selected_role !== 'other') {
    return getRole(profile.selected_role)?.label || profile.selected_role
  }
  return profile.custom_role || 'Custom role'
}

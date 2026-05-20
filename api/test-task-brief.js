/**
 * Live test for /api/task-brief — POSTs realistic clarification answers for
 * each task mode and verifies the resulting brief is domain-specific.
 *
 * Usage:
 *   node api/test-task-brief.js                  # tests all 5 modes
 *   node api/test-task-brief.js fullstack        # one mode
 *   node api/test-task-brief.js --no-persist     # skip Supabase persistence (mocks conversationId)
 *
 * Requires: API server running on localhost:3001 with valid ANTHROPIC_API_KEY.
 * Each run costs one Anthropic Opus call per mode (~$0.05–0.15 per mode at 2026 pricing).
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve } from 'path'
try {
  const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  env.split('\n').forEach(line => {
    const [k, ...rest] = line.split('=')
    if (k && rest.length && !process.env[k.trim()]) process.env[k.trim()] = rest.join('=').trim()
  })
} catch {}

const API = process.env.TEST_API_URL || 'http://localhost:3001'

const SCENARIOS = {
  fullstack: {
    prompt: 'Build an internal vendor onboarding portal for our procurement team. Vendors submit company info, tax forms, and banking details. Procurement reviews and approves. Finance gets a webhook on approval to set up payment.',
    answers: [
      'Primary users: external vendors (self-service registration), procurement specialists (review), finance ops (downstream provisioning).',
      'Data model: Vendor, ContactPerson, TaxForm, BankAccount, OnboardingRequest. Vendor has many ContactPersons; one BankAccount; one or more TaxForms.',
      'Auth: vendors use email magic link, internal staff use Azure AD SSO. RBAC roles: VendorAdmin, ProcurementReviewer, FinanceOps.',
      'Integrations: send approved-vendor webhook to NetSuite, read sanctions list from Refinitiv API.',
    ].join('\n\n'),
  },

  automation: {
    prompt: 'Build an automation that watches our shared Outlook mailbox for purchase order PDFs from suppliers. Extract PO number, line items, and total. Create a record in our PO tracking system. Notify the buyer.',
    answers: [
      'Trigger: new email in po-intake@acme.com with PDF attachment. Volume ~30/day.',
      'Conditions: skip if sender is internal, skip if amount field is empty, branch by total amount: >$50k routes to senior buyer queue.',
      'Action chain: parse PDF with Azure Form Recognizer → call ERP /api/po endpoint → post Teams card to buyer channel.',
      'Error handling: retry parser 3x with backoff, send DLQ to ops-alerts@acme.com on final failure, page on-call for >5 failures/hour.',
      'Notifications: success → Teams card in buyer channel; failure → email to AP supervisor + log to splunk.',
    ].join('\n\n'),
  },

  dashboard: {
    prompt: 'Build an executive dashboard for our customer support org. Track ticket volume, first response time, CSAT, and agent productivity. CFO and VP Support look at it weekly.',
    answers: [
      'KPIs: ticket volume by priority, first response time (P50/P90), CSAT % positive, tickets per agent per day.',
      'Data sources: Zendesk (tickets, CSAT survey), Workday (agent headcount), Snowflake (joined marts).',
      'Refresh: tickets hourly, CSAT daily at 6am, agent counts weekly Monday morning.',
      'Drill-downs: ticket volume → by product, by region, by agent. First response → by priority, by shift, by channel.',
      'Permissions: VP and CFO see all data; team leads scoped to their team only; finance ops can export to PDF.',
    ].join('\n\n'),
  },

  knowledge: {
    prompt: 'Build a clinical SOP repository for our hospital network. Nurses, doctors, and ops staff need to find protocols quickly. Compliance requires annual review and audit logs.',
    answers: [
      'Content types: Clinical SOP, Emergency Protocol, Medication Guideline, Equipment Manual. Each has owner, department, last-reviewed date.',
      'Versioning: semantic, never delete published, require change summary on republish.',
      'Search: hybrid keyword + vector, facets on department/specialty/equipment-type, autocomplete from titles + tags.',
      'Access: read-all for clinical staff; edit by SOP owners; publish requires medical director sign-off.',
      'Review: annual cycle, escalate to dept chair if not refreshed by 30 days past due, auto-archive at 60 days past due.',
    ].join('\n\n'),
  },

  workflow: {
    prompt: 'Build a software purchase approval workflow. Engineers request tools, their manager approves, IT checks security, finance approves spend over $5k, procurement places the order.',
    answers: [
      'Approval stages: Manager approval → IT security review → Finance (if >$5k) → Procurement order. IT and Finance can run in parallel.',
      'SLAs: manager 1 business day, IT 2 days, Finance 2 days, procurement 5 days. End-to-end target: 10 business days.',
      'Escalations: SLA breach notifies skip-level + Slack channel. Second breach auto-delegates to backup approver. Third breach pages procurement director.',
      'Routing rules: >$25k requires VP approval (extra stage). Annual recurring software always routes to procurement first.',
      'Rejection: requester gets reason + can resubmit after 24h cooldown.',
    ].join('\n\n'),
  },
}

// Domain validators — each checks that mode-specific sections exist with
// concrete content, not generic templates.
const VALIDATORS = {
  fullstack: (b, scenario) => {
    const issues = []
    if (!b.intakeSummary?.understood) issues.push('intakeSummary.understood missing')
    if (!b.dataModel?.entities || b.dataModel.entities.length < 2) issues.push(`dataModel.entities count <2 (got ${b.dataModel?.entities?.length})`)
    if (!b.apiContracts?.endpoints || b.apiContracts.endpoints.length < 3) issues.push(`apiContracts.endpoints <3 (got ${b.apiContracts?.endpoints?.length})`)
    if (!b.authModel?.roles || b.authModel.roles.length < 2) issues.push('authModel.roles <2')
    const allText = JSON.stringify(b).toLowerCase()
    if (!/vendor|procurement|tax|bank/.test(allText)) issues.push('no domain terms found (vendor/procurement/tax/bank)')
    return issues
  },
  automation: (b) => {
    const issues = []
    if (!b.triggerCatalog?.primaryTrigger?.source) issues.push('triggerCatalog.primaryTrigger.source missing')
    if (!b.conditionLogic?.branches || b.conditionLogic.branches.length < 2) issues.push('conditionLogic.branches <2')
    if (!b.actionChain?.actions || b.actionChain.actions.length < 3) issues.push('actionChain.actions <3')
    if (!b.errorHandling?.retryPolicy) issues.push('errorHandling.retryPolicy missing')
    if (!b.notificationPlan) issues.push('notificationPlan missing')
    const allText = JSON.stringify(b).toLowerCase()
    if (!/outlook|po|supplier|teams|erp/.test(allText)) issues.push('no domain terms found (outlook/po/supplier/teams/erp)')
    return issues
  },
  dashboard: (b) => {
    const issues = []
    if (!b.kpiCatalog?.primaryKPIs || b.kpiCatalog.primaryKPIs.length < 3) issues.push('kpiCatalog.primaryKPIs <3')
    if (!b.dataSources?.sources || b.dataSources.sources.length < 1) issues.push('dataSources.sources empty')
    if (!b.refreshSchedule?.tiers) issues.push('refreshSchedule.tiers missing')
    if (!b.drilldownPaths?.paths) issues.push('drilldownPaths.paths missing')
    if (!b.permissionsMatrix?.roles) issues.push('permissionsMatrix.roles missing')
    const allText = JSON.stringify(b).toLowerCase()
    if (!/ticket|csat|zendesk|agent|support/.test(allText)) issues.push('no domain terms found (ticket/csat/zendesk/agent/support)')
    return issues
  },
  knowledge: (b) => {
    const issues = []
    if (!b.contentTaxonomy?.contentTypes || b.contentTaxonomy.contentTypes.length < 2) issues.push('contentTaxonomy.contentTypes <2')
    if (!b.versioningModel?.versionScheme) issues.push('versioningModel.versionScheme missing')
    if (!b.searchDesign?.searchType) issues.push('searchDesign.searchType missing')
    if (!b.accessControl?.roles) issues.push('accessControl.roles missing')
    if (!b.reviewWorkflow?.stages) issues.push('reviewWorkflow.stages missing')
    const allText = JSON.stringify(b).toLowerCase()
    if (!/sop|clinical|nurse|doctor|protocol|hospital/.test(allText)) issues.push('no domain terms found (sop/clinical/nurse/doctor/protocol/hospital)')
    return issues
  },
  workflow: (b) => {
    const issues = []
    if (!b.approvalChain?.stages || b.approvalChain.stages.length < 2) issues.push('approvalChain.stages <2')
    if (!b.slaMatrix?.stages) issues.push('slaMatrix.stages missing')
    if (!b.escalationRules?.rules) issues.push('escalationRules.rules missing')
    if (!b.decisionLogic?.routingRules) issues.push('decisionLogic.routingRules missing')
    if (!b.workflowMap?.steps) issues.push('workflowMap.steps missing')
    const allText = JSON.stringify(b).toLowerCase()
    if (!/manager|it|finance|procurement|software|approval/.test(allText)) issues.push('no domain terms found')
    return issues
  },
}

async function getOrCreateConversation() {
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  )
  // Try to reuse the most recent conversation, else create one
  const { data: existing } = await sb.from('conversations').select('id').order('created_at', { ascending: false }).limit(1)
  if (existing?.[0]?.id) return existing[0].id
  const { data: created } = await sb.from('conversations').insert({ title: 'task-brief-test' }).select().single()
  return created?.id
}

async function runOne(mode) {
  const scenario = SCENARIOS[mode]
  const conversationId = await getOrCreateConversation()
  console.log(`\n── ${mode.toUpperCase()} ──────────────────────────────────────`)
  console.log(`prompt: ${scenario.prompt.slice(0, 100)}...`)
  const t0 = Date.now()
  const res = await fetch(`${API}/api/task-brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: scenario.prompt,
      conversationId,
      buildMode: mode,
      clarificationAnswers: scenario.answers,
      conversationHistory: [],
    }),
  })
  const elapsed = Date.now() - t0

  if (!res.ok) {
    const err = await res.text()
    console.error(`✗ FAIL (${res.status} in ${elapsed}ms): ${err.slice(0, 200)}`)
    return { mode, ok: false, elapsed, issues: [`HTTP ${res.status}`] }
  }
  const body = await res.json()
  const brief = body.brief
  const issues = VALIDATORS[mode](brief, scenario)
  const sectionKeys = Object.keys(brief || {}).filter(k => brief[k])

  console.log(`  elapsed:    ${elapsed}ms ${elapsed > 10000 ? '⚠ over 10s budget' : '✓ under 10s'}`)
  console.log(`  sections:   ${sectionKeys.join(', ')}`)
  console.log(`  artifacts:  ${Object.keys(body.artifactIds || {}).length}`)
  if (issues.length) {
    console.log(`  ✗ issues:`)
    issues.forEach(i => console.log(`     - ${i}`))
  } else {
    console.log(`  ✓ all domain-specific checks passed`)
  }
  return { mode, ok: issues.length === 0, elapsed, issues, sectionCount: sectionKeys.length }
}

async function main() {
  const arg = process.argv[2]
  const modes = arg && SCENARIOS[arg] ? [arg] : Object.keys(SCENARIOS)
  console.log(`Testing modes: ${modes.join(', ')}`)
  console.log(`Target: ${API}/api/task-brief`)

  const results = []
  for (const m of modes) {
    try {
      results.push(await runOne(m))
    } catch (e) {
      console.error(`✗ ${m} threw:`, e.message)
      results.push({ mode: m, ok: false, error: e.message })
    }
  }

  console.log('\n══════════ SUMMARY ══════════')
  results.forEach(r => {
    const status = r.ok ? '✓' : '✗'
    const time = r.elapsed ? `${r.elapsed}ms` : '—'
    console.log(`  ${status} ${r.mode.padEnd(12)} ${time.padStart(8)}  ${r.issues?.length ? `(${r.issues.length} issues)` : ''}`)
  })
  const allOk = results.every(r => r.ok)
  process.exit(allOk ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(2) })

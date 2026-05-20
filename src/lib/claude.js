import { apiCall } from '../utils/errorHandler'

const MOCK_MODE = !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ─── Active role context ──────────────────────────────────────────────────
// Workspace sets this whenever a conversation is loaded so the backend can
// tailor every prompt to the user's role/seniority/use-cases without us
// having to thread the context through every API function signature.
let _activeRoleContext = null
export function setActiveRoleContext(ctx) { _activeRoleContext = ctx || null }
export function getActiveRoleContext() { return _activeRoleContext }

async function postJSON(path, body, action, config = {}, aiModel = 'claude') {
  const bodyWithModel = {
    ...body,
    aiModel,
    ...(_activeRoleContext ? { roleContext: _activeRoleContext } : {}),
  }
  const res = await apiCall(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyWithModel),
  }, { context: { action }, ...config })
  return res.json()
}

async function patchJSON(path, body, action, config = {}) {
  const res = await apiCall(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, { context: { action }, ...config })
  return res.json()
}

async function getJSON(path, action, config = {}) {
  const res = await apiCall(`${API_URL}${path}`, {}, { context: { action }, ...config })
  return res.json()
}

function slugify(title) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${base}-${rand}`
}

function classifyPrompt(prompt) {
  const p = prompt.toLowerCase()
  if (p.includes('approv') || p.includes('request') || p.includes('pto') || p.includes('budget') || p.includes('vendor') || p.includes('access')) return 'approval_workflow'
  if (p.includes('bug') || p.includes('issue') || p.includes('incident') || p.includes('ticket') || p.includes('escalat') || p.includes('intake')) return 'intake_tracker'
  return 'status_board'
}

function buildSchema(prompt, workflowType) {
  const p = prompt.toLowerCase()

  const statusMap = {
    approval_workflow: ['Pending Review', 'Approved', 'Rejected'],
    intake_tracker: ['New', 'In Progress', 'Resolved', 'Closed'],
    status_board: ['Active', 'In Progress', 'Complete', 'On Hold'],
  }
  const statusOptions = statusMap[workflowType]

  const titleMap = {
    approval_workflow: 'Asset Request Tracker',
    intake_tracker: 'Issue Intake Tracker',
    status_board: 'Project Status Board',
  }

  // Detect specific fields from prompt
  const fields = []

  if (p.includes('asset')) {
    fields.push({ name: 'asset_type', label: 'Asset Type', type: 'select', required: true, options: ['Laptop', 'Monitor', 'Phone', 'Tablet', 'Peripheral', 'Software License', 'Other'] })
  }
  if (p.includes('requester') || p.includes('name')) {
    fields.push({ name: 'requester_name', label: 'Requester Name', type: 'text', required: true, options: [] })
  }
  if (p.includes('email') || p.includes('confirmation email')) {
    fields.push({ name: 'requester_email', label: 'Requester Email', type: 'email', required: true, options: [] })
  }
  if (p.includes('priority')) {
    fields.push({ name: 'priority', label: 'Priority', type: 'select', required: true, options: ['Standard', 'Critical'] })
  }
  if (p.includes('justif')) {
    fields.push({ name: 'justification', label: 'Justification', type: 'textarea', required: true, options: [] })
  }
  if (p.includes('department') || p.includes('dept')) {
    fields.push({ name: 'department', label: 'Department', type: 'text', required: false, options: [] })
  }

  // fallback generic fields
  if (fields.length < 3) {
    if (!fields.find(f => f.name === 'requester_name'))
      fields.push({ name: 'requester_name', label: 'Requester Name', type: 'text', required: true, options: [] })
    if (!fields.find(f => f.name === 'requester_email'))
      fields.push({ name: 'requester_email', label: 'Requester Email', type: 'email', required: true, options: [] })
    fields.push({ name: 'description', label: 'Description', type: 'textarea', required: true, options: [] })
  }

  fields.push({ name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions })

  // Determine notification config
  const hasPriority = fields.find(f => f.name === 'priority')
  const emailField = fields.find(f => f.type === 'email')

  return {
    appTitle: titleMap[workflowType],
    workflowType,
    fields,
    statusOptions,
    defaultStatus: statusOptions[0],
    primaryActionLabel: 'Submit Request',
    notificationConfig: {
      sendConfirmationToSubmitter: !!emailField,
      submitterEmailField: emailField?.name || null,
      notifyOnSubmission: true,
      notifyEmails: [],
      priorityRouting: !!hasPriority,
      priorityField: hasPriority?.name || null,
      priorityRules: hasPriority ? [
        { value: 'Critical', emails: [] },
        { value: 'Standard', emails: [] },
      ] : [],
    },
  }
}

async function mockGenerate(prompt, conversationId) {
  await new Promise(r => setTimeout(r, 1800))

  const workflowType = classifyPrompt(prompt)
  const schema = buildSchema(prompt, workflowType)
  const slug = slugify(schema.appTitle)
  const tableName = 'app_' + slug.replace(/-/g, '_')

  // save to mock db via supabase module
  const { supabase } = await import('./supabase.js')

  const conv = await supabase.from('conversations').select('*').eq('id', conversationId).single()
  const userId = conv.data?.user_id || 'mock-user-id'

  const { data: appData } = await supabase.from('generated_apps').insert({
    conversation_id: conversationId,
    user_id: userId,
    title: schema.appTitle,
    workflow_type: workflowType,
    schema,
    table_name: tableName,
    notification_config: schema.notificationConfig,
    status: 'deployed',
    slug,
  }).select().single()

  const confirmMsg = `Building your **${schema.appTitle}** with fields for ${schema.fields.slice(0, 3).map(f => f.label).join(', ')}. Generating now...`

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: confirmMsg,
    message_type: 'confirmation',
    metadata: {},
  })

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: '',
    message_type: 'app_card',
    metadata: { schema, slug, appId: appData?.id },
  })

  await supabase.from('conversations').update({
    title: schema.appTitle,
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId)

  return { type: 'app_card', schema, slug, appId: appData?.id }
}

async function mockSubmit(appId, formData) {
  await new Promise(r => setTimeout(r, 600))
  const { supabase } = await import('./supabase.js')

  const { data: app } = await supabase.from('generated_apps').select('*').eq('id', appId).single()
  const { count } = await supabase.from('app_submissions').select('*', { count: 'exact', head: true }).eq('app_id', appId)

  const prefix = (app?.title || 'APP').split(/\s+/).map(w => w[0]?.toUpperCase() || '').join('').slice(0, 4) || 'APP'
  const ticketId = `${prefix}-${String((count || 0) + 1).padStart(3, '0')}`
  const schema = app?.schema || {}
  const defaultStatus = schema.defaultStatus || (schema.statusOptions?.[0]) || 'Pending'

  const { data: submission } = await supabase.from('app_submissions').insert({
    app_id: appId,
    ticket_id: ticketId,
    data: formData,
    status: defaultStatus,
  }).select().single()

  return { success: true, ticketId, submission }
}

async function mockUpdateStatus(submissionId, newStatus, appId) {
  await new Promise(r => setTimeout(r, 300))
  const { supabase } = await import('./supabase.js')
  await supabase.from('app_submissions').update({ status: newStatus }).eq('id', submissionId)
  return { success: true }
}

export async function generateApp(prompt, conversationId, messages, clarificationAnswers = null, aiModel = 'claude') {
  if (MOCK_MODE) return mockGenerate(prompt, conversationId)

  // Pass last 10 messages as conversation history for memory
  const conversationHistory = (messages || []).slice(-10).map(m => ({
    role: m.role,
    content: m.content || '',
  }))

  return postJSON('/api/generate',
    { prompt, conversationId, messages, clarificationAnswers, conversationHistory },
    'generating your app',
    {},
    aiModel)
}

// Engine-specific question generation
export async function getEngineQuestions(prompt, conversationId, engine, docType = null, conversationHistory = [], aiModel = 'claude') {
  const body = { prompt, conversationId, engine, conversationHistory }
  if (docType) body.docType = docType
  return postJSON('/api/generate', body, 'preparing questions', {}, aiModel)
}

// Phase 1: analyze prompt and return engine_intake (engine classification)
export async function analyzeAndQuestion(prompt, conversationId, conversationHistory = [], aiModel = 'claude', userMemories = []) {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 1000))
    return {
      type: 'clarification_v2',
      intro: 'Got it — a few questions before I start building.',
      outputType: 'brief',
      buildMode: 'general',
      questions: [
        { type: 'multiple_choice', question: 'Who are the primary users of this tool?', options: ['Employees (self-service)', 'Managers / approvers', 'Both'] },
        { type: 'short_answer', question: 'What is the current manual process this replaces?', placeholder: 'e.g. spreadsheet, email chain, SharePoint form...' },
        { type: 'multi_select', question: 'What approvals or integrations are needed?', options: ['Manager approval', 'Email notifications', 'Microsoft 365 / Teams', 'No integrations yet'] },
        { type: 'yes_no', question: 'Are there compliance or audit requirements?' },
      ],
    }
  }
  return postJSON('/api/generate',
    { prompt, conversationId, conversationHistory, userMemories },
    'analyzing your request',
    {},
    aiModel)
}

// Backwards-compatible alias (used in some older flows)
export async function analyzeBuildMode(prompt, conversationId, conversationHistory = [], aiModel = 'claude') {
  return analyzeAndQuestion(prompt, conversationId, conversationHistory, aiModel)
}

// Phase 2 (PM): select PM package (no pmPackage yet) or get questions (with pmPackage)
export async function getPMPackageOrQuestions(prompt, conversationId, pmPackage = null, conversationHistory = [], aiModel = 'claude') {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 600))
    if (!pmPackage) return { type: 'pm_package', intro: 'I\'ll generate a full PM document package for this project.' }
    return {
      type: 'clarification_v2',
      intro: `Perfect, setting up ${pmPackage} PM package. A few questions before I generate your docs:`,
      buildMode: 'product_manager',
      pmPackage,
      questions: [
        { type: 'multiple_choice', question: 'Who are the primary users?', options: ['Employees (self-service)', 'Managers / approvers', 'Both'] },
        { type: 'short_answer', question: 'What is the current manual process this replaces?', placeholder: 'e.g. spreadsheet, email chain, SharePoint form...' },
        { type: 'multi_select', question: 'Which integrations are needed?', options: ['Microsoft 365 / Teams', 'Email notifications', 'SharePoint', 'No integrations yet'] },
        { type: 'yes_no', question: 'Are there compliance or audit requirements?' },
        { type: 'short_answer', question: 'What is the target launch timeline?', placeholder: 'e.g. 6 weeks, Q3 2025...' },
      ],
    }
  }
  const body = { prompt, conversationId, buildMode: 'product_manager', conversationHistory }
  if (pmPackage) body.pmPackage = pmPackage
  return postJSON('/api/generate', body, 'preparing PM questions', {}, aiModel)
}

// Phase 2: with build mode selected, get clarification questions
export async function getModeQuestions(prompt, conversationId, buildMode, conversationHistory = [], aiModel = 'claude') {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 800))
    if (buildMode === 'quick') return { type: 'clarification', intro: 'Two quick questions:', questions: [{ type: 'multiple_choice', question: 'Who primarily uses this?', options: ['Single team', 'Multiple departments', 'External users'] }], buildMode: 'quick' }
    return {
      type: 'clarification_v2',
      intro: 'Let me understand this more deeply.',
      buildMode,
      questions: [
        { type: 'multiple_choice', question: 'Who submits requests?', options: ['Employees self-serve', 'Managers submit on behalf', 'Both'] },
        { type: 'multi_select', question: 'What approval steps are needed?', options: ['Manager approval', 'Finance review', 'Legal sign-off', 'Executive sign-off'] },
        { type: 'yes_no', question: 'Does this need email notifications?' },
        { type: 'short_answer', question: 'What system stores the final records?', placeholder: 'e.g. SharePoint, SAP, internal database...' },
      ],
    }
  }
  return postJSON('/api/generate',
    { prompt, conversationId, buildMode, conversationHistory },
    'preparing clarification questions',
    {},
    aiModel)
}

// Generate full enterprise brief (guided + docs modes)
export async function generateBrief(prompt, conversationId, buildMode, clarificationAnswers = null, conversationHistory = [], aiModel = 'claude') {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 2000))
    return {
      buildMode,
      brief: {
        intakeSummary: { understood: 'Mock brief for testing.', businessProblem: 'Teams use email chains to track approvals.', primaryUsers: ['Requesters', 'Approvers'], secondaryUsers: ['Admins'], currentProcess: 'Email chains and spreadsheets', mainOutcome: 'Centralized, auditable approval workflow' },
        productBrief: { objective: 'Eliminate email-based approval tracking.', userRoles: [{ role: 'Requester', access: 'Submit and track own requests', estimated: '50+' }, { role: 'Approver', access: 'Review and approve/reject', estimated: '5' }], coreWorkflows: ['Submit request → route to approver → approve/reject → notify'], businessRules: ['Only managers can approve', 'Auto-escalate after 48 hours'], successCriteria: ['90% of requests processed in <24 hours'], assumptions: ['Single approval level initially'], openQuestions: ['Do we need multi-level approval?'] },
        workflowMap: { trigger: 'Employee submits request form', steps: [{ step: 'Submit', actor: 'Requester', action: 'Fill and submit request form', output: 'New request record', sla: null }, { step: 'Review', actor: 'Approver', action: 'Review request details', output: 'Decision', sla: '24 hours' }, { step: 'Notify', actor: 'System', action: 'Send email notification', output: 'Confirmation email', sla: null }], decisionPoints: ['Approved → send confirmation and close', 'Rejected → notify with reason'], exceptionPaths: ['No response after 48h → escalate to manager'] },
        dataModel: { primaryEntity: 'Request', fields: [{ name: 'title', label: 'Request Title', type: 'text', required: true, options: [] }, { name: 'description', label: 'Description', type: 'textarea', required: true, options: [] }, { name: 'requester', label: 'Requester Name', type: 'text', required: true, options: [] }, { name: 'status', label: 'Status', type: 'select', required: true, options: ['Pending', 'Approved', 'Rejected'] }], statusFlow: ['Pending Review', 'Under Review', 'Approved', 'Rejected'], relationships: [], auditFields: ['created_at', 'created_by', 'updated_at'] },
        automationModel: { triggers: [{ event: 'New request submitted', condition: 'Always', action: 'Notify assigned approver' }], notifications: [{ event: 'Request submitted', recipient: 'Approver', channel: 'Email', template: 'New request awaiting your review' }], escalations: [{ condition: 'No action after 48 hours', action: 'Escalate to manager', recipient: 'Department manager' }], documentGeneration: [], integrations: [] },
        uxRecommendation: { layoutType: 'split_panel_review', navigationModel: 'Single page', primaryScreens: [{ screen: 'Request Queue', purpose: 'Review pending requests', keyActions: ['Approve', 'Reject', 'View details'] }], visualTheme: { mood: 'authoritative', primaryColor: '#4F46E5', colorName: 'deep indigo', rationale: 'Approval tools need to feel authoritative and trustworthy' }, rationale: 'Split panel is ideal for review queues — list on left, detail + actions on right' },
        appSpec: { appTitle: 'Approval Hub', appType: 'Approval Queue', tagline: 'Streamline team approvals', purpose: 'Replaces email-based approval tracking with a structured workflow.', workflowType: 'approval_workflow', layoutType: 'split_panel_review', colorTheme: { name: 'deep indigo', primary: '#4F46E5', light: '#EEF2FF', text: '#312E81' }, features: ['Submit and track requests', 'One-click approve/reject', 'Email notifications', 'Audit trail'], fields: [{ name: 'title', label: 'Request Title', type: 'text', required: true, options: [] }, { name: 'description', label: 'Description', type: 'textarea', required: true, options: [] }, { name: 'status', label: 'Status', type: 'select', required: true, options: ['Pending Review', 'Under Review', 'Approved', 'Rejected'] }], statusFlow: ['Pending Review', 'Under Review', 'Approved', 'Rejected'], primaryActionLabel: 'Submit Request', integrations: { sharepoint: { enabled: false, reason: '' }, outlook: { enabled: false, toField: null, subject: null, reason: '' }, teams: { enabled: false, messageTemplate: null, reason: '' }, documentGeneration: { enabled: false, templateDescription: null, deliveryField: null, reason: '' } }, roles: [] },
      },
    }
  }
  return postJSON('/api/brief',
    { prompt, conversationId, buildMode, clarificationAnswers, conversationHistory },
    'generating the brief',
    { timeoutMs: 120_000 },
    aiModel)
}

// Generate full PM brief (product_manager mode)
export async function generatePMBrief(prompt, conversationId, pmPackage, clarificationAnswers = null, conversationHistory = [], aiModel = 'claude') {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 2500))
    // Reuse the existing mock brief but add PM-specific fields
    const base = {
      buildMode: 'product_manager',
      pmPackage: pmPackage || 'lean',
      brief: {
        intakeSummary: { understood: 'Mock PM brief — full document stack generated.', businessProblem: 'Teams track approvals manually via email.', primaryUsers: ['Requesters', 'Approvers'], secondaryUsers: ['Admins'], currentProcess: 'Email chains and shared spreadsheets', mainOutcome: 'Centralized, auditable workflow' },
        problemStatement: { currentState: 'Teams manage approvals manually', painPoints: ['No visibility into request status', 'Delays from manual routing'], rootCauses: ['No centralized system', 'Email-based communication'], impactedUsers: ['Requesters', 'Approvers'], businessImpact: 'Estimated 5 hours per week lost per team', proposedSolution: 'Build a self-service approval portal', outOfScope: ['External user access in v1'] },
        productBrief: { objective: 'Eliminate email-based approval tracking.', userRoles: [{ role: 'Requester', access: 'Submit and track', estimated: '50+' }], coreWorkflows: ['Submit → Review → Approve/Reject → Notify'], businessRules: ['Only managers can approve'], successCriteria: ['90% requests processed in <24h'], assumptions: ['Single approval level'], openQuestions: ['Multi-level approval needed?'] },
        prd: { version: '1.0', status: 'Draft', overview: 'A PM-grade approval portal.', goals: ['Reduce approval cycle time by 50%'], nonGoals: ['Mobile app in v1'], userPersonas: [{ name: 'Operations Lead', role: 'Requester', needs: 'Fast approvals', painPoints: 'Email delays' }], functionalRequirements: [{ id: 'FR-01', category: 'Core', requirement: 'Submit and track requests', priority: 'P0' }], nonFunctionalRequirements: [{ id: 'NFR-01', category: 'Security', requirement: 'RBAC with audit logging' }], dependencies: ['SSO authentication'], risksAndMitigations: [{ risk: 'Low adoption', mitigation: 'Training and comms plan', likelihood: 'Medium' }] },
        userStories: { epics: [{ id: 'E-01', title: 'Request Submission', stories: [{ id: 'US-01', title: 'Submit a request', asA: 'Requester', iWant: 'Submit a structured request', soThat: 'It reaches the right approver', acceptanceCriteria: ['Given I fill the form, when I submit, then it appears in the approver queue'], priority: 'P0', estimate: '3' }] }] },
        workflowMap: { trigger: 'Requester submits form', steps: [{ step: 'Submit', actor: 'Requester', action: 'Fill form', output: 'Request record', sla: null }], decisionPoints: ['Approved → close', 'Rejected → notify'], exceptionPaths: ['48h no action → escalate'] },
        dataModel: { primaryEntity: 'Request', fields: [{ name: 'title', label: 'Title', type: 'text', required: true, options: [] }], statusFlow: ['Pending', 'Under Review', 'Approved', 'Rejected'], relationships: [], auditFields: ['created_at', 'created_by'] },
        automationModel: { triggers: [{ event: 'Request submitted', condition: 'Always', action: 'Notify approver' }], notifications: [{ event: 'Request submitted', recipient: 'Approver', channel: 'Email', template: 'New request waiting' }], escalations: [{ condition: '48h no action', action: 'Escalate', recipient: 'Manager' }], documentGeneration: [], integrations: [] },
        uxRecommendation: { layoutType: 'split_panel_review', navigationModel: 'Single page', primaryScreens: [{ screen: 'Request Queue', purpose: 'Review requests', keyActions: ['Approve', 'Reject'] }], visualTheme: { mood: 'authoritative', primaryColor: '#4F46E5', colorName: 'deep indigo', rationale: 'Authoritative feel for approval workflows' }, rationale: 'Split panel ideal for review queues' },
        appSpec: { appTitle: 'Approval Hub', appType: 'Approval Queue', tagline: 'Streamline approvals', purpose: 'Replaces email-based tracking.', workflowType: 'approval_workflow', layoutType: 'split_panel_review', colorTheme: { name: 'deep indigo', primary: '#4F46E5', light: '#EEF2FF', text: '#312E81' }, features: ['Submit requests', 'One-click approve/reject', 'Email notifications', 'Audit trail'], fields: [{ name: 'title', label: 'Title', type: 'text', required: true, options: [] }], statusFlow: ['Pending Review', 'Approved', 'Rejected'], primaryActionLabel: 'Submit Request', integrations: { sharepoint: { enabled: false }, outlook: { enabled: false }, teams: { enabled: false }, documentGeneration: { enabled: false } }, roles: [] },
        successMetrics: { primaryKPIs: [{ metric: 'Approval cycle time', baseline: '48 hours', target: '24 hours', timeline: '3 months', measurement: 'Average time from submission to decision' }], secondaryMetrics: [{ metric: 'User adoption', target: '90%', measurement: 'Active users / total users' }], leadingIndicators: ['Daily active users'], laggingIndicators: ['Process time reduction'], measurementCadence: 'Weekly', reportingStructure: 'Monthly dashboard', successThreshold: '80% requests in 24h within 60 days' },
        qaTestPlan: { scope: 'Core approval workflow, notifications, access control', testApproach: 'Manual UAT + automated regression', testEnvironments: ['UAT', 'Staging'], testCases: [{ id: 'TC-01', module: 'Submission', testCase: 'Submit happy path', preconditions: 'Logged in as requester', steps: ['Fill form', 'Submit'], expectedResult: 'Request created, approver notified', priority: 'Critical' }], regressionCases: ['Core workflow after any change'], exitCriteria: ['All critical tests pass', 'UAT sign-off received'], defectManagement: 'P0 blocks release' },
      },
    }
    if (['enterprise', 'full_lifecycle'].includes(pmPackage)) {
      base.brief.businessCase = { executiveSummary: 'Mock business case', problemStatement: 'Manual process costs time', proposedSolution: 'Build approval portal', strategicAlignment: ['Efficiency goal'], financialSummary: { investmentRequired: '$15,000', expectedSavings: '$50,000/year', paybackPeriod: '4 months', roi: '333%' }, benefits: [{ type: 'Quantitative', benefit: 'Time savings', value: '$50k/year' }], alternatives: [{ option: 'Continue with email', reason: 'No audit trail, errors' }], recommendation: 'Build the portal' }
      base.brief.costBreakdown = { categories: [{ category: 'Development', items: [{ item: 'Engineering', description: 'Build time', unit: 'Hours', quantity: 80, unitCost: 125, total: 10000, notes: '' }] }], totalCapex: 10000, totalOpex: 5000, grandTotal: 15000, currency: 'USD', assumptions: ['Internal team rates'] }
      base.brief.roiAnalysis = { timeframe: '24 months', currentCosts: [{ item: 'Manual process', annualCost: 50000, description: 'Staff time on email routing' }], projectedSavings: [{ item: 'Time savings', annualSaving: 40000, description: '80% reduction in routing time', confidence: 'High' }], implementationCost: 15000, ongoingCost: 5000, netBenefit: 55000, roi: '367%', paybackPeriod: '5 months', sensitivity: [{ scenario: 'Base Case', roi: '367%', payback: '5 months' }] }
    }
    const { supabase } = await import('./supabase.js')
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      message_type: 'confirmation',
      metadata: { cardType: 'enterprise_brief', brief: base.brief, buildMode: 'product_manager', pmPackage, artifactIds: {} },
    })
    return base
  }

  return postJSON('/api/pm-brief',
    { prompt, conversationId, pmPackage, clarificationAnswers, conversationHistory },
    'generating the PM brief',
    { timeoutMs: 180_000 },
    aiModel)
}

// Get role package selection card or role-specific clarification questions
export async function getRolePackageOrQuestions(prompt, conversationId, role, rolePackage = null, conversationHistory = [], aiModel = 'claude') {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 600))
    if (!rolePackage) return { type: 'role_package', role, intro: `On it — I'll build a tailored ${role} workflow package for this.` }
    const roleConfirmQ = {
      type: 'role_confirm',
      question: `Just to confirm — you selected **${role}** for this project. Does that sound right?`,
      role: role,
      roleLabel: role,
    }
    return {
      type: 'clarification_v2',
      intro: `Perfect, setting up the ${rolePackage} ${role} package. A few targeted questions:`,
      buildMode: role,
      rolePackage,
      questions: [
        roleConfirmQ,
        { type: 'short_answer', question: 'Describe the current process this will replace (tools, manual steps, bottlenecks)', placeholder: 'e.g. email chains, spreadsheet, SharePoint form...' },
        { type: 'multi_select', question: 'Which integrations are needed?', options: ['Microsoft 365 / Teams', 'Email notifications', 'Slack', 'Existing ERP/HRIS', 'No integrations yet'] },
        { type: 'yes_no', question: 'Are there compliance or audit requirements?' },
        { type: 'multiple_choice', question: 'How many people will use this system?', options: ['Under 20', '20-100', '100-500', '500+'] },
      ],
    }
  }
  const body = { prompt, conversationId, buildMode: role, conversationHistory }
  if (rolePackage) body.rolePackage = rolePackage
  return postJSON('/api/generate', body, 'preparing role questions', {}, aiModel)
}

// Generate a full role-specific brief (ops, it_admin, compliance, finance, hr)
export async function generateRoleBrief(prompt, conversationId, role, rolePackage, clarificationAnswers = null, conversationHistory = [], aiModel = 'claude') {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 2000))
    const mockBrief = {
      intakeSummary: { understood: `Mock ${role} brief generated.`, currentProcess: 'Manual process via email and spreadsheets', primaryUsers: ['Primary User', 'Approver'], mainOutcome: 'Automated, auditable workflow' },
      workflowMap: { trigger: 'User submits request', steps: [{ step: 'Submit', actor: 'Requester', action: 'Fill form', output: 'Request record', sla: null }, { step: 'Review', actor: 'Approver', action: 'Review and decide', output: 'Decision', sla: '24 hours' }], decisionPoints: ['Approved → proceed', 'Rejected → notify'], exceptionPaths: ['48h no action → escalate'] },
      dataModel: { primaryEntity: 'Request', fields: [{ name: 'title', label: 'Title', type: 'text', required: true, options: [] }, { name: 'status', label: 'Status', type: 'select', required: true, options: ['Pending', 'Approved', 'Rejected'] }], statusFlow: ['Pending', 'Approved', 'Rejected'], auditFields: ['created_at', 'created_by'] },
      uxRecommendation: { layoutType: 'split_panel_review', primaryScreens: [{ screen: 'Request Queue', purpose: 'Review requests', keyActions: ['Approve', 'Reject'] }], visualTheme: { mood: 'professional', primaryColor: '#4F46E5', colorName: 'indigo', rationale: 'Professional and trustworthy' } },
      appSpec: { appTitle: `${role} Portal`, appType: 'workflow_automation', tagline: 'Streamline your workflow', purpose: 'Replaces manual process', features: ['Submit requests', 'Approve/reject', 'Notifications', 'Audit trail'], fields: [{ name: 'title', label: 'Title', type: 'text', required: true, options: [] }], statusFlow: ['Pending', 'Approved', 'Rejected'], primaryActionLabel: 'Submit Request' },
    }
    return { buildMode: role, rolePackage, brief: mockBrief, artifactIds: {} }
  }
  return postJSON('/api/role-brief',
    { prompt, conversationId, role, rolePackage, clarificationAnswers, conversationHistory },
    'generating the role brief',
    { timeoutMs: 180_000 },
    aiModel)
}

// Generate a Task-Mode brief (fullstack, automation, dashboard, knowledge, workflow)
export async function generateTaskBrief(prompt, conversationId, buildMode, clarificationAnswers = null, conversationHistory = [], aiModel = 'claude') {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 1800))
    return {
      buildMode,
      brief: {
        intakeSummary: { understood: `Mock ${buildMode} brief generated.`, primaryUsers: ['Primary User'], mainOutcome: 'Mocked outcome' },
        appSpec: { appTitle: `${buildMode} App`, appType: buildMode, tagline: 'Mock', purpose: 'Mock', workflowType: 'status_board', layoutType: 'command_center', colorTheme: { name: 'indigo', primary: '#4F46E5', light: '#EEF2FF', text: '#312E81' }, features: ['F1'], fields: [], statusFlow: ['Active'], primaryActionLabel: 'Submit', integrations: { sharepoint: { enabled: false }, outlook: { enabled: false }, teams: { enabled: false }, documentGeneration: { enabled: false } }, roles: [] },
      },
      artifactIds: {},
    }
  }
  return postJSON('/api/task-brief',
    { prompt, conversationId, buildMode, clarificationAnswers, conversationHistory },
    'generating the task brief',
    { timeoutMs: 180_000 },
    aiModel)
}

// Request an on-demand PM document
export async function requestPMDocument(conversationId, userRequest, projectContext = null, aiModel = 'claude') {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 1200))
    return { artifact: { id: 'mock-doc-' + Date.now(), artifact_type: 'custom_document', title: userRequest, content: { generated: true, request: userRequest }, status: 'draft' }, docInfo: { type: 'custom', label: userRequest, category: 'custom' } }
  }
  return postJSON('/api/pm-document',
    { conversationId, userRequest, projectContext },
    'generating the document',
    { timeoutMs: 120_000 },
    aiModel)
}

export async function generateSpec(prompt, conversationId, clarificationAnswers = null, conversationHistory = [], aiModel = 'claude') {
  if (MOCK_MODE) {
    // Mock spec for testing
    await new Promise(r => setTimeout(r, 1500))
    const workflowType = classifyPrompt(prompt)
    const themeMap = {
      approval_workflow: { name: 'violet', primary: '#8B5CF6', light: '#F5F3FF', text: '#1E1B4B' },
      intake_tracker: { name: 'ocean', primary: '#0EA5E9', light: '#F0F9FF', text: '#0C4A6E' },
      status_board: { name: 'forest', primary: '#10B981', light: '#F0FDF4', text: '#064E3B' },
    }
    const statusMap = {
      approval_workflow: ['Pending Review', 'Approved', 'Rejected'],
      intake_tracker: ['New', 'In Progress', 'Resolved', 'Closed'],
      status_board: ['Active', 'In Progress', 'Complete', 'On Hold'],
    }
    const titleMap = {
      approval_workflow: 'Request Approval Tracker',
      intake_tracker: 'Issue Intake Tracker',
      status_board: 'Project Status Board',
    }
    const spec = {
      appTitle: titleMap[workflowType],
      tagline: 'Streamline your workflow with ease',
      purpose: 'This tool helps teams manage and track requests efficiently. It provides a centralized place to submit, review, and process items through a defined workflow.',
      workflowType,
      colorTheme: themeMap[workflowType],
      features: [
        'Submit requests with structured form fields',
        'Track status through defined workflow stages',
        'Review all submissions in a unified dashboard',
        'Update and manage statuses in real time',
      ],
      fields: [
        { label: 'Requester Name', type: 'text' },
        { label: 'Requester Email', type: 'email' },
        { label: 'Description', type: 'textarea' },
        { label: 'Priority', type: 'select' },
        { label: 'Status', type: 'select' },
      ],
      statusFlow: statusMap[workflowType],
      primaryActionLabel: 'Submit Request',
    }
    const { supabase } = await import('./supabase.js')
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      message_type: 'spec',
      metadata: { spec },
    })
    return { spec }
  }

  return postJSON('/api/spec',
    { prompt, conversationId, clarificationAnswers, conversationHistory },
    'generating the spec',
    { timeoutMs: 90_000 },
    aiModel)
}

export async function buildApp(prompt, conversationId, spec, clarificationAnswers = null, aiModel = 'claude') {
  if (MOCK_MODE) return mockGenerate(prompt, conversationId)
  return postJSON('/api/build',
    { prompt, conversationId, spec, clarificationAnswers },
    'building your app',
    { timeoutMs: 120_000 },
    aiModel)
}

export async function editApp(appId, editRequest, conversationId, aiModel = 'claude') {
  return postJSON('/api/edit',
    { appId, editRequest, conversationId },
    'updating your app',
    { timeoutMs: 90_000 },
    aiModel)
}

export async function submitForm(appId, formData) {
  if (MOCK_MODE) return mockSubmit(appId, formData)
  return postJSON('/api/submit', { appId, formData }, 'submitting your form')
}

export async function updateStatus(submissionId, newStatus, appId) {
  if (MOCK_MODE) return mockUpdateStatus(submissionId, newStatus, appId)
  return postJSON('/api/update-status',
    { submissionId, newStatus, appId },
    'updating status')
}


// ─── Artifact API helpers ──────────────────────────────────────────────────────
export async function listArtifacts(conversationId) {
  return getJSON(`/api/artifacts?conversationId=${conversationId}`, 'loading artifacts')
}

export async function updateArtifact(artifactId, updates) {
  return patchJSON(`/api/artifacts/${artifactId}`, updates, 'updating artifact')
}

export async function aiEditArtifact(artifactId, instruction, aiModel = 'claude') {
  return postJSON('/api/artifacts/ai-edit',
    { artifactId, instruction },
    'applying AI edit',
    { timeoutMs: 90_000 },
    aiModel)
}

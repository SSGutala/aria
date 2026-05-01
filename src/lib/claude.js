const MOCK_MODE = !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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

export async function generateApp(prompt, conversationId, messages, clarificationAnswers = null) {
  if (MOCK_MODE) return mockGenerate(prompt, conversationId)

  // Pass last 10 messages as conversation history for memory
  const conversationHistory = (messages || []).slice(-10).map(m => ({
    role: m.role,
    content: m.content || '',
  }))

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, conversationId, messages, clarificationAnswers, conversationHistory }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Generation failed')
  }
  return response.json()
}

// Phase 1: analyze prompt, return build mode recommendation
export async function analyzeBuildMode(prompt, conversationId, conversationHistory = []) {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 1000))
    return { type: 'build_mode', intro: 'I can build that.', recommendedMode: 'guided', complexityReason: 'This workflow involves multiple roles and approval steps, so Guided Build will produce a better result.' }
  }
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, conversationId, conversationHistory }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Analysis failed')
  }
  return response.json()
}

// Phase 2: with build mode selected, get clarification questions
export async function getModeQuestions(prompt, conversationId, buildMode, conversationHistory = []) {
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
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, conversationId, buildMode, conversationHistory }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Failed to get questions')
  }
  return response.json()
}

// Generate full enterprise brief (guided + docs modes)
export async function generateBrief(prompt, conversationId, buildMode, clarificationAnswers = null, conversationHistory = []) {
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
  const response = await fetch('/api/brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, conversationId, buildMode, clarificationAnswers, conversationHistory }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Brief generation failed')
  }
  return response.json()
}

export async function generateSpec(prompt, conversationId, clarificationAnswers = null, conversationHistory = []) {
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

  const response = await fetch('/api/spec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, conversationId, clarificationAnswers, conversationHistory }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Spec generation failed')
  }
  return response.json()
}

export async function buildApp(prompt, conversationId, spec, clarificationAnswers = null) {
  if (MOCK_MODE) return mockGenerate(prompt, conversationId)

  const response = await fetch('/api/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, conversationId, spec, clarificationAnswers }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Build failed')
  }
  return response.json()
}

export async function editApp(appId, editRequest, conversationId) {
  const response = await fetch('/api/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, editRequest, conversationId }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Edit failed' }))
    throw new Error(err.error || 'Edit failed')
  }
  return response.json()
}

export async function submitForm(appId, formData) {
  if (MOCK_MODE) return mockSubmit(appId, formData)

  const response = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, formData }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Submission failed' }))
    throw new Error(err.error || 'Submission failed')
  }
  return response.json()
}

export async function updateStatus(submissionId, newStatus, appId) {
  if (MOCK_MODE) return mockUpdateStatus(submissionId, newStatus, appId)

  const response = await fetch('/api/update-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionId, newStatus, appId }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Update failed' }))
    throw new Error(err.error || 'Update failed')
  }
  return response.json()
}


// ─── Artifact API helpers ──────────────────────────────────────────────────────
export async function listArtifacts(conversationId) {
  const response = await fetch(`${API_URL}/api/artifacts?conversationId=${conversationId}`)
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to load artifacts' }))
    throw new Error(err.error || 'Failed to load artifacts')
  }
  return response.json()
}

export async function updateArtifact(artifactId, updates) {
  const response = await fetch(`${API_URL}/api/artifacts/${artifactId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Update failed' }))
    throw new Error(err.error || 'Update failed')
  }
  return response.json()
}

export async function aiEditArtifact(artifactId, instruction) {
  const response = await fetch(`${API_URL}/api/artifacts/ai-edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artifactId, instruction }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'AI edit failed' }))
    throw new Error(err.error || 'AI edit failed')
  }
  return response.json()
}

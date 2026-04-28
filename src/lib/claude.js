const MOCK_MODE = !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

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

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, conversationId, messages, clarificationAnswers }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Generation failed')
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

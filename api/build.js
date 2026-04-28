import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

function generateSlug(title) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${base}-${rand}`
}

async function askClaude(prompt) {
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2048,
    system: 'You are a helpful assistant. Return only the requested JSON, no explanation.',
    messages: [{ role: 'user', content: prompt }],
  })
  return msg.content[0].text
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found')
  return JSON.parse(match[0])
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationId, spec, clarificationAnswers } = req.body
  if (!prompt || !conversationId || !spec) return res.status(400).json({ error: 'Missing fields' })

  try {
    const context = clarificationAnswers ? `\nUser clarifications: ${clarificationAnswers}` : ''
    const workflowType = spec.workflowType
    const layoutType = spec.layoutType || (workflowType === 'approval_workflow' ? 'split' : workflowType === 'status_board' ? 'kanban' : 'feed')

    // Generate full schema based on spec
    let schemaText = await askClaude(
      `Build a complete app schema based on this approved spec:
App Title: ${spec.appTitle}
Purpose: ${spec.purpose}
Workflow Type: ${workflowType}
Fields: ${spec.fields.map(f => `${f.label} (${f.type})`).join(', ')}
Status Flow: ${spec.statusFlow.join(', ')}
Color Theme: ${JSON.stringify(spec.colorTheme)}${context}

Return JSON only:
{
  "appTitle": "${spec.appTitle}",
  "workflowType": "${workflowType}",
  "layoutType": "${layoutType}",
  "colorTheme": ${JSON.stringify(spec.colorTheme)},
  "fields": [
    {
      "name": "snake_case_name",
      "label": "Human Readable Label",
      "type": "text | number | email | date | select | textarea",
      "required": true,
      "options": [],
      "placeholder": "helpful placeholder text"
    }
  ],
  "statusOptions": ${JSON.stringify(spec.statusFlow)},
  "defaultStatus": "${spec.statusFlow[0]}",
  "primaryActionLabel": "${spec.primaryActionLabel || 'Submit'}",
  "notificationConfig": {
    "sendConfirmationToSubmitter": true,
    "submitterEmailField": null,
    "notifyOnSubmission": false,
    "notifyEmails": [],
    "priorityRouting": false,
    "priorityField": null,
    "priorityRules": []
  }
}

Rules:
- Use EXACTLY the fields from the spec (in order), always add status as LAST field
- Status field: type "select", options = statusOptions
- Email fields: type "email". Dollar/number fields: type "number". Long text: type "textarea"
- Set submitterEmailField to the email field name if one exists
- Include helpful placeholder text for each field`
    )

    let schema
    try {
      schema = extractJSON(schemaText)
    } catch {
      schemaText = await askClaude(`Fix this JSON and return valid JSON only: ${schemaText}`)
      schema = extractJSON(schemaText)
    }

    const slug = generateSlug(spec.appTitle)
    const tableName = 'app_' + slug.replace(/-/g, '_')

    const convData = await supabase.from('conversations').select('user_id').eq('id', conversationId).single()

    const { data: appData, error: appError } = await supabase
      .from('generated_apps')
      .insert({
        conversation_id: conversationId,
        user_id: convData.data?.user_id,
        title: spec.appTitle,
        workflow_type: workflowType,
        schema,
        table_name: tableName,
        notification_config: schema.notificationConfig || {},
        status: 'deployed',
        slug,
      })
      .select()
      .single()

    if (appError) throw new Error(appError.message)

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      message_type: 'app_card',
      metadata: { schema, slug, appId: appData.id },
    })

    await supabase.from('conversations').update({
      title: spec.appTitle,
      updated_at: new Date().toISOString(),
    }).eq('id', conversationId)

    return res.json({ type: 'app_card', schema, slug, appId: appData.id })

  } catch (err) {
    console.error('Build error:', err)
    return res.status(500).json({ error: err.message || 'Build failed. Please try again.' })
  }
}

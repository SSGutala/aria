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

function slugToTableName(slug) {
  return 'app_' + slug.replace(/-/g, '_')
}

async function askClaude(prompt) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: 'You are a helpful assistant. Return only the requested format, no explanation.',
    messages: [{ role: 'user', content: prompt }],
  })
  return msg.content[0].text
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON found in response')
  return JSON.parse(match[0])
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationId, messages = [], clarificationAnswers } = req.body
  if (!prompt || !conversationId) return res.status(400).json({ error: 'Missing required fields' })

  try {
    // Build full context from prior clarification answers
    const clarificationContext = clarificationAnswers
      ? `\n\nUser clarifications: ${clarificationAnswers}`
      : ''

    // Step 0: vagueness check — ask up to 3 questions at once with options, only if genuinely needed
    if (!clarificationAnswers) {
      const vagueCheck = await askClaude(
        `Given this user prompt: "${prompt}"

Assess how clear it is for building an internal business tool.
Only ask for clarification if the prompt is genuinely ambiguous — if it mentions specific fields, users, or workflows, it is clear enough to proceed.

If clarification is needed, identify up to 3 (fewer is better) of the most important gaps. For each, provide 3-5 short answer options the user can pick from.

Return JSON only:
{
  "needsClarification": true,
  "questions": [
    {
      "question": "short question text",
      "options": ["Option A", "Option B", "Option C"]
    }
  ]
}
OR if clear enough to proceed:
{ "needsClarification": false }`
      )

      const vague = extractJSON(vagueCheck)
      if (vague.needsClarification && vague.questions?.length > 0) {
        const questions = vague.questions.slice(0, 3)
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: '',
          message_type: 'clarification',
          metadata: { questions },
        })
        return res.json({ type: 'clarification', questions })
      }
    }

    // Step 1: classify
    const classifyText = await askClaude(
      `Given this description: "${prompt}"${clarificationContext}

Classify into exactly one of:
- approval_workflow (requests needing approval: vendor payments, budget exceptions, access requests, PTO)
- intake_tracker (logging issues, bugs, escalations, incidents, referrals)
- status_board (pipelines, project tracking, deal stages, hiring)

Return JSON only: { "workflowType": "..." }`
    )

    const { workflowType } = extractJSON(classifyText)

    // Step 2: generate schema
    let schemaText = await askClaude(
      `Given this ${workflowType} description: "${prompt}"${clarificationContext}

Generate a complete app schema. Return JSON only:

{
  "appTitle": "professional internal tool name",
  "workflowType": "${workflowType}",
  "fields": [
    {
      "name": "snake_case_name",
      "label": "Human Readable Label",
      "type": "text | number | email | date | select | textarea",
      "required": true,
      "options": []
    }
  ],
  "statusOptions": ["status values"],
  "defaultStatus": "first status",
  "primaryActionLabel": "Submit button text",
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
- Status field must be LAST, type "select", options = statusOptions
- Dollar amounts: type "number". Descriptions: type "textarea". Emails: type "email"
- approval_workflow statusOptions: ["Pending Review", "Approved", "Rejected"]
- intake_tracker statusOptions: ["New", "In Progress", "Resolved", "Closed"]
- status_board statusOptions: ["Active", "In Progress", "Complete", "On Hold"]
- 4-7 fields maximum`
    )

    let schema
    try {
      schema = extractJSON(schemaText)
    } catch {
      schemaText = await askClaude(
        `Return only valid JSON for an app schema for: "${prompt}"${clarificationContext}. workflowType: "${workflowType}". Include appTitle, fields (4-6), statusOptions, defaultStatus, primaryActionLabel, notificationConfig.`
      )
      schema = extractJSON(schemaText)
    }

    // Step 3: confirmation message
    const confirmText = await askClaude(
      `Write a one-sentence message confirming what you are about to build. Mention the app title and 2-3 key fields. End with "Generating now..."

Schema: ${JSON.stringify(schema)}

Return plain text only.`
    )

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: confirmText,
      message_type: 'confirmation',
    })

    // Step 4: deploy
    const slug = generateSlug(schema.appTitle || 'generated-app')
    const tableName = slugToTableName(slug)

    const convData = await supabase.from('conversations').select('user_id').eq('id', conversationId).single()

    const { data: appData, error: appError } = await supabase
      .from('generated_apps')
      .insert({
        conversation_id: conversationId,
        user_id: convData.data?.user_id,
        title: schema.appTitle,
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
      title: schema.appTitle,
      updated_at: new Date().toISOString(),
    }).eq('id', conversationId)

    return res.json({ type: 'app_card', schema, slug, appId: appData.id, confirmation: confirmText })

  } catch (err) {
    console.error('Generate error:', err)
    return res.status(500).json({ error: err.message || 'Generation failed. Please try again.' })
  }
}

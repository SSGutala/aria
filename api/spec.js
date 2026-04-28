import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

async function askClaude(prompt) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: 'You are a product designer and developer. Return only the requested JSON format, no explanation.',
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

  const { prompt, conversationId, clarificationAnswers } = req.body
  if (!prompt || !conversationId) return res.status(400).json({ error: 'Missing fields' })

  try {
    const context = clarificationAnswers ? `\nUser clarifications: ${clarificationAnswers}` : ''

    const specText = await askClaude(
      `You are designing an internal business tool. Given this description: "${prompt}"${context}

Generate a product specification. Return JSON only:

{
  "appTitle": "Professional tool name (2-4 words)",
  "tagline": "One line describing what it does",
  "purpose": "2-3 sentences explaining what this tool does, who uses it, and why it matters",
  "workflowType": "approval_workflow | intake_tracker | status_board",
  "colorTheme": {
    "name": "One of: ocean | forest | violet | rose | amber | slate",
    "primary": "hex color — the main brand color",
    "light": "hex color — very light tint of primary for backgrounds",
    "text": "hex color — dark text color that works on white"
  },
  "features": [
    "Feature description (start with a verb)",
    "Feature description",
    "Feature description",
    "Feature description"
  ],
  "fields": [
    { "label": "Human readable field name", "type": "text | number | email | date | select | textarea" }
  ],
  "statusFlow": ["Status 1", "Status 2", "Status 3"],
  "primaryActionLabel": "Submit button text"
}

Rules for colorTheme:
- approval_workflow → violet (#8B5CF6, #F5F3FF, #1E1B4B) or rose (#F43F5E, #FFF1F2, #4C0519)
- intake_tracker → ocean (#0EA5E9, #F0F9FF, #0C4A6E) or amber (#F59E0B, #FFFBEB, #451A03)
- status_board → forest (#10B981, #F0FDF4, #064E3B) or slate (#475569, #F8FAFC, #0F172A)
- Always pick the theme that best matches the domain

Rules for features: exactly 4 features, each starting with an action verb
Rules for fields: 4-7 fields, always end with a status field
Rules for statusFlow: match workflowType:
- approval_workflow: ["Pending Review", "Approved", "Rejected"]
- intake_tracker: ["New", "In Progress", "Resolved", "Closed"]
- status_board: ["Active", "In Progress", "Complete", "On Hold"]`
    )

    const spec = extractJSON(specText)

    // Save spec as a message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      message_type: 'spec',
      metadata: { spec },
    })

    return res.json({ spec })
  } catch (err) {
    console.error('Spec error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate spec' })
  }
}

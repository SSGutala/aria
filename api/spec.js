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

  const { prompt, conversationId, clarificationAnswers, conversationHistory } = req.body
  if (!prompt || !conversationId) return res.status(400).json({ error: 'Missing fields' })

  try {
    const context = clarificationAnswers ? `\nUser clarifications: ${clarificationAnswers}` : ''
    const historyContext = conversationHistory && conversationHistory.length > 0
      ? `\nConversation history: ${conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Aria'}: ${m.content}`).filter(l => !l.endsWith(': ')).join(' | ')}`
      : ''

    const specText = await askClaude(
      `You are a senior product designer at a top-tier SaaS company. Given this tool description: "${prompt}"${context}${historyContext}

Generate a product specification with a distinctive, vibrant visual identity. Return JSON only:

{
  "appTitle": "Sharp tool name (2-4 words, no generic words like 'Manager' or 'System')",
  "tagline": "One punchy line — what it does and why it matters",
  "purpose": "2-3 sentences: what it does, who uses it, the key value it delivers",
  "workflowType": "approval_workflow | intake_tracker | status_board",
  "colorTheme": {
    "name": "a descriptive name like 'midnight indigo' or 'coral energy'",
    "primary": "A bold, saturated hex — not grey, not muted. Should feel premium and energetic.",
    "light": "A very light tint of primary (10-15% saturation) for backgrounds and chips",
    "text": "A very dark variant of primary for body text on white backgrounds"
  },
  "features": ["Verb-led feature (specific to this tool)", "...", "...", "..."],
  "fields": [
    { "label": "Human readable name", "type": "text | number | email | date | select | textarea" }
  ],
  "statusFlow": ["Status names specific to this domain"],
  "primaryActionLabel": "Action verb + noun (e.g. 'Submit Request', 'Log Issue', 'Add Task')"
}

Color rules — pick the MOST vibrant, domain-appropriate color. Never pick a grey or muted tone:
- Finance/budget/approvals → deep violet #6D28D9 (light #F5F3FF, text #2E1065)
- HR/people/hiring → rose #E11D48 (light #FFF1F2, text #4C0519)
- Tech/engineering/bugs → electric blue #2563EB (light #EFF6FF, text #1E3A8A)
- Operations/logistics → amber #D97706 (light #FFFBEB, text #78350F)
- Health/wellness → teal #0D9488 (light #F0FDFA, text #134E4A)
- Marketing/creative → purple #9333EA (light #FAF5FF, text #3B0764)
- Sales/CRM/leads → emerald #059669 (light #ECFDF5, text #064E3B)
- Legal/compliance → indigo #4F46E5 (light #EEF2FF, text #312E81)
- Product/projects → sky #0284C7 (light #F0F9FF, text #0C4A6E)
- Customer support/tickets → orange #EA580C (light #FFF7ED, text #7C2D12)
- Everything else → pick the most fitting bold color from the list above

Status flow rules — make statuses specific and meaningful for this domain:
- approval_workflow: 3 statuses (pending → approved/rejected)
- intake_tracker: 4 statuses (open → in progress → done/closed)
- status_board: 4 statuses that reflect real project stages for this domain

Features rules: exactly 4, each very specific to THIS tool (not generic)
Fields rules: 4-7 fields tailored to the domain, always end with a status select field`
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

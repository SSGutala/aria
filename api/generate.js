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
    max_tokens: 512,
    system: 'You are a helpful assistant. Return only the requested JSON format, no explanation.',
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

  const { prompt, conversationId, clarificationAnswers } = req.body
  if (!prompt || !conversationId) return res.status(400).json({ error: 'Missing required fields' })

  try {
    // Only check for clarification if no answers provided yet
    if (!clarificationAnswers) {
      const vagueCheck = await askClaude(
        `Given this user prompt: "${prompt}"

Assess how clear it is for building an internal business tool.
Only ask for clarification if the prompt is genuinely ambiguous. If it mentions specific fields, users, or workflows, proceed without questions.

If clarification is needed, identify up to 3 (fewer is better) of the most important gaps. For each, provide 3-5 short answer options.

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
OR if clear enough:
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

    // No clarification needed — frontend will call /api/spec next
    return res.json({ needsClarification: false })

  } catch (err) {
    console.error('Generate error:', err)
    return res.status(500).json({ error: err.message || 'Generation failed. Please try again.' })
  }
}

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
    max_tokens: 800,
    system: 'You are a sharp product designer and developer at an AI startup. You are helpful, concise, and opinionated. Return only the requested JSON format, no explanation, no markdown.',
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

  const { prompt, conversationId, clarificationAnswers, conversationHistory } = req.body
  if (!prompt || !conversationId) return res.status(400).json({ error: 'Missing required fields' })

  try {
    // Build conversation context summary for memory
    const historyContext = conversationHistory && conversationHistory.length > 0
      ? `\n\nConversation history so far:\n${conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Aria'}: ${m.content}`).filter(l => !l.endsWith(': ')).join('\n')}\n\nGiven this history, the user's latest message is: "${prompt}"\nInterpret it in context — if they say "recreate", "redo", "change", "make it X instead", treat it as a follow-up to what was already discussed, not a new standalone request.`
      : ''

    // Only check for clarification if no answers provided yet
    if (!clarificationAnswers) {
      const response = await askClaude(
        `A user wants to build this internal business tool: "${prompt}"${historyContext}

You are a sharp AI product designer. First, write a 1-2 sentence response that:
- Confirms you understand what they want to build
- Shows you have a clear creative vision for it (mention the type of tool, the UX direction, or an analogy to a known product if apt)
- Ends by saying you have a couple of quick decisions to lock in first (only if questions are needed)

Then, decide if you need 1-3 clarifying questions. Only ask if the answers would meaningfully change the UI, the data model, or the key workflow of what you build. Do NOT ask generic questions. Questions must be specific to this exact product.

Good question topics (pick only what actually matters for THIS product):
- Who are the primary users and what actions do they take
- The most important piece of information to capture in the form
- How items should be prioritized, sorted, or routed
- Whether there are multiple user roles with different access
- Key workflow decision (e.g. does the manager approve or just view)
- What the most important status states are

Bad questions to avoid:
- "What color theme?" (we decide this)
- "What is this tool for?" (already told us)
- Generic scope questions that don't affect the UI

If the prompt is already detailed enough to build without questions, do NOT ask any.

Return JSON only:
{
  "intro": "1-2 sentence message (no em-dashes, use plain dashes if needed)",
  "needsClarification": true,
  "questions": [
    {
      "question": "Specific question directly tied to this product",
      "options": ["Option A", "Option B", "Option C"]
    }
  ]
}
OR if clear enough to build:
{
  "intro": "1-2 sentence message acknowledging the request and your vision",
  "needsClarification": false
}`
      )

      const parsed = extractJSON(response)
      const intro = parsed.intro || ''

      if (parsed.needsClarification && parsed.questions?.length > 0) {
        const questions = parsed.questions.slice(0, 3)

        // Save the intro as a text message
        if (intro) {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: intro,
            message_type: 'text',
            metadata: {},
          })
        }

        // Save the clarification card
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: '',
          message_type: 'clarification',
          metadata: { questions },
        })

        return res.json({ type: 'clarification', intro, questions })
      }

      // No clarification needed - return intro and proceed to spec
      return res.json({ needsClarification: false, intro })
    }

    // Answers provided - proceed to spec
    return res.json({ needsClarification: false })

  } catch (err) {
    console.error('Generate error:', err)
    return res.status(500).json({ error: err.message || 'Generation failed. Please try again.' })
  }
}

/**
 * /api/chat — lightweight conversational response endpoint.
 *
 * Called when the user sends a plain message that isn't a build request
 * (e.g. questions, status checks, clarifications about what Aria is doing).
 * Returns { response: string }.
 */

import { createOrchestrator, respondWithError } from './lib/orchestrator.js'
import { buildHistoryContext } from './lib/prompts.js'
import { buildRoleContextPrompt } from './lib/roleFlows.js'

const CHAT_SYSTEM = `You are Aria, an enterprise app-builder AI assistant.
You help users build internal tools, automate workflows, generate documents, and create analytics dashboards.
When a user asks a question or sends a conversational message (not a build request), respond helpfully and naturally.
Keep responses concise — typically 1-3 sentences unless more detail is genuinely needed.
If the user seems confused about why nothing is generating or why the process stopped, explain what happened clearly and offer to continue or start fresh.
Never start with "Sure", "Great", "Absolutely", or "Of course". Be direct and human.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationHistory = [], roleContext, aiModel } = req.body

  if (!prompt) return res.status(400).json({ error: 'Missing required field: prompt' })

  const rolePreface = buildRoleContextPrompt(roleContext)
  const historyContext = buildHistoryContext(conversationHistory)

  const orch = createOrchestrator({
    workflow: 'chat_response',
    aiModel,
    traceContext: { promptLength: prompt.length },
  })

  try {
    const system = rolePreface ? `${CHAT_SYSTEM}\n\n${rolePreface}` : CHAT_SYSTEM
    const response = await orch.text('chat', {
      tier: 'fast',
      maxTokens: 400,
      system,
      prompt: `${historyContext ? `Conversation so far:${historyContext}\n\n` : ''}User message: "${prompt}"`,
    })
    orch.end({})
    return res.json({ response: response.trim() })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}

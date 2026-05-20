import { createOrchestrator, respondWithError } from '../lib/orchestrator.js'
import { buildHistoryContext } from '../lib/prompts.js'
import { buildRoleContextPrompt, getSeniorityQuestionTarget } from '../lib/roleFlows.js'
import { devlog } from '../lib/devlog.js'

export const SOFTWARE_ENGINE_STEPS = ['Goal & users', 'Core workflow', 'Data model', 'Integrations', 'App spec', 'Build']

export default async function softwareEngineHandler(req, res) {
  const { prompt, conversationId, clarificationAnswers, conversationHistory, aiModel, roleContext } = req.body
  const rolePreface = buildRoleContextPrompt(roleContext)
  const qTarget = getSeniorityQuestionTarget(roleContext?.seniority)

  if (clarificationAnswers) {
    // Route to spec generation
    const { default: specHandler } = await import('../spec.js')
    return specHandler(req, res)
  }

  const orch = createOrchestrator({ workflow: 'software_engine_questions', aiModel, traceContext: { conversationId } })
  try {
    const historyContext = buildHistoryContext(conversationHistory)
    const parsed = await orch.json('software_questions', {
      tier: 'fast', maxTokens: 900,
      system: `You are Aria's Software Engine — specialized in designing internal enterprise applications.
You think like a senior product architect who has shipped 100+ internal tools.
Your questions uncover what gets built: users, permissions, workflows, data, integrations, actions.
Never ask about documents, governance, or compliance unless explicitly needed.
Tone: direct, technical, product-minded.${rolePreface ? '\n\n' + rolePreface : ''}`,
      prompt: `User wants to build: "${prompt}"${historyContext}

Generate ${qTarget.target} targeted discovery questions (depth tuned to user's seniority). Focus ONLY on software design concerns.
Return JSON:
{
  "intro": "1-2 sentences. Name the specific tool being built and the key workflow it replaces. Sound like you already understood the request and are locking down the build spec.",
  "questions": [
    { "type": "multiple_choice|multi_select|yes_no|short_answer", "question": "...", "options": ["..."], "placeholder": "..." }
  ]
}

Question focus areas (pick the most relevant 4-5):
- Who are the primary users? What roles exist? (include actual role names if inferable)
- What is the core action users perform? (the main workflow step)
- What data needs to be stored/tracked? (tables, key fields)
- What approvals or sign-offs are required?
- What integrations are needed? (M365, Slack, email, databases, APIs)
- What triggers notifications or escalations?
- What does "done" look like? (success state / completion trigger)

DO NOT ask about: document types, governance processes, compliance frameworks, or things unrelated to building the app.`,
    })
    orch.end({ questionCount: parsed.questions?.length })
    devlog('software_engine.questions_generated', { conversationId })
    return res.json({
      type: 'engine_questions',
      engine: 'software',
      intro: parsed.intro || '',
      outputType: 'software_spec',
      questions: (parsed.questions || []).slice(0, qTarget.max),
    })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}

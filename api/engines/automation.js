import { createOrchestrator, respondWithError } from '../lib/orchestrator.js'
import { buildHistoryContext } from '../lib/prompts.js'
import { buildRoleContextPrompt } from '../lib/roleFlows.js'
import { devlog } from '../lib/devlog.js'

export const AUTOMATION_ENGINE_STEPS = ['Current process', 'Trigger & events', 'Conditions & routing', 'Integrations', 'Escalations & SLAs', 'Automation workflow', 'Deploy']

export default async function automationEngineHandler(req, res) {
  const { prompt, conversationId, clarificationAnswers, conversationHistory, aiModel, roleContext } = req.body
  const rolePreface = buildRoleContextPrompt(roleContext)

  if (clarificationAnswers) {
    const { default: briefHandler } = await import('../brief.js')
    req.body.outputType = 'automation_brief'
    req.body.buildMode = 'operations'
    return briefHandler(req, res)
  }

  const orch = createOrchestrator({ workflow: 'automation_engine_questions', aiModel, traceContext: { conversationId } })
  try {
    const historyContext = buildHistoryContext(conversationHistory)
    const parsed = await orch.json('automation_questions', {
      tier: 'fast', maxTokens: 900,
      system: `You are Aria's Automation Engine — specialized in designing workflow automations, routing systems, and operational orchestration.
You think like a senior process architect who has automated hundreds of enterprise workflows.
Your questions uncover: triggers, conditions, routing logic, integrations, SLAs, escalations, and exception handling.
Tone: process-focused, operational, precise.
NEVER use app-building language. This is about automating workflows, not building CRUD apps.${rolePreface ? '\n\n' + rolePreface : ''}`,
      prompt: `User wants to automate: "${prompt}"${historyContext}

Generate 4-5 targeted questions to design the automation workflow.
Return JSON:
{
  "intro": "1-2 sentences. Name the specific process being automated and the manual bottleneck it eliminates. Be direct about what the automation will do.",
  "questions": [
    { "type": "multiple_choice|multi_select|yes_no|short_answer", "question": "...", "options": ["..."], "placeholder": "..." }
  ]
}

Question focus areas (pick most relevant 4-5):
- What currently triggers this process manually? (form submission, email, time-based, event)
- What conditions determine the routing path? (value thresholds, role, department, amount)
- Who are the approvers at each stage? (with actual role names)
- What are the SLA timeframes? (hours to respond, escalate, complete)
- What systems need to integrate? (M365, SharePoint, email, Slack, ERP, CRM)
- What happens on exceptions, rejections, or SLA breaches?
- What notifications are sent at each stage and to whom?

DO NOT ask about apps, UX, or data models. Focus purely on the process flow.`,
    })
    orch.end({ questionCount: parsed.questions?.length })
    devlog('automation_engine.questions_generated', { conversationId })
    return res.json({
      type: 'engine_questions',
      engine: 'automation',
      intro: parsed.intro || '',
      outputType: 'automation_brief',
      questions: (parsed.questions || []).slice(0, 5),
    })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}

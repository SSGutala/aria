import { createOrchestrator, respondWithError } from '../lib/orchestrator.js'
import { buildHistoryContext } from '../lib/prompts.js'
import { buildRoleContextPrompt, getSeniorityQuestionTarget } from '../lib/roleFlows.js'
import { devlog } from '../lib/devlog.js'

export const ANALYTICS_ENGINE_STEPS = ['Business objective', 'Key metrics & KPIs', 'Data sources', 'Audience & access', 'Visualization design', 'Dashboard spec', 'Build']

export default async function analyticsEngineHandler(req, res) {
  const { prompt, conversationId, clarificationAnswers, conversationHistory, aiModel, roleContext } = req.body
  const rolePreface = buildRoleContextPrompt(roleContext)
  const qTarget = getSeniorityQuestionTarget(roleContext?.seniority)

  if (clarificationAnswers) {
    const { default: specHandler } = await import('../spec.js')
    req.body.outputType = 'analytics_spec'
    return specHandler(req, res)
  }

  const orch = createOrchestrator({ workflow: 'analytics_engine_questions', aiModel, traceContext: { conversationId } })
  try {
    const historyContext = buildHistoryContext(conversationHistory)
    const parsed = await orch.json('analytics_questions', {
      tier: 'fast', maxTokens: 900,
      system: `You are Aria's Analytics Engine — specialized in designing dashboards, KPI systems, and operational intelligence.
You think like a senior BI architect who has designed executive dashboards and operational command centers.
Your questions uncover: metrics, data sources, audience, visualization requirements, drill-downs, and alert thresholds.
Tone: analytical, data-focused, precise.
NEVER use generic app-building language. This is about business intelligence and operational visibility.${rolePreface ? '\n\n' + rolePreface : ''}`,
      prompt: `User wants to build: "${prompt}"${historyContext}

Generate ${qTarget.target} targeted questions (depth tuned to user's seniority) to design the analytics/dashboard system.
Return JSON:
{
  "intro": "1-2 sentences. Name the specific business objective this dashboard serves and the decision it enables. Be analytical and direct.",
  "questions": [
    { "type": "multiple_choice|multi_select|yes_no|short_answer", "question": "...", "options": ["..."], "placeholder": "..." }
  ]
}

Question focus areas (pick most relevant 4-5):
- What are the 3-5 primary KPIs this dashboard must show? (be specific: "Revenue by region" not "metrics")
- Where does the data come from? (spreadsheets, databases, APIs, M365, manual input, live feeds)
- Who is the primary audience? (C-suite exec vs ops team vs individual contributors — different detail levels)
- What time dimensions are needed? (real-time, daily, weekly, monthly, YoY comparisons)
- What drill-down capability is needed? (by team, by region, by product, by time period)
- What alerts or thresholds trigger notifications? (SLA breach, metric below target, anomaly detection)
- What visualization types fit best? (KPI cards, trend lines, bar charts, heatmaps, tables, maps)

DO NOT ask about CRUD operations, user management, or generic software features.`,
    })
    orch.end({ questionCount: parsed.questions?.length })
    devlog('analytics_engine.questions_generated', { conversationId })
    return res.json({
      type: 'engine_questions',
      engine: 'analytics',
      intro: parsed.intro || '',
      outputType: 'analytics_spec',
      questions: (parsed.questions || []).slice(0, qTarget.max),
    })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}

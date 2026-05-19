import { createOrchestrator, respondWithError } from '../lib/orchestrator.js'
import { buildHistoryContext } from '../lib/prompts.js'
import { devlog } from '../lib/devlog.js'

export const DOC_TYPES = [
  { id: 'prd', label: 'PRD', description: 'Product requirements document', icon: '📋' },
  { id: 'sop', label: 'SOP', description: 'Standard operating procedure', icon: '📖' },
  { id: 'business_case', label: 'Business Case', description: 'ROI, costs, and stakeholder justification', icon: '💼' },
  { id: 'architecture', label: 'Architecture Doc', description: 'System design and integration map', icon: '🏗️' },
  { id: 'roadmap', label: 'Roadmap', description: 'Phased delivery plan with milestones', icon: '🗺️' },
  { id: 'executive_summary', label: 'Executive Summary', description: 'C-suite briefing document', icon: '📊' },
  { id: 'compliance', label: 'Compliance Doc', description: 'Policy, controls, and audit trails', icon: '🔒' },
  { id: 'runbook', label: 'Runbook', description: 'Operational procedures and incident response', icon: '⚙️' },
]

const DOC_QUESTION_FOCUS = {
  prd: 'product goals, target users, requirements, acceptance criteria, KPIs, and constraints',
  sop: 'process steps (numbered), role owners per step, SLAs, escalation rules, and exception handling',
  business_case: 'business problem, proposed solution, cost/benefit analysis, ROI, risks, timeline, and decision-makers',
  architecture: 'systems involved, data flows, integration points, environments (dev/staging/prod), and non-functional requirements',
  roadmap: 'current state, target state, phases/milestones, dependencies, owners, and success criteria per phase',
  executive_summary: 'key message, context, recommendation, supporting data points, and next steps',
  compliance: 'regulatory framework, scope, controls, evidence requirements, audit frequency, and ownership',
  runbook: 'trigger conditions, step-by-step procedures, decision points, escalation contacts, and rollback steps',
}

export default async function docsEngineHandler(req, res) {
  const { prompt, conversationId, clarificationAnswers, docType, conversationHistory, aiModel } = req.body

  // No docType yet — show the picker
  if (!docType) {
    devlog('docs_engine.type_picker_shown', { conversationId })
    return res.json({
      type: 'doc_type_picker',
      engine: 'docs',
      docTypes: DOC_TYPES,
      intro: null, // will be shown by frontend based on prompt
    })
  }

  // clarificationAnswers provided — generate the document
  if (clarificationAnswers) {
    const { default: briefHandler } = await import('../brief.js')
    // Override outputType to docs-focused brief
    req.body.outputType = 'doc_brief'
    req.body.buildMode = 'docs'
    return briefHandler(req, res)
  }

  // docType selected, no answers yet — generate doc-specific questions
  const orch = createOrchestrator({ workflow: 'docs_engine_questions', aiModel, traceContext: { conversationId, docType } })
  const docMeta = DOC_TYPES.find(d => d.id === docType) || { label: docType }
  try {
    const historyContext = buildHistoryContext(conversationHistory)
    const focusAreas = DOC_QUESTION_FOCUS[docType] || 'scope, objectives, stakeholders, and key requirements'
    const parsed = await orch.json('doc_questions', {
      tier: 'fast', maxTokens: 900,
      system: `You are Aria's Document Engine — specialized in generating enterprise-grade business documentation.
You think like a senior business analyst and technical writer who has produced hundreds of enterprise documents.
Your questions extract the exact information needed to produce a complete, professional ${docMeta.label}.
Tone: precise, business-focused, no software development language.
NEVER suggest building an app or generating code. This is a document workspace.`,
      prompt: `User wants to generate a ${docMeta.label} for: "${prompt}"${historyContext}

Generate 4-5 targeted questions to gather everything needed for a complete, professional ${docMeta.label}.
Focus areas for this document type: ${focusAreas}

Return JSON:
{
  "intro": "1-2 sentences. Confirm the ${docMeta.label} scope and what the final document will cover. Sound like a senior analyst who already understood the need.",
  "questions": [
    { "type": "multiple_choice|multi_select|yes_no|short_answer", "question": "...", "options": ["..."], "placeholder": "..." }
  ]
}

Questions must be document-centric. Do NOT use language about apps, builds, specs, or technical architectures unless the document type specifically requires it.`,
    })
    orch.end({ docType, questionCount: parsed.questions?.length })
    devlog('docs_engine.questions_generated', { conversationId, docType })
    return res.json({
      type: 'engine_questions',
      engine: 'docs',
      docType,
      intro: parsed.intro || '',
      outputType: 'doc_brief',
      questions: (parsed.questions || []).slice(0, 5),
    })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}

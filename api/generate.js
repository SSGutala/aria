/**
 * /api/generate — Aria's multi-stage intake endpoint.
 *
 * Stage 1 (no buildMode, no clarificationAnswers):
 *   AI analyzes the prompt and returns { type: 'build_mode', recommendedMode, complexityReason }
 *   Frontend shows BuildModeCard.
 *
 * Stage 1.5 (buildMode set, no clarificationAnswers):
 *   - quick/guided/docs → returns clarification questions
 *   - product_manager + no pmPackage → returns { type: 'pm_package', intro }
 *   - product_manager + pmPackage → returns clarification questions for PM
 *   - role (operations/finance/hr/compliance/it_admin) + no rolePackage → { type: 'role_package', role, intro }
 *   - role + rolePackage → returns clarification questions for that role
 *
 * Stage 2 (clarificationAnswers provided):
 *   Routes to the correct downstream generator (spec / brief / pm-brief / role-brief)
 */

import { createOrchestrator, respondWithError } from './lib/orchestrator.js'
import { INTAKE_TRIAGE, buildHistoryContext } from './lib/prompts.js'

const ROLE_MODES = ['operations', 'it_admin', 'compliance', 'finance', 'hr']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    prompt,
    conversationId,
    clarificationAnswers,
    outputType,
    buildMode,
    pmPackage,
    rolePackage,
    conversationHistory,
    aiModel,
  } = req.body

  if (!prompt || !conversationId) {
    return res.status(400).json({ error: 'Missing required fields: prompt, conversationId' })
  }

  // ─── STAGE 2: clarification answered → route to downstream generator ────────
  if (clarificationAnswers) {
    const resolvedOutputType = outputType || (buildMode === 'product_manager' ? 'pm_brief' : ROLE_MODES.includes(buildMode) ? 'role_brief' : buildMode === 'quick' ? 'spec' : 'brief')
    const handlerMap = {
      spec:       './spec.js',
      pm_brief:   './pm-brief.js',
      role_brief: './role-brief.js',
      brief:      './brief.js',
    }
    const handlerPath = handlerMap[resolvedOutputType] || handlerMap.brief
    const { default: downstreamHandler } = await import(handlerPath)
    return downstreamHandler(req, res)
  }

  // ─── STAGE 1.5: buildMode set, get questions ─────────────────────────────────
  if (buildMode) {
    const orch = createOrchestrator({
      workflow: 'mode_questions',
      aiModel,
      traceContext: { conversationId, buildMode },
    })

    // PM Package flow
    if (buildMode === 'product_manager') {
      if (!pmPackage) {
        // Return PM package selection card
        orch.end({ stage: 'pm_package_selection' })
        return res.json({
          type: 'pm_package',
          intro: `I'll generate a full PM document stack for this project. Which depth do you need?`,
        })
      }
      // pmPackage selected → return PM-focused clarification questions
      try {
        const historyContext = buildHistoryContext(conversationHistory)
        const parsed = await orch.json('pm_questions', {
          tier: 'fast',
          maxTokens: 1000,
          system: INTAKE_TRIAGE,
          prompt: `User request: "${prompt}"${historyContext}
PM Package: ${pmPackage}

Generate 4-5 targeted PM discovery questions. Return JSON:
{
  "intro": "1-2 sentences confirming the PM package scope",
  "questions": [
    { "type": "short_answer | multiple_choice | multi_select | yes_no", "question": "...", "options": ["..."], "placeholder": "..." }
  ]
}`,
        })
        orch.end({ pmPackage, questionCount: parsed.questions?.length })
        return res.json({
          type: 'clarification_v2',
          intro: parsed.intro || `Setting up your ${pmPackage} PM package. A few questions:`,
          buildMode: 'product_manager',
          pmPackage,
          outputType: 'pm_brief',
          questions: (parsed.questions || []).slice(0, 5),
        })
      } catch (err) {
        return respondWithError(res, err, orch)
      }
    }

    // Role-specific flow
    if (ROLE_MODES.includes(buildMode)) {
      if (!rolePackage) {
        // Return role selection card (they already picked the role, so show confirm + domain questions)
        orch.end({ stage: 'role_package_selection' })
        const roleLabels = { operations: 'Operations', it_admin: 'IT Admin', compliance: 'Compliance/Risk', finance: 'Finance', hr: 'HR' }
        return res.json({
          type: 'role_package',
          role: buildMode,
          intro: `I'll generate a ${roleLabels[buildMode] || buildMode}-specific document package for this project.`,
        })
      }
      // rolePackage selected → return role-specific clarification questions
      try {
        const historyContext = buildHistoryContext(conversationHistory)
        const parsed = await orch.json('role_questions', {
          tier: 'fast',
          maxTokens: 1000,
          system: INTAKE_TRIAGE,
          prompt: `User request: "${prompt}"${historyContext}
Role: ${buildMode}. Package: ${rolePackage}

Generate 4-5 targeted discovery questions for a ${buildMode} role. Return JSON:
{
  "intro": "1-2 sentences confirming the ${buildMode} scope",
  "questions": [
    { "type": "short_answer | multiple_choice | multi_select | yes_no", "question": "...", "options": ["..."], "placeholder": "..." }
  ]
}`,
        })
        orch.end({ role: buildMode, rolePackage, questionCount: parsed.questions?.length })
        return res.json({
          type: 'clarification_v2',
          intro: parsed.intro || `Setting up your ${buildMode} package. A few targeted questions:`,
          buildMode,
          rolePackage,
          outputType: 'role_brief',
          questions: (parsed.questions || []).slice(0, 5),
        })
      } catch (err) {
        return respondWithError(res, err, orch)
      }
    }

    // Quick / Guided / Docs → clarification questions
    try {
      const historyContext = buildHistoryContext(conversationHistory)
      const isQuick = buildMode === 'quick'
      const parsed = await orch.json('mode_questions', {
        tier: 'fast',
        maxTokens: isQuick ? 600 : 1000,
        system: INTAKE_TRIAGE,
        prompt: `User request: "${prompt}"${historyContext}
Build mode: ${buildMode}

Generate ${isQuick ? '2-3 focused' : '4-5 deep'} discovery questions. Return JSON:
{
  "intro": "1-2 sentences confirming the project scope",
  "questions": [
    { "type": "short_answer | multiple_choice | multi_select | yes_no", "question": "...", "options": ["..."], "placeholder": "..." }
  ]
}`,
      })
      orch.end({ buildMode, questionCount: parsed.questions?.length })
      return res.json({
        type: isQuick ? 'clarification' : 'clarification_v2',
        intro: parsed.intro || '',
        buildMode,
        outputType: isQuick ? 'spec' : 'brief',
        questions: (parsed.questions || []).slice(0, isQuick ? 3 : 5),
      })
    } catch (err) {
      return respondWithError(res, err, orch)
    }
  }

  // ─── STAGE 1: Analyze prompt → recommend build mode ──────────────────────────
  const orch = createOrchestrator({
    workflow: 'intake_triage',
    aiModel,
    traceContext: { conversationId, promptLength: prompt.length },
  })

  try {
    const historyContext = buildHistoryContext(conversationHistory)

    const parsed = await orch.json('analyze_complexity', {
      tier: 'fast',
      maxTokens: 400,
      system: INTAKE_TRIAGE,
      prompt: `User request: "${prompt}"${historyContext}

Analyze the complexity and recommend a build mode. Return JSON:
{
  "recommendedMode": "quick | guided | docs | product_manager | operations | finance | hr | compliance | it_admin",
  "complexityReason": "1 sentence explaining why this mode fits"
}

Rules:
- quick: simple CRUD, single table, solo tool, no approvals
- guided: multi-role workflows, approvals, automations, integrations
- docs: compliance required, multi-stakeholder sign-off needed
- product_manager: user explicitly mentions PRD, product brief, or PM deliverables
- operations/finance/hr/compliance/it_admin: request is clearly from or for that specific function`,
    })

    orch.end({ recommendedMode: parsed.recommendedMode })
    return res.json({
      type: 'build_mode',
      recommendedMode: parsed.recommendedMode || 'guided',
      complexityReason: parsed.complexityReason || '',
    })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}

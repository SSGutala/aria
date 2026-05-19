/**
 * /api/task-brief — Briefs for Task Modes (fullstack, automation, dashboard,
 * knowledge, workflow). Each mode is defined in api/taskModes/<mode>.js with
 * its own system prompt, schema, stage map, and model tier.
 *
 * This handler is a thin dispatcher:
 *   - Validate mode + inputs
 *   - Run the per-mode prompt via the orchestrator
 *   - Normalize appSpec
 *   - Persist artifacts + brief message
 *   - Fire-and-forget file generation
 *
 * Refactored 2026-05 to use orchestrator + observability.
 * Per-mode system prompts and schemas in api/taskModes/<mode>.js are unchanged.
 */

import { createOrchestrator, respondWithError } from './lib/orchestrator.js'
import { logWarn } from './lib/observability.js'
import { devlog, devlogError } from './lib/devlog.js'
import {
  getUserId,
  normalizeAppSpec,
  persistArtifacts,
  persistBriefMessage,
  fireForgetFileGen,
  buildContext,
} from './utils/briefGenerators.js'
import { TASK_MODES, TASK_MODE_NAMES } from './taskModes/index.js'

// Map the per-mode `modelTier` string (fast|medium|smart) used by taskModes
// configs into the orchestrator's tier vocabulary.
function toOrchTier(modelTier) {
  if (modelTier === 'smart') return 'smart'
  if (modelTier === 'fast')  return 'fast'
  return 'balanced'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' })

  const { prompt, conversationId, buildMode, clarificationAnswers, conversationHistory, aiModel } = req.body || {}
  if (!prompt || !conversationId) {
    return res.status(400).json({ error: 'Missing required fields: prompt, conversationId', code: 'missing_fields' })
  }
  if (!TASK_MODE_NAMES.includes(buildMode)) {
    return res.status(400).json({
      error: `Unknown task mode "${buildMode}". Supported: ${TASK_MODE_NAMES.join(', ')}`,
      code: 'unknown_mode',
    })
  }

  const mode = TASK_MODES[buildMode]
  const { answersBlock, historyBlock } = buildContext({ clarificationAnswers, conversationHistory })

  const orch = createOrchestrator({
    workflow: 'task_brief',
    aiModel,
    traceContext: { conversationId, taskMode: buildMode },
  })

  try {
    const brief = await orch.json('generate_task_brief', {
      tier: toOrchTier(mode.modelTier),
      maxTokens: mode.maxTokens,
      system: mode.system,
      prompt: mode.buildPrompt(prompt, answersBlock, historyBlock),
    })

    if (brief.appSpec) normalizeAppSpec(brief.appSpec)

    // Persist artifacts + brief message
    const userId = await getUserId(conversationId)
    const appTitle = brief.appSpec?.appTitle
      || brief.intakeSummary?.understood?.split(/\s+/).slice(0, 3).join(' ')
      || mode.label

    const { artifactIds, createdArtifacts } = await persistArtifacts({
      brief,
      stageMap: mode.stageMap,
      conversationId,
      userId,
      appTitle,
      prompt,
      metadata: { taskMode: buildMode, traceId: orch.traceId },
    })

    await persistBriefMessage({
      conversationId,
      brief,
      buildMode,
      artifactIds,
      extra: { taskMode: buildMode, traceId: orch.traceId },
    })

    fireForgetFileGen(createdArtifacts)

    orch.end({ taskMode: buildMode, artifactCount: createdArtifacts.length, hasAppSpec: !!brief.appSpec })
    devlog('task_brief.generated', { conversationId, buildMode, traceId: orch.traceId })

    // Surface a perf warning if total wall time creeps high (preserved from prior behavior)
    return res.json({
      brief,
      buildMode,
      artifactIds,
      traceId: orch.traceId,
    })
  } catch (err) {
    // Special-case malformed JSON to a 502 + json_parse_error code (preserves prior contract)
    if (err?.message?.includes('malformed JSON') || err?.message?.includes('No valid JSON')) {
      orch.fail(err)
      logWarn('task_brief.json_parse_error', { traceId: orch.traceId, taskMode: buildMode })
      devlogError('task_brief.generation_failed', { conversationId, buildMode, error: err.message })
      return res.status(502).json({
        error: 'AI returned malformed JSON',
        userMessage: 'The AI returned an unparseable response. Try rephrasing your request more concretely.',
        code: 'json_parse_error',
        traceId: orch.traceId,
        retryable: true,
      })
    }
    devlogError('task_brief.generation_failed', { conversationId, buildMode, error: err.message })
    return respondWithError(res, err, orch)
  }
}

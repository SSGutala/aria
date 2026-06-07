/**
 * Provider-agnostic model router for the app generation engine.
 *
 * Every generation stage calls `generateWithModel(...)` instead of talking to a
 * provider directly. The router picks a provider per task type (configurable),
 * then routes through Aria's existing orchestrator + ai-client (which already
 * supports Claude / Groq / Ollama and handles fallback).
 *
 * Nothing here is vendor-locked. Ollama is a first-class option — in fact the
 * default for heavy codegen — so the whole pipeline can run locally for $0.
 *
 *   const plan = await generateWithModel({
 *     taskType: 'plan',
 *     system: PLAN_SYSTEM,
 *     prompt: '...',
 *     context: { brief, spec },
 *     expectedOutputFormat: 'json',
 *   })
 */

import { createOrchestrator } from './orchestrator.js'
import {
  buildFailoverChain,
  isRateLimitError,
  markCoolingDown,
  markHealthy,
} from './providerHealth.js'
import { devlog } from './devlog.js'

export const PROVIDERS = ['gemini', 'claude', 'groq', 'ollama']

// Per-stage default provider + quality tier. The default provider comes from
// APP_ENGINE_PROVIDER (env), defaulting to 'gemini' — free, fast, and generous
// free tier (1M tokens/min for Flash). Automatic fallback chain via ai-client:
// Gemini → Claude → Groq. Users can override any stage through providerConfig
// (e.g. flip to 'groq' in Settings for rate-limit tolerance, or 'ollama' for
// a fully-local $0 run).
//   tier: 'fast' | 'balanced' | 'smart' (maps to model strength in ai-client;
//   ignored by Ollama, which uses OLLAMA_MODEL).
const ENGINE_PROVIDER = process.env.APP_ENGINE_PROVIDER || 'gemini'

export const STAGE_DEFAULTS = {
  plan:      { provider: ENGINE_PROVIDER, tier: 'smart' },
  file_tree: { provider: ENGINE_PROVIDER, tier: 'balanced' },
  codegen:   { provider: ENGINE_PROVIDER, tier: 'smart' },
  repair:    { provider: ENGINE_PROVIDER, tier: 'smart' },
  // Creative Director + Frontend Polish Agent — runs after the functional build
  // to infer the app's domain and redesign the UI. Uses the strongest tier so
  // the design judgment + faithful behavior-preserving rewrite hold up.
  polish:    { provider: ENGINE_PROVIDER, tier: 'smart' },
  transform: { provider: ENGINE_PROVIDER, tier: 'fast' },
  summary:   { provider: ENGINE_PROVIDER, tier: 'fast' },
}

const DEFAULT_FALLBACK = { provider: ENGINE_PROVIDER, tier: 'balanced' }

function stringifyContext(context) {
  if (!context) return ''
  if (typeof context === 'string') return context
  try { return JSON.stringify(context, null, 2) } catch { return String(context) }
}

/**
 * The single interface every generation stage uses.
 *
 * @param {object}  opts
 * @param {string} [opts.provider]            explicit provider override ('claude'|'groq'|'ollama')
 * @param {string} [opts.model]               explicit model id (forward-compatible; see note below)
 * @param {string}  opts.taskType             'plan'|'file_tree'|'codegen'|'repair'|'transform'|'summary'
 * @param {string}  opts.prompt               the instruction
 * @param {object|string} [opts.context]      project context (brief, spec, prior files, etc.)
 * @param {string} [opts.system]              system prompt
 * @param {'json'|'text'} [opts.expectedOutputFormat='text']
 * @param {number} [opts.maxTokens]
 * @param {string} [opts.tier]                override the stage's default tier
 * @param {object} [opts.providerConfig]      { [taskType]: { provider, tier } } per-run overrides
 * @param {string} [opts.aiModel]             legacy alias for provider
 * @returns {Promise<any>} parsed JSON (expectedOutputFormat='json') or text
 *
 * NOTE: per-call `model` override is accepted for forward-compatibility but not
 * yet enforced — ai-client currently resolves the concrete model from the
 * provider + tier (and OLLAMA_MODEL for Ollama). Wiring an explicit model
 * override is a small follow-up.
 */
export async function generateWithModel(opts) {
  const {
    provider,
    taskType = 'codegen',
    prompt = '',
    context,
    system,
    expectedOutputFormat = 'text',
    maxTokens = 4000,
    tier,
    providerConfig = {},
    aiModel,
  } = opts || {}

  const stageDefault = STAGE_DEFAULTS[taskType] || DEFAULT_FALLBACK
  const override = providerConfig[taskType] || {}
  const preferred = provider || aiModel || override.provider || stageDefault.provider
  const resolvedTier = tier || override.tier || stageDefault.tier

  const ctxStr = stringifyContext(context)
  const fullPrompt = ctxStr ? `${ctxStr}\n\n---\n\n${prompt}` : prompt

  // Automatic provider failover. Try the preferred cloud provider first; on a
  // rate-limit / quota error, cool it down and fail over to the next candidate
  // (other cloud provider → local Ollama). Cooled-down cloud providers are
  // skipped until their timer expires, at which point they're preferred again.
  const chain = buildFailoverChain(preferred)
  let lastErr

  for (let i = 0; i < chain.length; i++) {
    const candidate = chain[i]
    const orch = createOrchestrator({
      workflow: `appgen_${taskType}`,
      aiModel: candidate,
      traceContext: { taskType, provider: candidate, tier: resolvedTier, failoverStep: i },
    })

    try {
      const runner = expectedOutputFormat === 'json' ? orch.json : orch.text
      const result = await runner(taskType, {
        tier: resolvedTier,
        maxTokens,
        system,
        prompt: fullPrompt,
      })
      orch.end({ provider: candidate, format: expectedOutputFormat })
      markHealthy(candidate)
      if (i > 0) {
        devlog('appgen.failover_succeeded', { taskType, from: chain[0], to: candidate })
      }
      return result
    } catch (err) {
      orch.fail(err, { provider: candidate })
      // Only fail over on rate-limit/quota errors, and never away from Ollama
      // (it's the local last resort). Other errors propagate immediately.
      const canFailover = candidate !== 'ollama' && isRateLimitError(err) && i < chain.length - 1
      if (canFailover) {
        markCoolingDown(candidate, err)
        devlog('appgen.failover_switch', { taskType, from: candidate, to: chain[i + 1], reason: 'rate_limit' })
        // Record switch event so the frontend can show a toast notification
        import('./tokenTracker.js').then(({ trackSwitch }) => trackSwitch(candidate, chain[i + 1], 'rate_limit')).catch(() => {})
        lastErr = err
        continue
      }
      throw err
    }
  }

  throw lastErr || new Error('All providers failed for ' + taskType)
}

/** Resolve which provider a given stage will actually use right now (for telemetry / UI). */
export function resolveStageProvider(taskType, providerConfig = {}) {
  const preferred = providerConfig[taskType]?.provider
    || (STAGE_DEFAULTS[taskType] || DEFAULT_FALLBACK).provider
  // Reflect any active cooldown-driven failover so the UI shows the real provider.
  return buildFailoverChain(preferred)[0]
}

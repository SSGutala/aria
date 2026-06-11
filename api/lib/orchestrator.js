/**
 * ARIA Orchestrator
 *
 * The single point of coordination for every AI call in the platform.
 *
 * What this gives us that direct createMessage() did not:
 *   1. Structured traces for every workflow (one trace per request)
 *   2. Structured spans for every AI call (with model, tokens, latency)
 *   3. Intelligent model tier selection (fast / smart / reasoning)
 *   4. Centralized retry + fallback logic (Claude → Groq → Ollama)
 *   5. Resilient JSON extraction with auto-repair
 *   6. Cost telemetry hooks (token usage emitted per span)
 *   7. A clean API surface that endpoints can use without touching providers
 *
 * Endpoints should NOT import ai-client directly anymore.
 * They should import this module and use orchestrator.run() or orchestrator.json().
 */

import { createMessage } from '../ai-client.js'
import { startTrace, logError, logWarn } from './observability.js'

// ─── Model tier selection ─────────────────────────────────────────────────────
// "fast"      → cheap, low-latency. Used for triage, classification, simple JSON.
// "balanced"  → default. Used for spec/brief generation.
// "smart"     → highest quality. Used for complex briefs, deep reasoning, edits.
//
// The actual model picked depends on the user's selected aiModel
// (claude/groq/ollama) and the tier. ai-client.js handles the mapping.
const TIER_TO_FLAGS = {
  fast:     { smart: false, modelTier: 'fast' },
  balanced: { smart: false, modelTier: 'medium' },
  smart:    { smart: true,  modelTier: 'smart' },
}

function resolveTier(tier) {
  return TIER_TO_FLAGS[tier] || TIER_TO_FLAGS.balanced
}

// ─── Resilient JSON extraction ────────────────────────────────────────────────
// AI responses sometimes include code fences, preamble, or truncated trailing
// braces. This walks the string character-by-character to find a complete
// top-level object, with fallbacks for truncated output.
function extractJSON(text) {
  if (!text) throw new Error('Empty response from AI')

  const stripped = String(text)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  // Fast path: direct parse
  try { return JSON.parse(stripped) } catch {}

  // Walk to find the first complete JSON object
  let depth = 0, start = -1, inString = false, escape = false
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{' || ch === '[') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(stripped.slice(start, i + 1)) } catch {}
      }
    }
  }

  // Last resort: try to auto-close a truncated object
  if (start !== -1) {
    const partial = stripped.slice(start)
    for (let closes = 1; closes <= 15; closes++) {
      try { return JSON.parse(partial + '}'.repeat(closes)) } catch {}
      try { return JSON.parse(partial + ']'.repeat(closes)) } catch {}
    }
  }

  throw new Error('AI returned malformed JSON that could not be auto-repaired')
}

// ─── Token estimation (rough heuristic for telemetry) ─────────────────────────
function estimateTokens(text) {
  if (!text) return 0
  return Math.ceil(String(text).length / 4)
}

// ═════════════════════════════════════════════════════════════════════════════
// Orchestrator class — usage:
//
//   const orch = createOrchestrator({ workflow: 'generate_brief', aiModel, req })
//   const brief = await orch.json('narrative', { system, prompt, tier: 'smart' })
//   const diagram = await orch.text('mermaid', { prompt, tier: 'fast' })
//   orch.end({ outputType, stages: 7 })
//
// ═════════════════════════════════════════════════════════════════════════════
export function createOrchestrator({ workflow, aiModel, traceContext = {} }) {
  const trace = startTrace(workflow, { aiModel: aiModel || 'default', ...traceContext })

  let tokensIn = 0
  let tokensOut = 0
  let callCount = 0

  async function execute(stepName, { system, prompt, messages, tier, maxTokens, parseJson }) {
    const span = trace.span(stepName, { tier: tier || 'balanced' })
    const flags = resolveTier(tier)

    // Build messages array if not provided
    const msgs = messages || [{ role: 'user', content: prompt || '' }]
    const inputText = (system || '') + msgs.map(m => m.content).join('\n')
    const inputTokens = estimateTokens(inputText)

    try {
      const res = await createMessage({
        system,
        messages: msgs,
        max_tokens: maxTokens || 4000,
        smart: flags.smart,
        modelTier: flags.modelTier,
        aiModel,
        expectJson: !!parseJson,   // → provider JSON mode (forces valid JSON, no fences)
      })

      const text = res?.content?.[0]?.text || ''
      const outputTokens = estimateTokens(text)
      tokensIn += inputTokens
      tokensOut += outputTokens
      callCount++

      span.end({
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        responseChars: text.length,
      })

      if (parseJson) {
        try {
          return extractJSON(text)
        } catch (parseErr) {
          logWarn('orchestrator.json_parse_failed', {
            traceId: trace.traceId,
            spanId: span.spanId,
            step: stepName,
            preview: text.slice(0, 200),
          })
          throw parseErr
        }
      }

      return text
    } catch (err) {
      span.fail(err, { inputTokens })
      throw err
    }
  }

  return {
    traceId: trace.traceId,

    /**
     * Run a step that returns raw text.
     *   await orch.text('mermaid_diagram', { prompt: '...', tier: 'fast' })
     */
    async text(stepName, opts) {
      return execute(stepName, { ...opts, parseJson: false })
    },

    /**
     * Run a step that returns JSON. Auto-extracts and parses.
     *   await orch.json('analyze', { system, prompt: '...', tier: 'balanced' })
     */
    async json(stepName, opts) {
      return execute(stepName, { ...opts, parseJson: true })
    },

    /**
     * Finish the workflow trace successfully.
     */
    end(metadata = {}) {
      trace.end({ callCount, tokensIn, tokensOut, totalTokens: tokensIn + tokensOut, ...metadata })
    },

    /**
     * Finish the workflow trace with an error.
     */
    fail(err, metadata = {}) {
      trace.fail(err, { callCount, tokensIn, tokensOut, ...metadata })
    },
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Convenience: error → user-friendly response mapping for HTTP handlers
// ═════════════════════════════════════════════════════════════════════════════
export function mapErrorToResponse(err) {
  const status = err?.status || err?.statusCode
  const msg = err?.message || ''

  if (msg.includes('timeout')) {
    return {
      httpStatus: 504,
      userMessage: 'The AI service took too long to respond. Please retry — it usually works on the second attempt.',
      retryable: true,
    }
  }
  if (status === 429 || msg.includes('rate limit')) {
    return {
      httpStatus: 429,
      userMessage: 'Rate limited. Aria is taking a quick breather — try again in 30 seconds.',
      retryable: true,
    }
  }
  if (status === 401 || msg.includes('authentication')) {
    return {
      httpStatus: 401,
      userMessage: 'Authentication failure connecting to the AI provider. Check API credentials.',
      retryable: false,
    }
  }
  if (msg.includes('credit balance') || msg.includes('billing') || msg.includes('Both Anthropic and Groq failed')) {
    return {
      httpStatus: 503,
      userMessage: 'AI provider credits exhausted and all fallback providers are unavailable. Switch model in settings or top up credits.',
      retryable: false,
    }
  }
  if (msg.includes('Ollama not available') || msg.includes('ECONNREFUSED') || msg.includes('connect ETIMEDOUT')) {
    return {
      httpStatus: 503,
      userMessage: 'Local Ollama is not running. Start it with "ollama serve", or switch the model selector to Groq or Claude.',
      retryable: false,
    }
  }
  if (msg.includes('No valid JSON') || msg.includes('malformed JSON')) {
    return {
      httpStatus: 502,
      userMessage: 'The AI returned an unparseable response. Try rephrasing your request more concretely.',
      retryable: true,
    }
  }
  if (status === 503 || status >= 500) {
    return {
      httpStatus: 503,
      userMessage: 'AI service is temporarily unavailable. Aria is auto-failing over — please retry.',
      retryable: true,
    }
  }
  return {
    httpStatus: 500,
    userMessage: 'Something went wrong generating that. Please retry.',
    retryable: true,
  }
}

/**
 * Standard error response writer. Use in catch blocks of HTTP handlers.
 *   try { ... } catch (err) { return respondWithError(res, err, orch) }
 */
export function respondWithError(res, err, orch) {
  if (orch) orch.fail(err)
  const { httpStatus, userMessage, retryable } = mapErrorToResponse(err)
  logError('handler.error', {
    traceId: orch?.traceId,
    httpStatus,
    errorMessage: err?.message,
    errorName: err?.name,
    errorStatus: err?.status,
  })
  return res.status(httpStatus).json({
    error: userMessage,
    userMessage,
    retryable,
    traceId: orch?.traceId,
  })
}

// Re-export extractJSON for endpoints that need raw access
export { extractJSON }

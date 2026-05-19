/**
 * ARIA Observability Layer
 *
 * Provides structured tracing for every AI orchestration call.
 *
 * Every workflow gets a trace ID. Every step within a workflow gets a span ID.
 * Spans capture: model used, tokens consumed, latency, success/failure, errors.
 *
 * This is the foundation for:
 *   - Cost tracking per workflow / per user
 *   - Latency monitoring
 *   - Hallucination / failure rate detection
 *   - Operational replay
 *   - Enterprise audit reconstruction
 *
 * Currently logs to stdout in structured JSON. Drop-in pluggable for
 * Datadog/Honeycomb/OpenTelemetry later — same span shape.
 */

import { randomUUID } from 'crypto'

const ENV = process.env.NODE_ENV || 'development'
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase()
const LEVEL_RANK = { debug: 10, info: 20, warn: 30, error: 40 }

function shouldLog(level) {
  return LEVEL_RANK[level] >= (LEVEL_RANK[LOG_LEVEL] || 20)
}

function emit(level, event, fields) {
  if (!shouldLog(level)) return
  const record = {
    ts: new Date().toISOString(),
    level,
    event,
    env: ENV,
    ...fields,
  }
  // Pretty-print in dev for readability; JSON in prod for log aggregators
  if (ENV === 'development') {
    const label = `[${level.toUpperCase()}] ${event}`
    const meta = Object.entries(fields)
      .filter(([k]) => !['traceId', 'spanId'].includes(k))
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' ')
    const trace = fields.traceId ? ` trace=${fields.traceId.slice(0, 8)}` : ''
    console.log(`${label}${trace} ${meta}`)
  } else {
    console.log(JSON.stringify(record))
  }
}

/**
 * Start a new trace for a complete workflow (e.g. "generate brief for prompt X").
 * Returns a Trace object with methods to create spans.
 */
export function startTrace(workflow, context = {}) {
  const traceId = randomUUID()
  const startedAt = Date.now()

  emit('info', 'trace.start', { traceId, workflow, ...context })

  return {
    traceId,
    workflow,
    context,

    /**
     * Start a span within this trace. Returns a Span object.
     * Call span.end({ ... }) to finish and emit metrics.
     */
    span(name, spanContext = {}) {
      const spanId = randomUUID().slice(0, 8)
      const spanStartedAt = Date.now()

      emit('debug', 'span.start', { traceId, spanId, span: name, ...spanContext })

      return {
        traceId,
        spanId,
        name,

        /**
         * Finish the span successfully. Pass metadata like tokens, model, etc.
         */
        end(metadata = {}) {
          const durationMs = Date.now() - spanStartedAt
          emit('info', 'span.end', {
            traceId,
            spanId,
            span: name,
            ok: true,
            durationMs,
            ...metadata,
          })
          return { durationMs, ...metadata }
        },

        /**
         * Finish the span with an error.
         */
        fail(err, metadata = {}) {
          const durationMs = Date.now() - spanStartedAt
          emit('error', 'span.end', {
            traceId,
            spanId,
            span: name,
            ok: false,
            durationMs,
            errorName: err?.name,
            errorMessage: err?.message,
            errorStatus: err?.status,
            ...metadata,
          })
        },
      }
    },

    /**
     * Finish the trace.
     */
    end(metadata = {}) {
      const durationMs = Date.now() - startedAt
      emit('info', 'trace.end', { traceId, workflow, durationMs, ...metadata })
    },

    fail(err, metadata = {}) {
      const durationMs = Date.now() - startedAt
      emit('error', 'trace.end', {
        traceId,
        workflow,
        ok: false,
        durationMs,
        errorName: err?.name,
        errorMessage: err?.message,
        ...metadata,
      })
    },
  }
}

/**
 * Convenience: emit a one-off info log with optional trace correlation.
 */
export function logInfo(event, fields = {}) {
  emit('info', event, fields)
}

export function logWarn(event, fields = {}) {
  emit('warn', event, fields)
}

export function logError(event, fields = {}) {
  emit('error', event, fields)
}

export function logDebug(event, fields = {}) {
  emit('debug', event, fields)
}

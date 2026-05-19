// Centralized error handling for Aria.
//
// Public surface:
//   - ErrorTypes               typed enum of error categories
//   - AppError                 normalized error object thrown by apiCall
//   - classifyError(err, res)  derive an ErrorType from a raw error / response
//   - mapMessage(type, ctx)    user-friendly guidance string
//   - logError(err, ctx)       telemetry hook (currently console)
//   - apiCall(url, opts, cfg)  fetch wrapper: timeout + exponential backoff retry

export const ErrorTypes = Object.freeze({
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  SERVER: 'server',
  AUTH: 'auth',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown',
})

const RETRYABLE_TYPES = new Set([
  ErrorTypes.NETWORK,
  ErrorTypes.TIMEOUT,
  ErrorTypes.RATE_LIMIT,
  ErrorTypes.SERVER,
])

export class AppError extends Error {
  constructor({ type, userMessage, status, retryAfter, context, cause, traceId, retryable }) {
    super(userMessage || mapMessage(type, context))
    this.name = 'AppError'
    this.type = type
    this.userMessage = userMessage || mapMessage(type, context)
    this.status = status ?? null
    this.retryAfter = retryAfter ?? null
    // Server can override retryable hint; otherwise infer from type
    this.retryable = retryable ?? RETRYABLE_TYPES.has(type)
    this.context = context || {}
    this.cause = cause || null
    this.traceId = traceId || null
  }
}

export function classifyError(err, response) {
  if (response) {
    const s = response.status
    if (s === 401 || s === 403) return ErrorTypes.AUTH
    if (s === 408) return ErrorTypes.TIMEOUT
    if (s === 429) return ErrorTypes.RATE_LIMIT
    if (s >= 500) return ErrorTypes.SERVER
    if (s === 400 || s === 422) return ErrorTypes.VALIDATION
    if (s >= 400) return ErrorTypes.UNKNOWN
  }
  if (err) {
    if (err.name === 'AbortError') return ErrorTypes.TIMEOUT
    const msg = (err.message || '').toLowerCase()
    if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')) {
      return ErrorTypes.NETWORK
    }
    if (msg.includes('timeout')) return ErrorTypes.TIMEOUT
  }
  return ErrorTypes.UNKNOWN
}

export function mapMessage(type, context = {}) {
  const what = context.action ? ` while ${context.action}` : ''
  switch (type) {
    case ErrorTypes.NETWORK:
      return `Connection lost${what}. Check your internet and try again.`
    case ErrorTypes.TIMEOUT:
      return `The request timed out${what}. The server may be busy — retry in a moment.`
    case ErrorTypes.RATE_LIMIT:
      return context.retryAfter
        ? `API is busy. Retrying in ${context.retryAfter}s...`
        : `API is busy. Please wait a moment and try again.`
    case ErrorTypes.SERVER:
      return `Service temporarily unavailable${what}. Retry in about a minute.`
    case ErrorTypes.AUTH:
      return `Your session expired. Please sign in again to continue.`
    case ErrorTypes.VALIDATION:
      return context.field
        ? `Please clarify: ${context.field}.`
        : `That input didn't go through. Please review and try again.`
    case ErrorTypes.UNKNOWN:
    default:
      return `Something went wrong${what}. Please try again.`
  }
}

export function logError(err, context = {}) {
  const payload = {
    name: err?.name,
    type: err?.type || classifyError(err),
    status: err?.status ?? null,
    message: err?.message,
    stack: err?.stack,
    context,
    at: new Date().toISOString(),
  }
  console.error('[Aria error]', payload)
  // Hook for remote telemetry (e.g. Sentry) — left intentionally unwired.
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseRetryAfter(response) {
  const raw = response.headers?.get?.('Retry-After')
  if (!raw) return null
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

// fetch wrapper with timeout + exponential backoff retry.
// On final failure, throws AppError — never a raw fetch/network error.
export async function apiCall(url, options = {}, config = {}) {
  const {
    retries = 2,
    timeoutMs = 60_000,
    baseDelayMs = 500,
    context = {},
    onRetry = null,
  } = config

  let attempt = 0
  let lastErr = null
  let lastResponse = null

  while (attempt <= retries) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timer)

      if (response.ok) return response

      // Response present but non-2xx — classify and decide whether to retry.
      lastResponse = response
      const type = classifyError(null, response)
      const retryAfter = parseRetryAfter(response)
      const isRetryable = RETRYABLE_TYPES.has(type)

      if (isRetryable && attempt < retries) {
        const backoff = retryAfter != null
          ? retryAfter * 1000
          : baseDelayMs * Math.pow(2, attempt)
        if (onRetry) onRetry({ attempt: attempt + 1, type, delayMs: backoff })
        await sleep(backoff)
        attempt++
        continue
      }

      // Non-retryable or out of attempts — read body for server-provided detail.
      let body = null
      try { body = await response.clone().json() } catch { /* ignore */ }
      throw new AppError({
        type,
        userMessage: body?.userMessage || body?.error,  // Support both field names
        status: response.status,
        retryAfter,
        traceId: body?.traceId,
        retryable: body?.retryable,
        context: { ...context, serverError: body?.error, traceId: body?.traceId },
      })
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof AppError) throw err

      lastErr = err
      const type = classifyError(err)
      const isRetryable = RETRYABLE_TYPES.has(type)
      if (isRetryable && attempt < retries) {
        const backoff = baseDelayMs * Math.pow(2, attempt)
        if (onRetry) onRetry({ attempt: attempt + 1, type, delayMs: backoff })
        await sleep(backoff)
        attempt++
        continue
      }
      throw new AppError({ type, context, cause: err })
    }
  }

  // Theoretically unreachable, but keep a typed exit just in case.
  throw new AppError({
    type: classifyError(lastErr, lastResponse),
    context,
    cause: lastErr,
  })
}

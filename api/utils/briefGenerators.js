/**
 * Shared utilities for AI-generated enterprise briefs.
 *
 * Used by /api/brief, /api/pm-brief, /api/role-brief, and /api/task-brief.
 * Centralizes: JSON extraction, retry/backoff, Supabase persistence, artifact
 * creation, appSpec normalization, and fire-and-forget file generation.
 */
import { createClient } from '@supabase/supabase-js'

let _supabase = null
export function getSupabase() {
  if (_supabase) return _supabase
  _supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  )
  return _supabase
}

/**
 * Robust JSON extractor — tolerates code fences, leading prose, and truncated
 * objects by walking the brace structure and trying incremental auto-closes.
 */
export function extractJSON(text) {
  const stripped = String(text || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  try { return JSON.parse(stripped) } catch {}

  let depth = 0, start = -1, inString = false, escape = false
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') { if (depth === 0) start = i; depth++ }
    else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(stripped.slice(start, i + 1)) } catch {}
      }
    }
  }

  if (start !== -1) {
    const partial = stripped.slice(start)
    for (let c = 1; c <= 15; c++) {
      try { return JSON.parse(partial + '}'.repeat(c)) } catch {}
    }
  }

  throw new Error('No valid JSON found in response')
}

/**
 * Retry a function with exponential backoff. Only retries transient errors
 * (5xx, 429, network). 4xx errors that aren't 429 bubble immediately.
 */
export async function withRetry(fn, { retries = 2, baseDelay = 800, label = 'op' } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt)
    } catch (err) {
      lastErr = err
      const status = err?.status || err?.statusCode
      const isTransient = !status || status === 429 || status >= 500
      if (!isTransient || attempt === retries) throw err
      const delay = baseDelay * Math.pow(2, attempt)
      console.warn(`[${label}] attempt ${attempt + 1} failed (${status || err.message}); retrying in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

export async function getUserId(conversationId) {
  const sb = getSupabase()
  const { data } = await sb.from('conversations').select('user_id').eq('id', conversationId).single()
  return data?.user_id || null
}

/**
 * Normalize appSpec.workflowType into one of three valid values and ensure
 * every field has a snake_case `name` derived from its label.
 */
export function normalizeAppSpec(appSpec) {
  if (!appSpec) return appSpec
  const validTypes = ['approval_workflow', 'intake_tracker', 'status_board']
  if (!validTypes.includes(appSpec.workflowType)) {
    const wf = (appSpec.workflowType || '').toLowerCase()
    if (/approv|review|request|procure|budget/.test(wf)) appSpec.workflowType = 'approval_workflow'
    else if (/intake|ticket|incident|support|case/.test(wf)) appSpec.workflowType = 'intake_tracker'
    else appSpec.workflowType = 'status_board'
  }
  if (Array.isArray(appSpec.fields)) {
    appSpec.fields = appSpec.fields.map(f => ({
      ...f,
      name: f.name || (f.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    }))
  }
  return appSpec
}

/**
 * Persist each top-level brief section as an individual `artifacts` row.
 * Returns { artifactIds, createdArtifacts }.
 */
export async function persistArtifacts({ brief, stageMap, conversationId, userId, appTitle, prompt, metadata = {} }) {
  const sb = getSupabase()
  const artifactIds = {}
  const createdArtifacts = []

  for (const stage of stageMap) {
    const content = brief[stage.key]
    if (!content) continue
    const { data: artifact, error } = await sb.from('artifacts').insert({
      conversation_id: conversationId,
      user_id: userId,
      artifact_type: stage.type,
      title: `${appTitle} — ${stage.label}`,
      content,
      source_prompt: prompt,
      version: 1,
      status: 'draft',
      file_urls: {},
      metadata,
    }).select().single()

    if (!error && artifact) {
      artifactIds[stage.type] = artifact.id
      createdArtifacts.push(artifact)
    } else if (error) {
      console.error(`Artifact insert failed for ${stage.type}:`, error.message)
    }
  }

  return { artifactIds, createdArtifacts }
}

/**
 * Save the `enterprise_brief` confirmation message that the UI renders.
 */
export async function persistBriefMessage({ conversationId, brief, buildMode, artifactIds, extra = {} }) {
  const sb = getSupabase()
  const { error } = await sb.from('messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: '',
    message_type: 'confirmation',
    metadata: { cardType: 'enterprise_brief', brief, buildMode, artifactIds, ...extra },
  })
  if (error) console.error('Brief message persist failed:', error.message)
}

/**
 * Fire-and-forget file generation for each artifact. Returns immediately;
 * generation happens in the background and never blocks the response.
 */
export function fireForgetFileGen(createdArtifacts) {
  Promise.all(createdArtifacts.map(async artifact => {
    try {
      const { default: genFiles } = await import('../artifacts-generate-files.js')
      const fakeReq = { method: 'POST', params: { id: artifact.id }, url: `/api/artifacts/${artifact.id}/files` }
      const fakeRes = { status: () => ({ json: () => {} }), json: () => {}, redirect: () => {} }
      await genFiles(fakeReq, fakeRes)
    } catch (e) {
      console.error(`File gen failed for ${artifact.id}:`, e.message)
    }
  })).catch(() => {})
}

/**
 * Build the standard prompt context fragments. Mode handlers compose these
 * into the user message they send to the model.
 */
export function buildContext({ clarificationAnswers, conversationHistory }) {
  const answersBlock = clarificationAnswers
    ? `\n\nUser clarifications:\n${typeof clarificationAnswers === 'string'
        ? clarificationAnswers
        : Object.entries(clarificationAnswers).map(([q, a]) => `Q: ${q}\nA: ${Array.isArray(a) ? a.join(', ') : a}`).join('\n\n')}`
    : ''

  const historyBlock = conversationHistory?.length
    ? `\n\nConversation context:\n${conversationHistory
        .slice(-4)
        .map(m => `${m.role === 'user' ? 'User' : 'Aria'}: ${m.content}`)
        .filter(l => !l.endsWith(': '))
        .join('\n')}`
    : ''

  return { answersBlock, historyBlock }
}

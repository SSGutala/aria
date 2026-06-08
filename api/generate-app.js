/**
 * POST /api/generate-app — staged, provider-agnostic app generation (Phase 1).
 *
 * Runs the real multi-stage pipeline (plan → file tree → per-file codegen →
 * assemble → summary) and returns the generated project file map. Defaults to
 * Ollama so it can run locally for $0.
 *
 * This is ADDITIVE — it does not touch the legacy /api/build template engine or
 * the existing UI. Persistence as a project asset (Phase 2) and Sandpack preview
 * (Phase 3) build on the { files } map this returns.
 *
 * Body: { conversationId, prompt, context?, providerConfig? }
 *   - context: approved artifacts to ground generation. If omitted, the latest
 *     enterprise brief for the conversation is used.
 */

import { createClient } from '@supabase/supabase-js'
import { runAppPipeline } from './lib/appPipeline.js'
import { devlog, devlogError } from './lib/devlog.js'
import { isCoolingDown, msUntilAvailable, getProviderHealth } from './lib/providerHealth.js'

// Turn a single selected provider (e.g. 'groq' from Settings) into a per-stage
// providerConfig so the WHOLE pipeline runs on it. Without this, the pipeline
// silently falls back to STAGE_DEFAULTS and ignores the user's choice.
const APP_STAGES = ['plan', 'file_tree', 'codegen', 'repair', 'polish', 'transform', 'summary']
function providerConfigFromModel(aiModel) {
  // Pin EVERY pipeline stage to the user's selected provider so their choice is
  // honored end-to-end (including 'gemini', so it can't drift to a stage default).
  if (!aiModel || !['gemini', 'claude', 'groq', 'ollama'].includes(aiModel)) return {}
  return Object.fromEntries(APP_STAGES.map(s => [s, { provider: aiModel }]))
}
function resolveProviderConfig(providerConfig, aiModel) {
  if (providerConfig && Object.keys(providerConfig).length) return providerConfig
  return providerConfigFromModel(aiModel)
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

// Pull the most useful approved artifacts for this conversation as generation context.
async function gatherContext(conversationId) {
  const ctx = {}
  try {
    // Latest enterprise brief card (has the full brief object).
    const { data: briefMsg } = await supabase
      .from('messages')
      .select('metadata')
      .eq('conversation_id', conversationId)
      .eq('message_type', 'confirmation')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (briefMsg?.metadata?.brief) ctx.brief = briefMsg.metadata.brief

    // Approved/draft artifacts (product brief, data model, app spec, etc.).
    const { data: artifacts } = await supabase
      .from('artifacts')
      .select('artifact_type, title, content')
      .eq('conversation_id', conversationId)
      .in('artifact_type', ['product_brief', 'data_model', 'workflow_map', 'automation_model', 'ux_recommendation', 'app_spec'])
      .order('created_at', { ascending: false })
      .limit(8)
    if (artifacts?.length) {
      ctx.artifacts = {}
      for (const a of artifacts) {
        if (!ctx.artifacts[a.artifact_type]) ctx.artifacts[a.artifact_type] = a.content
      }
    }
  } catch (e) {
    devlogError('generate_app.context_failed', { conversationId, error: e.message })
  }
  return ctx
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { conversationId, prompt, context, providerConfig, aiModel, allowOllamaBridge, lockProvider } = req.body || {}
  if (!conversationId || !prompt) {
    return res.status(400).json({ error: 'Missing required fields: conversationId, prompt' })
  }

  // chosenStyle comes from context (passed by frontend after style carousel selection)
  const chosenStyle = context?.chosenStyle

  // Map the selected model → a concrete per-stage providerConfig so the engine
  // actually runs on the chosen provider (defaults to Groq via env otherwise).
  const effectiveProviderConfig = resolveProviderConfig(providerConfig, aiModel)

  // When the user has LOCKED their model ("stay on this model"), thread a
  // no-failover flag so the whole pipeline runs ONLY on the chosen provider —
  // no silent gemini→groq→claude switching. Any rate-limit/quota error then
  // surfaces honestly instead of being papered over by a fallback provider.
  if (lockProvider) effectiveProviderConfig.__noFailover = true

  // Stream real progress as NDJSON when requested, so the UI can show a live,
  // honest progress bar driven by actual pipeline stages.
  const wantsStream = req.body?.stream === true || (req.headers?.accept || '').includes('application/x-ndjson')

  // ── Pre-flight provider guard ───────────────────────────────────────────────
  // If the user wants a cloud provider (Groq/Claude) but BOTH are cooling down,
  // the pipeline would silently fall back to local Ollama — which on a CPU-only
  // Mac takes many minutes per run at low quality. Rather than make the user
  // stare at an 8-minute progress bar, fail FAST with the soonest reset time.
  // They can still force the slow local bridge with { allowOllamaBridge: true }.
  const preferred = effectiveProviderConfig?.plan?.provider
    || effectiveProviderConfig?.codegen?.provider
    || 'groq'
  if (preferred !== 'ollama' && !allowOllamaBridge
      && isCoolingDown('groq') && isCoolingDown('claude')) {
    const groqMs = msUntilAvailable('groq')
    const claudeMs = msUntilAvailable('claude')
    const health = getProviderHealth()
    const soonestMs = Math.min(groqMs || Infinity, claudeMs || Infinity)
    const mins = Number.isFinite(soonestMs) ? Math.ceil(soonestMs / 60000) : null
    const reason = `All fast providers are temporarily unavailable — `
      + `Groq: ${health.providers.groq.coolingDown ? `resets in ~${Math.ceil(groqMs / 60000)}m` : 'available'}; `
      + `Claude: ${health.providers.claude.reason === 'credits' ? 'needs credits' : (health.providers.claude.coolingDown ? `resets in ~${Math.ceil(claudeMs / 60000)}m` : 'available')}. `
      + `Local Ollama would take several minutes at lower quality, so generation is paused`
      + (mins != null ? `. Try again in ~${mins}m, add Claude credits, or retry with the local bridge.` : '.')
    devlog('generate_app.providers_unavailable', { conversationId, preferred, groqMs, claudeMs })
    const payload = { error: reason, providersUnavailable: true, retryAfterMs: Number.isFinite(soonestMs) ? soonestMs : null, providerHealth: health }
    if (wantsStream) {
      res.setHeader('Content-Type', 'application/x-ndjson')
      res.flushHeaders?.()
      res.write(JSON.stringify({ type: 'error', ...payload }) + '\n')
      return res.end()
    }
    return res.status(503).json(payload)
  }

  const generationContext = context || await gatherContext(conversationId)

  if (wantsStream) {
    res.setHeader('Content-Type', 'application/x-ndjson')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
    const write = (obj) => { try { res.write(JSON.stringify(obj) + '\n') } catch {} }
    try {
      devlog('generate_app.started', { conversationId, stream: true })
      const result = await runAppPipeline({
        prompt,
        context: generationContext,
        chosenStyle,
        providerConfig: effectiveProviderConfig,
        onProgress: (evt) => write({ type: 'progress', ...evt }),
      })
      const project = await persistProject(conversationId, prompt, result, effectiveProviderConfig)
      devlog('generate_app.completed', { conversationId, appName: result.appName, fileCount: Object.keys(result.files).length })
      write({ type: 'result', ...result, projectId: project?.id || null, project })
    } catch (err) {
      devlogError('generate_app.failed', { conversationId, error: err.message })
      write({ type: 'error', error: err.message })
    }
    return res.end()
  }

  try {
    devlog('generate_app.started', { conversationId })
    const result = await runAppPipeline({
      prompt,
      context: generationContext,
      chosenStyle,
      providerConfig: effectiveProviderConfig,
      onProgress: (evt) => devlog('generate_app.progress', { conversationId, stage: evt.stage, message: evt.message }),
    })
    devlog('generate_app.completed', {
      conversationId,
      appName: result.appName,
      fileCount: Object.keys(result.files).length,
      errorCount: result.errors?.length || 0,
    })

    // ── Persist as a project asset (Phase 2). Best-effort: if the migration
    //    hasn't been run yet, log and still return the generated project. ──────
    const project = await persistProject(conversationId, prompt, result, effectiveProviderConfig)

    return res.json({ ...result, projectId: project?.id || null, project })
  } catch (err) {
    devlogError('generate_app.failed', { conversationId, error: err.message })
    return res.status(500).json({ error: 'App generation failed: ' + err.message })
  }
}

// Ensure no two of a user's app projects share a title. If "Tasks" exists,
// the next becomes "Tasks 2", then "Tasks 3", etc. Keeps the sidebar unambiguous.
async function uniqueAppTitle(userId, desired) {
  const base = (desired || 'Untitled App').trim() || 'Untitled App'
  if (!userId) return base
  try {
    const { data } = await supabase
      .from('app_projects')
      .select('title')
      .eq('user_id', userId)
      .neq('status', 'deleted')
    const taken = new Set((data || []).map(r => (r.title || '').trim().toLowerCase()))
    if (!taken.has(base.toLowerCase())) return base
    for (let n = 2; n < 1000; n++) {
      const candidate = `${base} ${n}`
      if (!taken.has(candidate.toLowerCase())) return candidate
    }
    return `${base} ${Date.now()}`
  } catch {
    return base
  }
}

async function persistProject(conversationId, prompt, result, effectiveProviderConfig) {
  try {
    const { data: conv } = await supabase.from('conversations').select('user_id').eq('id', conversationId).single()
    const status = (result.errors?.length && Object.keys(result.files).length <= 2) ? 'error' : 'ready'
    const title = await uniqueAppTitle(conv?.user_id, result.appName)
    const { data, error } = await supabase
      .from('app_projects')
      .insert({
        conversation_id: conversationId,
        user_id: conv?.user_id || null,
        title,
        source_prompt: prompt,
        app_plan: result.plan || {},
        file_tree: result.fileTree || [],
        files: result.files || {},
        summary: result.summary || '',
        entry: result.entry || '/App.js',
        runtime: result.runtime || 'sandpack-react',
        provider_config: effectiveProviderConfig || {},
        generation_errors: result.errors || [],
        status,
      })
      .select()
      .single()
    if (error) { devlogError('generate_app.persist_failed', { conversationId, error: error.message }); return null }
    devlog('generate_app.persisted', { conversationId, projectId: data.id })
    return data
  } catch (e) {
    devlogError('generate_app.persist_exception', { conversationId, error: e.message })
    return null
  }
}

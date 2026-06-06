/**
 * POST /api/edit-app — iterative edit (Phase 4) + repair (Phase 5) for a
 * generated multi-file project.
 *
 * Loads an app_projects row, applies a prompt-based edit (or a repair seeded
 * with build errors) by regenerating ONLY the affected files via the staged
 * pipeline, then persists the updated files, bumps the version, and appends to
 * edit_history. Provider-agnostic (defaults to Ollama, $0).
 *
 * Body: { projectId, editRequest, isRepair?, errorText?, providerConfig? }
 */

import { createClient } from '@supabase/supabase-js'
import { runAppEdit } from './lib/appPipeline.js'
import { devlog, devlogError } from './lib/devlog.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { projectId, editRequest, isRepair, errorText, providerConfig, aiModel, files: bodyFiles, plan: bodyPlan } = req.body || {}
  if (!editRequest && !errorText) {
    return res.status(400).json({ error: 'Missing required fields: editRequest (or errorText for repair)' })
  }
  // Either a persisted projectId OR an in-memory file map must be provided.
  const hasInlineFiles = bodyFiles && typeof bodyFiles === 'object' && Object.keys(bodyFiles).length > 0
  if (!projectId && !hasInlineFiles) {
    return res.status(400).json({ error: 'Provide a projectId or a files map to edit/repair.' })
  }

  // Run the edit/repair on the user's selected provider (same mapping as generate).
  const EDIT_STAGES = ['plan', 'file_tree', 'codegen', 'repair', 'transform', 'summary']
  const effectiveProviderConfig = (providerConfig && Object.keys(providerConfig).length)
    ? providerConfig
    : (['claude', 'groq', 'ollama'].includes(aiModel)
        ? Object.fromEntries(EDIT_STAGES.map(s => [s, { provider: aiModel }]))
        : {})

  // Load the project from the DB when a projectId is given. If it's missing
  // (table not migrated yet, or unsaved project) fall back to inline files so
  // edit/repair still works — the user should never be blocked by persistence.
  let project = null
  if (projectId) {
    const { data, error: loadErr } = await supabase
      .from('app_projects').select('*').eq('id', projectId).single()
    if (loadErr || !data) {
      if (!hasInlineFiles) return res.status(404).json({ error: 'Project not found' })
    } else {
      project = data
    }
  }

  // Resolve the files/plan we will operate on: prefer the persisted project,
  // otherwise use the inline map sent by the client (in-memory repair).
  const baseFiles = project?.files || bodyFiles || {}
  const basePlan = project?.app_plan || bodyPlan || {}

  // A repair is just an edit whose instruction is "fix these build errors".
  const instruction = isRepair
    ? `The app has build/runtime errors. Fix them without changing intended behavior. Errors:\n${errorText || editRequest}`
    : editRequest

  // Stream real progress as NDJSON when requested, so the UI can show a live
  // progress bar + a running narration of the edit steps (pure logging — the
  // messages come from the pipeline's own stage events, no extra AI calls).
  const wantsStream = req.body?.stream === true || (req.headers?.accept || '').includes('application/x-ndjson')

  // Persist the edited project (or return inline files) and produce the final payload.
  async function finalize(result) {
    if (!project) {
      devlog('edit_app.completed', { projectId: '(inline)', changed: result.changedFiles?.length || 0 })
      return { project: null, ...result }
    }
    const historyEntry = {
      at: new Date().toISOString(),
      request: editRequest || '(repair)',
      isRepair: !!isRepair,
      changedFiles: result.changedFiles,
      summary: result.summary,
    }
    const newHistory = [...(project.edit_history || []), historyEntry]
    const { data: updated, error: updErr } = await supabase
      .from('app_projects')
      .update({
        files: result.files,
        edit_history: newHistory,
        generation_errors: result.errors || [],
        version: (project.version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select()
      .single()
    if (updErr) {
      devlogError('edit_app.persist_failed', { projectId, error: updErr.message })
      return { project: { ...project, files: result.files, edit_history: newHistory }, ...result }
    }
    devlog('edit_app.completed', { projectId, changed: result.changedFiles.length })
    return { project: updated, ...result }
  }

  if (wantsStream) {
    res.setHeader('Content-Type', 'application/x-ndjson')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
    const write = (obj) => { try { res.write(JSON.stringify(obj) + '\n') } catch {} }
    try {
      devlog('edit_app.started', { projectId: projectId || '(inline)', isRepair: !!isRepair, inline: !project, stream: true })
      const result = await runAppEdit({
        files: baseFiles, plan: basePlan, editRequest: instruction,
        providerConfig: effectiveProviderConfig,
        onProgress: (evt) => write({ type: 'progress', ...evt }),
      })
      const payload = await finalize(result)
      write({ type: 'result', ...payload })
    } catch (err) {
      devlogError('edit_app.failed', { projectId, error: err.message })
      write({ type: 'error', error: 'Edit failed: ' + err.message })
    }
    return res.end()
  }

  try {
    devlog('edit_app.started', { projectId: projectId || '(inline)', isRepair: !!isRepair, inline: !project })
    const result = await runAppEdit({
      files: baseFiles, plan: basePlan, editRequest: instruction,
      providerConfig: effectiveProviderConfig,
      onProgress: (evt) => devlog('edit_app.progress', { projectId, stage: evt.stage, message: evt.message }),
    })
    return res.json(await finalize(result))
  } catch (err) {
    devlogError('edit_app.failed', { projectId, error: err.message })
    return res.status(500).json({ error: 'Edit failed: ' + err.message })
  }
}

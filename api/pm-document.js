/**
 * /api/pm-document — Generate a single on-demand corporate document.
 *
 * The user names a document ("generate a risk assessment", "create an SOP",
 * "make a finance breakdown"). We resolve it to a template in the document
 * registry, generate deep enterprise-grade content, validate its depth (and
 * regenerate once if too thin), then persist it as an editable, exportable
 * artifact and post a confirmation message.
 *
 * Refactored 2026-05 to use the document template registry (documentTemplates.js).
 */

import { createClient } from '@supabase/supabase-js'
import { createOrchestrator, respondWithError } from './lib/orchestrator.js'
import {
  resolveDocumentType,
  buildDocumentSystemPrompt,
  validateDocument,
  getExportFormats,
  DEFAULT_DEPTH_MODE,
} from './lib/documentTemplates.js'
import { buildRoleContextPrompt } from './lib/roleFlows.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

function buildUserPrompt({ userRequest, projectContext, rolePreface }) {
  const ctx = projectContext
    ? `\n\nPROJECT CONTEXT (ground every section in this — do not invent a different domain):\n${typeof projectContext === 'string' ? projectContext : JSON.stringify(projectContext, null, 2)}`
    : ''
  const role = rolePreface ? `\n\n${rolePreface}` : ''
  return `The user asked: "${userRequest}"${ctx}${role}\n\nToday's date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. Generate the full document now.`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { conversationId, userRequest, projectContext, aiModel, roleContext, depthMode } = req.body
  if (!conversationId || !userRequest) {
    return res.status(400).json({ error: 'Missing required fields: conversationId, userRequest' })
  }

  const { template, matched } = resolveDocumentType(userRequest)
  const mode = depthMode || DEFAULT_DEPTH_MODE
  const rolePreface = buildRoleContextPrompt(roleContext)

  const orch = createOrchestrator({
    workflow: 'pm_document',
    aiModel,
    traceContext: { conversationId, documentType: template.documentType, matched, depthMode: mode },
  })

  try {
    const system = buildDocumentSystemPrompt(template, { roleContext, depthMode: mode })
    const userPrompt = buildUserPrompt({ userRequest, projectContext, rolePreface })

    // ── Generate, then validate depth; regenerate once if too thin ───────────────
    let content = await orch.json('generate_document', {
      tier: 'smart',
      maxTokens: 8000,
      system,
      prompt: userPrompt,
    })

    let validation = validateDocument(template, content, mode)
    if (!validation.ok) {
      const fix = `Your previous draft was rejected for insufficient depth. Fix these issues and return the COMPLETE document again, deeper and more specific:\n- ${validation.issues.join('\n- ')}`
      const retry = await orch.json('generate_document_retry', {
        tier: 'smart',
        maxTokens: 8000,
        system,
        prompt: `${userPrompt}\n\n${fix}`,
      })
      const retryValidation = validateDocument(template, retry, mode)
      // Keep whichever draft is better (retry wins ties since it's deeper).
      if (retryValidation.ok || retryValidation.issues.length <= validation.issues.length) {
        content = retry
        validation = retryValidation
      }
    }

    // ── Normalize the stored content shape (self-contained; no metadata column) ──
    const normalized = {
      documentType: template.documentType,
      label: template.label,
      format: template.formatType,
      depthMode: mode,
      category: template.category,
      isDynamic: !!template.isDynamic,
      exportFormats: getExportFormats(template),
      meta: content?.meta || { title: template.label, version: '1.0', status: 'draft' },
      sections: Array.isArray(content?.sections) ? content.sections : [],
      validation: { ok: validation.ok, issues: validation.issues },
    }
    const title = normalized.meta?.title || template.label

    // ── Persist as an artifact ───────────────────────────────────────────────────
    const { data: conv } = await supabase.from('conversations').select('user_id').eq('id', conversationId).single()
    const userId = conv?.user_id || null

    const { data: artifact, error: artErr } = await supabase
      .from('artifacts')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        artifact_type: template.documentType,
        title,
        content: normalized,
        source_prompt: userRequest,
        version: 1,
        status: 'draft',
        file_urls: {},
      })
      .select()
      .single()

    if (artErr) throw new Error('Failed to save document: ' + artErr.message)

    // ── Fire-and-forget real file generation (PDF/DOCX/XLSX/etc.) ────────────────
    try {
      const { default: genFiles } = await import('./artifacts-generate-files.js')
      const fakeReq = { method: 'POST', params: { id: artifact.id }, url: `/api/artifacts/${artifact.id}/files` }
      const fakeRes = { status: () => ({ json: () => {} }), json: () => {}, redirect: () => {} }
      genFiles(fakeReq, fakeRes).catch(() => {})
    } catch {}

    // ── Confirmation message ─────────────────────────────────────────────────────
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: `I've created the **${title}** and added it to your project assets. It's fully editable, and you can export it as ${normalized.exportFormats.map(f => f.toUpperCase()).join(', ')}.`,
      message_type: 'text',
      metadata: { generatedArtifactId: artifact.id, traceId: orch.traceId },
    })

    orch.end({ artifactId: artifact.id, documentType: template.documentType, validated: validation.ok })
    return res.json({ artifact, docInfo: { type: template.documentType, label: template.label, category: template.category, format: template.formatType, matched }, traceId: orch.traceId })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}

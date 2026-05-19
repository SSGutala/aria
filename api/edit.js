/**
 * /api/edit — Iterative AI editing for generated apps.
 *
 * The user has a built app and wants to either ask about it or modify it.
 * Aria decides which from the request and either answers or returns updated HTML.
 *
 * Refactored 2026-05 to use orchestrator + prompts registry.
 */

import { createClient } from '@supabase/supabase-js'
import { createOrchestrator, respondWithError, extractJSON } from './lib/orchestrator.js'
import { APP_EDIT } from './lib/prompts.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { appId, editRequest, conversationId, aiModel } = req.body
  if (!appId || !editRequest || !conversationId) {
    return res.status(400).json({ error: 'Missing fields: appId, editRequest, conversationId' })
  }

  // Fetch the current app
  const { data: app, error: fetchErr } = await supabase
    .from('generated_apps')
    .select('id, title, slug, generated_html, schema')
    .eq('id', appId)
    .single()

  if (fetchErr || !app) return res.status(404).json({ error: 'App not found' })
  if (!app.generated_html) {
    return res.status(400).json({
      error: 'This app was built with the legacy system and cannot be edited here. Rebuild it first.',
    })
  }

  const orch = createOrchestrator({
    workflow: 'app_edit',
    aiModel,
    traceContext: { appId, conversationId, editRequestLength: editRequest.length },
  })

  try {
    // Try JSON parse; if AI returned freeform text, treat as an answer
    let parsed
    try {
      parsed = await orch.json('edit_or_answer', {
        tier: 'smart',
        maxTokens: 6000,
        system: APP_EDIT,
        prompt: `Current app HTML:\n\n${app.generated_html}\n\n---\n\nUser request: "${editRequest}"\n\nRespond with JSON only.`,
      })
    } catch (parseErr) {
      // Fallback: treat raw text as a plain answer
      const raw = await orch.text('edit_or_answer_fallback', {
        tier: 'smart',
        maxTokens: 1000,
        system: 'Answer the user\'s question about their app in 2-3 sentences.',
        prompt: editRequest,
      })
      parsed = { type: 'answer', content: raw }
    }

    // ─── ANSWER path ─────────────────────────────────────────────────────────
    if (parsed.type === 'answer') {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: parsed.content,
        message_type: 'text',
        metadata: { traceId: orch.traceId },
      })
      orch.end({ resultType: 'answer' })
      return res.json({ type: 'answer', content: parsed.content, traceId: orch.traceId })
    }

    // ─── EDIT path ───────────────────────────────────────────────────────────
    const updatedHtml = (parsed.html || '').trim()
    if (!updatedHtml.includes('<!DOCTYPE') && !updatedHtml.includes('<html')) {
      throw new Error('AI returned invalid HTML for the edit')
    }

    await supabase.from('generated_apps')
      .update({ generated_html: updatedHtml, updated_at: new Date().toISOString() })
      .eq('id', appId)

    const summary = parsed.summary
      ? `✅ Done — ${parsed.summary}`
      : `✅ Updated **${app.title}**. Reload the app to see your changes.`

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: summary,
      message_type: 'text',
      metadata: { editedAppId: appId, slug: app.slug, traceId: orch.traceId },
    })

    orch.end({ resultType: 'edit', htmlLength: updatedHtml.length })
    return res.json({ type: 'edit_complete', appId, slug: app.slug, summary, traceId: orch.traceId })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}

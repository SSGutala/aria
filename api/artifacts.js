import { createClient } from '@supabase/supabase-js'
import { recordAudit, AUDIT } from './lib/audit.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // ── GET /api/artifacts?conversationId=xxx ─────────────────────────────────
  if (req.method === 'GET') {
    const { conversationId } = req.query
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' })

    const { data, error } = await supabase
      .from('artifacts')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ artifacts: data || [] })
  }

  // ── POST /api/artifacts — create or upsert artifact ──────────────────────
  if (req.method === 'POST') {
    const { conversationId, userId, artifactType, title, content, sourcePrompt, relatedAppId, source } = req.body
    if (!conversationId || !artifactType || !title) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const { data, error } = await supabase
      .from('artifacts')
      .insert({
        conversation_id: conversationId,
        user_id: userId || null,
        related_app_id: relatedAppId || null,
        artifact_type: artifactType,
        title,
        content: source === 'blank' ? {} : (content || {}),
        source_prompt: sourcePrompt || null,
        version: 1,
        status: 'draft',
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    recordAudit({
      req,
      userId: userId || data.user_id || null,
      action: AUDIT.CREATE,
      table: 'artifacts',
      recordId: data.id,
      newVal: data,
    })

    return res.json({ artifact: data })
  }

  // ── DELETE /api/artifacts/:id — hard delete ──────────────────────────────
  if (req.method === 'DELETE') {
    const id = req.params?.id || req.url.split('/').filter(Boolean).pop()
    if (!id) return res.status(400).json({ error: 'Artifact ID required' })

    // Capture the pre-delete state so the audit trail has old_val.
    const { data: existing } = await supabase
      .from('artifacts')
      .select('*')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('artifacts')
      .delete()
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })

    recordAudit({
      req,
      userId: existing?.user_id || null,
      action: AUDIT.DELETE,
      table: 'artifacts',
      recordId: id,
      oldVal: existing || null,
    })

    return res.json({ success: true })
  }

  // ── PATCH /api/artifacts/:id — update content, status, or create new version
  if (req.method === 'PATCH') {
    const id = req.params?.id || req.url.split('/').pop()
    const { content, status, title, createVersion, raw_content, mermaid_source } = req.body

    if (!id) return res.status(400).json({ error: 'Artifact ID required' })

    // If createVersion=true, fetch current artifact and insert a new row
    if (createVersion) {
      const { data: current } = await supabase
        .from('artifacts')
        .select('*')
        .eq('id', id)
        .single()

      if (!current) return res.status(404).json({ error: 'Artifact not found' })

      // Mark old as superseded
      await supabase
        .from('artifacts')
        .update({ status: 'superseded' })
        .eq('id', id)

      // Create new version
      const { data: newArtifact, error } = await supabase
        .from('artifacts')
        .insert({
          conversation_id: current.conversation_id,
          user_id: current.user_id,
          related_app_id: current.related_app_id,
          artifact_type: current.artifact_type,
          title: title || current.title,
          content: content || current.content,
          source_prompt: current.source_prompt,
          version: (current.version || 1) + 1,
          status: 'draft',
        })
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.json({ artifact: newArtifact, supersededId: id })
    }

    // Otherwise, update in place (manual edit — no new version)
    // Snapshot the current row first so the audit trail can diff old vs new.
    const { data: before } = await supabase
      .from('artifacts')
      .select('*')
      .eq('id', id)
      .single()

    const updates = { updated_at: new Date().toISOString() }
    if (content !== undefined) updates.content = content
    if (status !== undefined) updates.status = status
    if (title !== undefined) updates.title = title
    if (raw_content !== undefined) updates.raw_content = raw_content
    if (mermaid_source !== undefined) updates.mermaid_source = mermaid_source

    const { data, error } = await supabase
      .from('artifacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    recordAudit({
      req,
      userId: data?.user_id || before?.user_id || null,
      action: AUDIT.UPDATE,
      table: 'artifacts',
      recordId: id,
      oldVal: before || null,
      newVal: data,
    })

    return res.json({ artifact: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

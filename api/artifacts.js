import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
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
    const { conversationId, userId, artifactType, title, content, sourcePrompt, relatedAppId } = req.body
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
        content: content || {},
        source_prompt: sourcePrompt || null,
        version: 1,
        status: 'draft',
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ artifact: data })
  }

  // ── PATCH /api/artifacts/:id — update content, status, or create new version
  if (req.method === 'PATCH') {
    const id = req.params?.id || req.url.split('/').pop()
    const { content, status, title, createVersion } = req.body

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
    const updates = { updated_at: new Date().toISOString() }
    if (content !== undefined) updates.content = content
    if (status !== undefined) updates.status = status
    if (title !== undefined) updates.title = title

    const { data, error } = await supabase
      .from('artifacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ artifact: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

/**
 * /api/artifacts/ai-edit — Apply an AI-driven edit to a structured artifact.
 *
 * The user has an artifact and an instruction like "add an audit trail section"
 * or "make the compliance risks more detailed". This handler reads the current
 * artifact content, asks the model to return an updated content object,
 * supersedes the old artifact, and inserts the new version.
 *
 * Refactored 2026-05 to use orchestrator + prompts registry.
 */

import { createClient } from '@supabase/supabase-js'
import { createOrchestrator, respondWithError } from './lib/orchestrator.js'
import { ARTIFACT_EDIT } from './lib/prompts.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { artifactId, instruction, aiModel } = req.body
  if (!artifactId || !instruction) {
    return res.status(400).json({ error: 'Missing artifactId or instruction' })
  }

  // Fetch current artifact
  const { data: artifact, error: fetchErr } = await supabase
    .from('artifacts').select('*').eq('id', artifactId).single()
  if (fetchErr || !artifact) return res.status(404).json({ error: 'Artifact not found' })

  const orch = createOrchestrator({
    workflow: 'artifact_edit',
    aiModel,
    traceContext: {
      artifactId,
      artifactType: artifact.artifact_type,
      currentVersion: artifact.version,
      instructionLength: instruction.length,
    },
  })

  try {
    // Compose system: shared ARTIFACT_EDIT contract + per-artifact context
    const systemPrompt = `${ARTIFACT_EDIT}\n\nArtifact type: "${artifact.artifact_type}"\nArtifact title: "${artifact.title}"`

    const newContent = await orch.json('apply_edit', {
      tier: 'smart',
      maxTokens: 5000,
      system: systemPrompt,
      prompt: `Current artifact content:\n${JSON.stringify(artifact.content, null, 2)}\n\nInstruction: ${instruction}\n\nReturn the updated content JSON only.`,
    })

    // Mark old as superseded
    await supabase.from('artifacts').update({ status: 'superseded' }).eq('id', artifactId)

    // Insert new version
    const { data: newArtifact, error: insertErr } = await supabase
      .from('artifacts')
      .insert({
        conversation_id: artifact.conversation_id,
        user_id: artifact.user_id,
        related_app_id: artifact.related_app_id,
        artifact_type: artifact.artifact_type,
        title: artifact.title,
        content: newContent,
        source_prompt: artifact.source_prompt,
        version: (artifact.version || 1) + 1,
        status: 'draft',
      })
      .select().single()

    if (insertErr) throw new Error(insertErr.message)

    orch.end({ newVersion: newArtifact.version, supersededId: artifactId })
    return res.json({ artifact: newArtifact, supersededId: artifactId, traceId: orch.traceId })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { artifactId, instruction } = req.body
  if (!artifactId || !instruction) return res.status(400).json({ error: 'Missing artifactId or instruction' })

  // Fetch current artifact
  const { data: artifact, error: fetchErr } = await supabase
    .from('artifacts').select('*').eq('id', artifactId).single()
  if (fetchErr || !artifact) return res.status(404).json({ error: 'Artifact not found' })

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 8000,
      system: `You are an expert enterprise product architect editing a structured JSON artifact.
The artifact type is "${artifact.artifact_type}" and its title is "${artifact.title}".
Your job is to apply the user's requested change to the artifact's content and return only the updated JSON content object.
CRITICAL: Return ONLY valid JSON, no markdown, no explanation. Start with { and end with }.
Preserve all existing fields and structure. Only change what the user explicitly asked to change.`,
      messages: [{
        role: 'user',
        content: `Current artifact content:\n${JSON.stringify(artifact.content, null, 2)}\n\nInstruction: ${instruction}\n\nReturn the updated content JSON only.`,
      }],
    })

    const responseText = msg.content[0].text
    let newContent
    try {
      const stripped = responseText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
      newContent = JSON.parse(stripped)
    } catch {
      // Try to extract JSON
      const match = responseText.match(/\{[\s\S]*\}/)
      if (match) newContent = JSON.parse(match[0])
      else throw new Error('AI returned invalid JSON')
    }

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

    return res.json({ artifact: newArtifact, supersededId: artifactId })
  } catch (err) {
    console.error('AI edit error:', err)
    return res.status(500).json({ error: err.message || 'AI edit failed' })
  }
}

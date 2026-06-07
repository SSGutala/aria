/**
 * /api/chat — conversational response endpoint with automatic document editing.
 *
 * Called when the user sends a message. If the message is a request to edit an
 * artifact (e.g., "Add a finance section to the risk assessment"), Aria detects it,
 * finds the relevant artifact, applies the edit, and returns both a confirmation
 * and the updated artifact. Otherwise, responds conversationally.
 *
 * Returns { response: string, editedArtifact?: artifact, editInstruction?: string }
 */

import { createClient } from '@supabase/supabase-js'
import { createOrchestrator, respondWithError } from './lib/orchestrator.js'
import { buildHistoryContext } from './lib/prompts.js'
import { buildRoleContextPrompt } from './lib/roleFlows.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const CHAT_SYSTEM = `You are Aria, an enterprise app-builder AI assistant.
You help users build internal tools, automate workflows, generate documents, and create analytics dashboards.
When a user asks a question or sends a conversational message (not a build request), respond helpfully and naturally.
Keep responses concise — typically 1-3 sentences unless more detail is genuinely needed.
If the user seems confused about why nothing is generating or why the process stopped, explain what happened clearly and offer to continue or start fresh.
Never start with "Sure", "Great", "Absolutely", or "Of course". Be direct and human.`

const EDIT_DETECTION_SYSTEM = `You are analyzing whether a user message is requesting changes to an existing document artifact.

Return a JSON object with:
{
  "isEditRequest": boolean,
  "targetArtifactId": "artifact_id or null",
  "targetArtifactTitle": "artifact title if identifiable",
  "editInstruction": "the specific change being requested, or null"
}

isEditRequest = true only if the user is clearly requesting to modify/add/change/remove something in a specific document.
Ignore general questions ("What's in the risk assessment?") — those are not edit requests.
Focus on action verbs: add, remove, change, update, modify, revise, include, expand, clarify, strengthen, weaken, etc.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationHistory = [], roleContext, aiModel, conversationId } = req.body

  if (!prompt) return res.status(400).json({ error: 'Missing required field: prompt' })

  const rolePreface = buildRoleContextPrompt(roleContext)
  const historyContext = buildHistoryContext(conversationHistory)

  const orch = createOrchestrator({
    workflow: 'chat_response',
    aiModel,
    traceContext: { promptLength: prompt.length },
  })

  try {
    // First, check if this looks like an artifact edit request
    let editResult = null
    let recentArtifacts = []

    if (conversationId) {
      // Fetch recent artifacts from this conversation
      const { data: artifacts } = await supabase
        .from('artifacts')
        .select('id, title, artifact_type, status')
        .eq('conversation_id', conversationId)
        .neq('status', 'superseded')
        .order('created_at', { ascending: false })
        .limit(10)
      recentArtifacts = artifacts || []
    }

    // If there are artifacts, analyze if the message is an edit request
    if (recentArtifacts.length > 0) {
      const artifactContext = recentArtifacts
        .map((a, i) => `${i + 1}. "${a.title}" (${a.artifact_type})`)
        .join('\n')

      try {
        const detection = await orch.json('detect_edit', {
          tier: 'fast',
          maxTokens: 300,
          system: EDIT_DETECTION_SYSTEM,
          prompt: `Recent artifacts in the conversation:\n${artifactContext}\n\nUser message: "${prompt}"\n\nAnalyze the user message and return whether it's requesting edits to one of these artifacts.`,
        })

        if (detection?.isEditRequest && detection?.targetArtifactId) {
          // Try to find the artifact by ID or by title match
          let targetArtifact = recentArtifacts.find(a => a.id === detection.targetArtifactId)
          if (!targetArtifact && detection?.targetArtifactTitle) {
            targetArtifact = recentArtifacts.find(a =>
              a.title.toLowerCase().includes(detection.targetArtifactTitle.toLowerCase()) ||
              detection.targetArtifactTitle.toLowerCase().includes(a.title.toLowerCase())
            )
          }

          if (targetArtifact && detection?.editInstruction) {
            // Apply the edit
            try {
              const { data: artifact, error: fetchErr } = await supabase
                .from('artifacts').select('*').eq('id', targetArtifact.id).single()

              if (!fetchErr && artifact) {
                const editOrch = createOrchestrator({
                  workflow: 'artifact_edit_from_chat',
                  aiModel,
                  traceContext: { artifactId: artifact.id, artifactType: artifact.artifact_type },
                })

                const newContent = await editOrch.json('apply_edit', {
                  tier: 'smart',
                  maxTokens: 5000,
                  system: `You are editing a "${artifact.artifact_type}" artifact. Return the updated content JSON only.`,
                  prompt: `Current artifact content:\n${JSON.stringify(artifact.content, null, 2)}\n\nInstruction: ${detection.editInstruction}\n\nReturn the updated content JSON only.`,
                })

                // Mark old as superseded and insert new version
                await supabase.from('artifacts').update({ status: 'superseded' }).eq('id', artifact.id)
                const { data: newArtifact, error: insertErr } = await supabase
                  .from('artifacts')
                  .insert({
                    conversation_id: artifact.conversation_id,
                    user_id: artifact.user_id,
                    artifact_type: artifact.artifact_type,
                    title: artifact.title,
                    content: newContent,
                    source_prompt: artifact.source_prompt,
                    version: (artifact.version || 1) + 1,
                    status: 'draft',
                  })
                  .select()
                  .single()

                if (!insertErr && newArtifact) {
                  editResult = { artifact: newArtifact, instruction: detection.editInstruction }
                  editOrch.end({ newVersion: newArtifact.version })
                }
              }
            } catch (editErr) {
              // Silently fall back to conversational response if edit fails
            }
          }
        }
      } catch {
        // Silently fall back to conversational response if detection fails
      }
    }

    // Always provide a conversational response
    const system = rolePreface ? `${CHAT_SYSTEM}\n\n${rolePreface}` : CHAT_SYSTEM
    const response = await orch.text('chat', {
      tier: 'fast',
      maxTokens: 400,
      system,
      prompt: `${historyContext ? `Conversation so far:${historyContext}\n\n` : ''}User message: "${prompt}"${editResult ? `\n\n[Internal: You just applied an edit to "${editResult.artifact.title}". Acknowledge the change briefly if appropriate.]` : ''}`,
    })

    orch.end({ hasEdit: !!editResult })
    return res.json({
      response: response.trim(),
      ...(editResult && { editedArtifact: editResult.artifact, editInstruction: editResult.instruction }),
    })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}

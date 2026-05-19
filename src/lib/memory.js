/**
 * Cross-conversation memory helpers.
 *
 * Memories are stored as JSONB on each conversation row:
 * { summary: string, prompt: string, outputType: string, buildMode: string, timestamp: string }
 *
 * They're loaded when Aria analyzes a new prompt so the AI has context
 * about what the user has built before.
 */

import { supabase } from './supabase'

/**
 * Save a memory summary after a brief/spec is generated.
 * @param {string} conversationId
 * @param {{ summary: string, prompt: string, outputType: string, buildMode?: string }} info
 */
export async function saveConversationMemory(conversationId, info) {
  if (!conversationId) return
  try {
    const memory = {
      summary: (info.summary || '').slice(0, 600),
      prompt: (info.prompt || '').slice(0, 200),
      outputType: info.outputType || 'brief',
      buildMode: info.buildMode || null,
      timestamp: new Date().toISOString(),
    }
    await supabase
      .from('conversations')
      .update({ memory })
      .eq('id', conversationId)
  } catch {
    // fire-and-forget; never block the UI
  }
}

/**
 * Load recent memories for the current user (last 4 completed conversations).
 * Returns an array of memory objects, sorted newest first.
 */
export async function loadUserMemories(userId) {
  if (!userId) return []
  try {
    const { data } = await supabase
      .from('conversations')
      .select('id, title, memory, updated_at')
      .eq('user_id', userId)
      .not('memory', 'is', null)
      .neq('deleted', true)
      .order('updated_at', { ascending: false })
      .limit(4)
    return (data || []).map(row => ({
      conversationId: row.id,
      title: row.title,
      ...row.memory,
    }))
  } catch {
    return []
  }
}

/**
 * Format memories into a short context block to inject into AI prompts.
 */
export function formatMemoriesForPrompt(memories) {
  if (!memories?.length) return ''
  const lines = memories.map(m => {
    const when = m.timestamp ? new Date(m.timestamp).toLocaleDateString() : ''
    return `- "${m.summary}"${when ? ` (${when})` : ''}`
  })
  return `\n\nUser's recent Aria projects:\n${lines.join('\n')}`
}

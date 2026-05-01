import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { appId, editRequest, conversationId } = req.body
  if (!appId || !editRequest || !conversationId) {
    return res.status(400).json({ error: 'Missing fields' })
  }

  // Fetch the current app
  const { data: app, error } = await supabase
    .from('generated_apps')
    .select('id, title, slug, generated_html, schema')
    .eq('id', appId)
    .single()

  if (error || !app) return res.status(404).json({ error: 'App not found' })

  if (!app.generated_html) {
    return res.status(400).json({ error: 'This app was built with the legacy system and cannot be edited here. Rebuild it first.' })
  }

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 32000,
      system: `You are an expert at modifying React web apps embedded in HTML files.

You will receive:
1. An existing app's full HTML source
2. A user's edit request or question

DECISION:
- If the user is asking a QUESTION about the app (how to use it, what it does, etc.) — respond with a helpful plain-text answer. Return JSON: {"type":"answer","content":"your answer here"}
- If the user wants to CHANGE or ADD something — modify the HTML and return the full updated file. Return JSON: {"type":"edit","html":"<!DOCTYPE html>...","summary":"one sentence describing what changed"}

EDITING RULES:
1. Return the COMPLETE modified HTML — not a diff, not partial code
2. Make ONLY the requested changes — don't restructure unrelated parts
3. Keep all existing functionality intact
4. Common edits and how to handle them:
   - Add a field: add it to the FIELDS constant array AND add it to the SubmitForm (it auto-renders FIELDS)
   - Change colors: update PRIMARY and LIGHT constants near the top of the <script> block
   - Rename labels: update field.label values in the FIELDS array
   - Add a column/filter: modify the App component rendering logic
   - Change layout: restructure the App component's return JSX
5. The HTML uses Babel standalone for JSX transpilation — keep all JSX valid

RESPONSE FORMAT: Return ONLY the JSON object. No markdown, no explanation outside the JSON.`,
      messages: [{
        role: 'user',
        content: `Current app HTML:\n\n${app.generated_html}\n\n---\n\nUser request: "${editRequest}"\n\nRespond with JSON only.`,
      }],
    })

    let responseText = msg.content[0].text.trim()
    // Strip markdown fences if Claude wrapped in code block
    responseText = responseText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()

    let parsed
    try {
      parsed = JSON.parse(responseText)
    } catch {
      // Claude didn't return JSON — treat as answer
      parsed = { type: 'answer', content: responseText }
    }

    if (parsed.type === 'answer') {
      // Save the answer as a chat message and return
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: parsed.content,
        message_type: 'text',
        metadata: {},
      })
      return res.json({ type: 'answer', content: parsed.content })
    }

    // It's an edit — validate and save
    let updatedHtml = (parsed.html || '').trim()
    if (!updatedHtml.includes('<!DOCTYPE') && !updatedHtml.includes('<html')) {
      throw new Error('Claude returned invalid HTML for the edit')
    }

    await supabase.from('generated_apps')
      .update({ generated_html: updatedHtml })
      .eq('id', appId)

    const summary = parsed.summary
      ? `✅ Done — ${parsed.summary}`
      : `✅ Updated **${app.title}**. Reload the app to see your changes.`

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: summary,
      message_type: 'text',
      metadata: { editedAppId: appId, slug: app.slug },
    })

    return res.json({ type: 'edit_complete', appId, slug: app.slug, summary })

  } catch (err) {
    console.error('Edit error:', err)
    return res.status(500).json({ error: err.message || 'Edit failed. Please try again.' })
  }
}

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON found in response')
  return JSON.parse(match[0])
}

const ARIA_SYSTEM = `You are Aria — an AI enterprise app builder and workflow consultant.

You build internal tools, workflow systems, approval portals, case management consoles, document automation, and any enterprise-grade internal application.

You are talking to a business user who wants to build an internal tool. Your tone is:
- Sharp and confident — you immediately understand the business problem
- Concise — no fluff, no filler
- Specific — you reference the actual domain, not generic concepts
- Product-minded — you think like a PM who has built these systems before`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationId, buildMode, clarificationAnswers, conversationHistory } = req.body
  if (!prompt || !conversationId) return res.status(400).json({ error: 'Missing required fields' })

  const historyContext = conversationHistory?.length > 0
    ? `\n\nConversation context:\n${conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Aria'}: ${m.content}`).filter(l => !l.endsWith(': ')).slice(-6).join('\n')}`
    : ''

  try {
    // ─── PHASE 1: No buildMode yet → analyze and recommend a build mode ─────────
    if (!buildMode) {
      const msg = await anthropic.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 600,
        system: ARIA_SYSTEM,
        messages: [{
          role: 'user',
          content: `A user wants to build this enterprise tool: "${prompt}"${historyContext}

Analyze the request and write a 1-2 sentence response that:
- Confirms you understand the specific business problem (use their domain language)
- Shows you have a clear vision for this tool
- Is direct and confident — no hedging, no "Great idea!"

Then recommend a build mode based on complexity:
- "quick": Simple, clear requirements, straightforward workflow, 1-2 user roles — can build fast
- "guided": Multi-role workflow, approvals, automation, or integrations involved — benefits from scoping
- "docs": Complex enterprise process, compliance/audit needs, multiple stakeholders, needs approval before build

Return JSON only:
{
  "intro": "1-2 sentence message — sharp, domain-specific, no em-dashes",
  "recommendedMode": "quick | guided | docs",
  "complexityReason": "One sentence explaining why you recommend this mode"
}`
        }]
      })

      const parsed = extractJSON(msg.content[0].text)

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: parsed.intro || '',
        message_type: 'text',
        metadata: {},
      })

      return res.json({
        type: 'build_mode',
        intro: parsed.intro || '',
        recommendedMode: parsed.recommendedMode || 'guided',
        complexityReason: parsed.complexityReason || '',
      })
    }

    // ─── PHASE 2: buildMode selected → return clarification questions ────────────
    if (buildMode === 'quick') {
      // Quick build: 2-3 targeted multiple-choice questions or skip entirely
      const msg = await anthropic.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 800,
        system: ARIA_SYSTEM,
        messages: [{
          role: 'user',
          content: `A user wants to build this enterprise tool: "${prompt}"${historyContext}
${clarificationAnswers ? `\nUser already answered: ${clarificationAnswers}` : ''}

Quick Build mode — they want to move fast.

Are there 1-2 critical clarifying questions that would MEANINGFULLY change the core data model or workflow?

Ask ONLY if:
- There are two genuinely different workflows this could be
- The approval chain could go multiple ways
- You need to know primary user role to design the right experience

Do NOT ask about colors, layout, or things you can reasonably infer.

If the prompt is clear enough to build without questions, skip entirely.

Return JSON only:
{
  "needsClarification": true,
  "intro": "One sentence — show you're ready to build",
  "questions": [
    { "type": "multiple_choice", "question": "...", "options": ["A", "B", "C"] }
  ]
}
OR if clear:
{
  "needsClarification": false,
  "intro": "One sentence confirming you're ready to generate the spec"
}`
        }]
      })

      const parsed = extractJSON(msg.content[0].text)

      if (parsed.needsClarification && parsed.questions?.length > 0) {
        const questions = parsed.questions.slice(0, 2)

        if (parsed.intro) {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: parsed.intro,
            message_type: 'text',
            metadata: {},
          })
        }

        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: '',
          message_type: 'clarification',
          metadata: { questions, buildMode: 'quick' },
        })

        return res.json({ type: 'clarification', intro: parsed.intro, questions, buildMode: 'quick' })
      }

      return res.json({ needsClarification: false, intro: parsed.intro || '', buildMode: 'quick' })
    }

    if (buildMode === 'guided' || buildMode === 'docs') {
      // Guided / Docs: deeper questions with mixed types
      const docsNote = buildMode === 'docs'
        ? 'Documentation First mode — focus on stakeholders, approval chain, compliance, and document outputs.'
        : 'Guided Build mode — focus on workflow depth, user roles, automation, and integration needs.'

      const msg = await anthropic.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 1400,
        system: ARIA_SYSTEM,
        messages: [{
          role: 'user',
          content: `A user wants to build this enterprise tool: "${prompt}"${historyContext}

${docsNote}

Generate 4-7 targeted clarifying questions that will help produce a thorough enterprise product brief.

Focus on questions that reveal:
- Who are the primary and secondary users / roles
- What the current manual process looks like (spreadsheet, email chain, SharePoint form)
- What the approval chain / review process is
- What automation or notifications are needed
- What integrations exist (M365, email, Teams, existing systems)
- What documents or reports are generated
- What compliance, audit, or SLA requirements exist
- What data objects and relationships are involved

Use the right question type for each:
- "multiple_choice": when there are 2-4 distinct options
- "multi_select": when multiple answers can apply simultaneously
- "yes_no": for binary decisions
- "short_answer": for open-ended specifics (names, counts, timelines)

Do NOT ask about colors or layout preferences.
Do NOT ask redundant questions.
Ask only what materially changes the product or workflow design.

Return JSON only:
{
  "intro": "1-2 sentences — show you're entering a deeper discovery process, be specific about what you're figuring out",
  "questions": [
    {
      "type": "multiple_choice | multi_select | yes_no | short_answer",
      "question": "Specific question",
      "options": ["Option A", "Option B"],
      "placeholder": "for short_answer only — hint text"
    }
  ]
}`
        }]
      })

      const parsed = extractJSON(msg.content[0].text)
      const questions = (parsed.questions || []).slice(0, 7)

      if (parsed.intro) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: parsed.intro,
          message_type: 'text',
          metadata: {},
        })
      }

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: '',
        message_type: 'clarification_v2',
        metadata: { questions, buildMode },
      })

      return res.json({ type: 'clarification_v2', intro: parsed.intro || '', questions, buildMode })
    }

    return res.status(400).json({ error: 'Unknown buildMode' })

  } catch (err) {
    console.error('Generate error:', err)
    return res.status(500).json({ error: err.message || 'Generation failed. Please try again.' })
  }
}

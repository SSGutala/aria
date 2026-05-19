/**
 * /api/spec — Generate an implementation-ready app spec for a simple internal tool.
 *
 * Returns a single appSpec object (layout, fields, status flow, theme, features)
 * that build.js can compile into a deployable HTML app.
 *
 * Refactored 2026-05 to use orchestrator + prompts registry.
 */

import { createClient } from '@supabase/supabase-js'
import { createOrchestrator, respondWithError } from './lib/orchestrator.js'
import { devlog, devlogError } from './lib/devlog.js'
import { APP_SPEC, buildHistoryContext, buildAnswersContext } from './lib/prompts.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const SPEC_USER_TEMPLATE = `Generate a complete enterprise app specification for this request:

"{{prompt}}"{{answers}}{{history}}

Think through the first-principles questions internally, then produce the spec.

Return this exact JSON structure:

{
  "appTitle": "Sharp, domain-specific name — 2-4 words. Avoid generic words like 'Manager' or 'System'",
  "appType": "Specific type (e.g. 'Procurement Approval Queue', 'Clinical Trial Case Management')",
  "tagline": "One punchy line — what it does and who it helps",
  "purpose": "2-3 sentences: business problem, replaced workflow, key value",
  "designRationale": "1-2 sentences: why this layout and visual direction fit this workflow",
  "workflowType": "approval_workflow | intake_tracker | status_board",
  "layoutType": "split_panel_review | queue_detail | kanban_board | table_admin | wizard_flow | workflow_pipeline | command_center | timeline_view | form_first_admin | document_workspace | calendar_scheduler",
  "colorTheme": {
    "name": "Descriptive name (e.g. 'midnight indigo')",
    "primary": "#hexcode — domain-appropriate",
    "light": "#hexcode — very pale tint of primary",
    "text": "#hexcode — very dark version of primary, readable on white"
  },
  "features": ["Verb-led feature 1", "Feature 2", "Feature 3", "Feature 4"],
  "fields": [
    { "name": "snake_case", "label": "Domain-specific Label", "type": "text|number|email|date|select|textarea", "required": true, "options": [] }
  ],
  "statusFlow": ["Domain-specific Status 1", "Status 2", "Status 3", "Status 4"],
  "primaryActionLabel": "Action verb + noun (e.g. 'Submit Request')"
}

SELF-CRITIQUE before returning:
- Would this app make sense for a different industry? If yes, make it more specific.
- Are field names generic? Make them domain-specific.
- Is the layout the best fit? If not, change it.
- Is the color domain-appropriate? If not, change it.`

function normalizeSpec(spec) {
  if (!spec) return spec
  const valid = ['approval_workflow', 'intake_tracker', 'status_board']
  if (!valid.includes(spec.workflowType)) {
    const wf = (spec.workflowType || '').toLowerCase()
    if (/approv|review|request|procure|budget/.test(wf))     spec.workflowType = 'approval_workflow'
    else if (/intake|ticket|incident|support|case/.test(wf)) spec.workflowType = 'intake_tracker'
    else                                                      spec.workflowType = 'status_board'
  }
  if (spec.fields) {
    spec.fields = spec.fields.map(f => ({
      ...f,
      name: f.name || (f.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    }))
  }
  return spec
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationId, clarificationAnswers, conversationHistory, aiModel } = req.body
  if (!prompt || !conversationId) return res.status(400).json({ error: 'Missing fields: prompt, conversationId' })

  const orch = createOrchestrator({
    workflow: 'app_spec',
    aiModel,
    traceContext: { conversationId },
  })

  try {
    const userPrompt = SPEC_USER_TEMPLATE
      .replace('{{prompt}}', prompt)
      .replace('{{answers}}', buildAnswersContext(clarificationAnswers))
      .replace('{{history}}', buildHistoryContext(conversationHistory, 6))

    const rawSpec = await orch.json('generate_spec', {
      tier: 'smart',
      maxTokens: 3500,
      system: APP_SPEC,
      prompt: userPrompt,
    })
    const spec = normalizeSpec(rawSpec)

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      message_type: 'confirmation',
      metadata: { cardType: 'spec', spec, traceId: orch.traceId },
    })

    orch.end({ workflowType: spec?.workflowType, layoutType: spec?.layoutType })
    devlog('spec.generated', { conversationId, traceId: orch.traceId })
    return res.json({ spec, traceId: orch.traceId })
  } catch (err) {
    devlogError('spec.generation_failed', { conversationId, error: err.message })
    return respondWithError(res, err, orch)
  }
}

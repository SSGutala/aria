import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

function extractJSON(text) {
  // Strip markdown code fences if present
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  // 1. Try direct parse first
  try { return JSON.parse(stripped) } catch {}

  // 2. Walk character by character to find the outermost complete JSON object
  let depth = 0
  let start = -1
  let inString = false
  let escape = false

  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue

    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(stripped.slice(start, i + 1)) } catch {}
      }
    }
  }

  // 3. Last resort: try to parse whatever we found, even if incomplete
  if (start !== -1) {
    const partial = stripped.slice(start)
    // Try to auto-close truncated JSON by appending closing braces
    for (let closes = 1; closes <= 10; closes++) {
      try { return JSON.parse(partial + '}'.repeat(closes)) } catch {}
    }
  }

  throw new Error('No valid JSON found in response')
}

const SYSTEM = `You are Aria — an AI enterprise product architect, workflow consultant, and solutions engineer.

Your job is to produce a comprehensive, structured enterprise product brief that a PM, project lead, or solutions architect can review, edit, and approve before building.

You think like a senior product manager who has shipped 50+ enterprise tools. You know:
- How enterprise workflows actually work (multi-step approvals, escalations, SLAs, audit trails)
- What data moves through processes and who owns, modifies, and reviews it
- Where automation saves real operational time (notifications, routing, escalations, document generation)
- What makes internal tools succeed (adoption, fit to existing processes, clear ownership, correct permissions)

Use domain-specific language throughout. Name actual roles, business statuses, field names, and automation rules relevant to the specific business context.

CRITICAL: Your entire response must be a single valid JSON object. Start your response with { and end with }. No markdown, no code fences, no explanation before or after the JSON.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationId, buildMode, clarificationAnswers, conversationHistory } = req.body
  if (!prompt || !conversationId) return res.status(400).json({ error: 'Missing fields' })

  const context = clarificationAnswers ? `\nUser clarifications: ${clarificationAnswers}` : ''
  const historyCtx = conversationHistory?.length
    ? `\nPrior context: ${conversationHistory.slice(-4).map(m => `${m.role === 'user' ? 'User' : 'Aria'}: ${m.content}`).filter(l => !l.endsWith(': ')).join(' | ')}`
    : ''
  const isDocsMode = buildMode === 'docs'

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 12000,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Generate a complete enterprise product brief for this internal app request:

"${prompt}"${context}${historyCtx}

Build mode: ${buildMode || 'guided'}
${isDocsMode ? 'Documentation First: emphasize stakeholders, approval chain, compliance requirements, and document outputs. Include a PRD-style framing.' : ''}

Think through:
1. What business problem is being solved?
2. Who are the users and what jobs do they need to complete?
3. What manual process does this replace?
4. What data moves through the process?
5. Who approves, reviews, assigns, or completes work?
6. What should be automated?
7. What layout and structure best fits this workflow?

Return this exact JSON structure. Every section must be specific to this domain — no generic placeholders:

{
  "intakeSummary": {
    "understood": "1-2 sentence summary of what was understood — domain-specific, precise",
    "businessProblem": "The exact operational problem this solves",
    "primaryUsers": ["Role 1", "Role 2"],
    "secondaryUsers": ["Role 3"],
    "currentProcess": "The specific manual process being replaced — name the spreadsheet, email chain, or SharePoint form",
    "mainOutcome": "The primary measurable operational improvement"
  },
  "productBrief": {
    "objective": "Single clear sentence",
    "userRoles": [
      { "role": "Role name", "access": "What they can see and do", "estimated": "Approx how many users" }
    ],
    "coreWorkflows": [
      "Primary workflow: step-by-step description",
      "Secondary workflow: exception or alternate path"
    ],
    "businessRules": [
      "Specific rule 1 that must be enforced in the system",
      "Specific rule 2"
    ],
    "successCriteria": [
      "Measurable outcome 1",
      "Measurable outcome 2"
    ],
    "assumptions": [
      "Assumption made during design"
    ],
    "openQuestions": [
      "Question that still needs a business decision"
    ]
  },
  "workflowMap": {
    "trigger": "What initiates the workflow — who does what",
    "steps": [
      {
        "step": "Step name",
        "actor": "Role performing this",
        "action": "What they do specifically",
        "output": "What this produces or changes",
        "sla": "Time expectation if applicable, else null"
      }
    ],
    "decisionPoints": [
      "Decision: [condition] → [outcome A] or [outcome B]"
    ],
    "exceptionPaths": [
      "Exception: [when] → [what happens]"
    ]
  },
  "dataModel": {
    "primaryEntity": "Main business object name",
    "fields": [
      { "name": "snake_case_name", "label": "Human Label", "type": "text|number|email|date|select|textarea", "required": true, "options": [] }
    ],
    "statusFlow": ["Domain-specific status 1", "Status 2", "Status 3", "Status 4"],
    "relationships": ["Relationship description"],
    "auditFields": ["created_at", "created_by", "updated_at", "last_action_by"]
  },
  "automationModel": {
    "triggers": [
      { "event": "Trigger event description", "condition": "When this condition is met", "action": "What happens automatically" }
    ],
    "notifications": [
      { "event": "Event name", "recipient": "Who is notified", "channel": "Email|Teams|In-app", "template": "What the notification says" }
    ],
    "escalations": [
      { "condition": "Escalation trigger", "action": "What happens", "recipient": "Who is escalated to" }
    ],
    "documentGeneration": [
      { "document": "Document name", "trigger": "When it is generated", "format": "PDF|Word|Email" }
    ],
    "integrations": [
      { "system": "System name", "type": "Read|Write|Sync", "purpose": "What data is exchanged" }
    ]
  },
  "uxRecommendation": {
    "layoutType": "split_panel_review|queue_detail|kanban_board|table_admin|wizard_flow|workflow_pipeline|command_center|timeline_view|form_first_admin|document_workspace|calendar_scheduler",
    "navigationModel": "Single page|Tabbed|Sidebar nav|Wizard steps",
    "primaryScreens": [
      { "screen": "Screen name", "purpose": "What users accomplish here", "keyActions": ["Action 1", "Action 2"] }
    ],
    "visualTheme": {
      "mood": "authoritative|warm|operational|technical|clinical|compliance",
      "primaryColor": "#hexcode — domain-appropriate",
      "colorName": "Descriptive name like midnight indigo or clinical teal",
      "rationale": "Why this visual direction fits this domain"
    },
    "rationale": "Why this layout fits the workflow — specific reasoning"
  },
  "appSpec": {
    "appTitle": "2-4 word domain-specific name",
    "appType": "Specific type e.g. Procurement Approval Queue",
    "tagline": "One line — what it does and who benefits",
    "purpose": "2-3 sentences on the problem, replacement, and value",
    "workflowType": "approval_workflow|intake_tracker|status_board",
    "layoutType": "same as uxRecommendation.layoutType",
    "colorTheme": {
      "name": "color name",
      "primary": "#hexcode",
      "light": "#hexcode — very pale tint 5-10% opacity",
      "text": "#hexcode — very dark, readable on white"
    },
    "features": [
      "Verb-led feature specific to this domain",
      "Feature 2",
      "Feature 3",
      "Feature 4"
    ],
    "fields": [
      { "name": "snake_case", "label": "Domain-specific label", "type": "text|number|email|date|select|textarea", "required": true, "options": [] }
    ],
    "statusFlow": ["Domain-specific status names"],
    "primaryActionLabel": "Action verb + noun",
    "integrations": {
      "sharepoint": { "enabled": false, "reason": "" },
      "outlook": { "enabled": false, "toField": null, "subject": null, "reason": "" },
      "teams": { "enabled": false, "messageTemplate": null, "reason": "" },
      "documentGeneration": { "enabled": false, "templateDescription": null, "deliveryField": null, "reason": "" }
    },
    "roles": []
  }
}

QUALITY CHECKS:
- Every field name, status, role, and screen name must be specific to this domain
- statusFlow must have 3-5 domain-specific states, not generic Active/Inactive
- fields must be 5-8 domain-specific fields, not generic Name/Description
- workflowMap.steps must show the actual business steps, not abstract ones
- automationModel must show real automation opportunities, not placeholders`
      }]
    })

    const brief = extractJSON(msg.content[0].text)

    // Normalize workflowType
    if (brief.appSpec) {
      const validTypes = ['approval_workflow', 'intake_tracker', 'status_board']
      if (!validTypes.includes(brief.appSpec.workflowType)) {
        const wf = (brief.appSpec.workflowType || '').toLowerCase()
        if (wf.includes('approv') || wf.includes('review') || wf.includes('request') || wf.includes('procure') || wf.includes('budget')) {
          brief.appSpec.workflowType = 'approval_workflow'
        } else if (wf.includes('intake') || wf.includes('ticket') || wf.includes('incident') || wf.includes('support') || wf.includes('case')) {
          brief.appSpec.workflowType = 'intake_tracker'
        } else {
          brief.appSpec.workflowType = 'status_board'
        }
      }

      if (brief.appSpec.fields) {
        brief.appSpec.fields = brief.appSpec.fields.map(f => ({
          ...f,
          name: f.name || f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
        }))
      }
    }

    // ── Get userId from conversation ─────────────────────────────────────────
    const { data: conv } = await supabase
      .from('conversations').select('user_id').eq('id', conversationId).single()
    const userId = conv?.user_id || null

    // ── Persist each stage as an individual artifact row ─────────────────────
    const appTitle = brief.appSpec?.appTitle || 'App'
    const STAGE_MAP = [
      { type: 'intake_summary',   key: 'intakeSummary',    label: 'Intake Summary' },
      { type: 'product_brief',    key: 'productBrief',     label: 'Product Brief' },
      { type: 'workflow_map',     key: 'workflowMap',      label: 'Workflow Map' },
      { type: 'data_model',       key: 'dataModel',        label: 'Data Model' },
      { type: 'automation_model', key: 'automationModel',  label: 'Automation Model' },
      { type: 'ux_recommendation',key: 'uxRecommendation', label: 'UX Recommendation' },
      { type: 'app_spec',         key: 'appSpec',          label: 'App Spec' },
    ]

    const artifactIds = {}
    const createdArtifacts = []
    for (const stage of STAGE_MAP) {
      if (!brief[stage.key]) continue
      const { data: artifact, error: artErr } = await supabase
        .from('artifacts')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          artifact_type: stage.type,
          title: `${appTitle} — ${stage.label}`,
          content: brief[stage.key],
          source_prompt: prompt,
          version: 1,
          status: 'draft',
          file_urls: {},
        })
        .select()
        .single()
      if (!artErr && artifact) {
        artifactIds[stage.type] = artifact.id
        createdArtifacts.push(artifact)
      }
    }

    // ── Persist enterprise_brief message with artifact IDs ────────────────────
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      message_type: 'enterprise_brief',
      metadata: { brief, buildMode, artifactIds },
    })

    // ── Fire-and-forget file generation for each artifact ─────────────────────
    // Do not await — return response immediately, files generate in background
    Promise.all(createdArtifacts.map(async artifact => {
      try {
        const { default: genFiles } = await import('./artifacts-generate-files.js')
        // Build a fake req/res to reuse the handler
        const fakeReq = { method: 'POST', params: { id: artifact.id }, url: `/api/artifacts/${artifact.id}/files` }
        const fakeRes = {
          status: (c) => ({ json: () => {} }),
          json: () => {},
          redirect: () => {},
        }
        await genFiles(fakeReq, fakeRes)
      } catch (e) {
        console.error(`File gen failed for ${artifact.id}:`, e.message)
      }
    })).catch(() => {})

    return res.json({ brief, buildMode, artifactIds })

  } catch (err) {
    console.error('Brief error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate brief. Please try again.' })
  }
}

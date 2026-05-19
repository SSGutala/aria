/**
 * /api/brief — Generate a full enterprise brief.
 *
 * Pipeline:
 *   1. Generate the 7-stage brief JSON via orchestrator (smart tier)
 *   2. Normalize workflowType + ensure field names
 *   3. Persist each stage as an individual artifact row
 *   4. Persist the enterprise_brief card message
 *   5. Generate a Mermaid workflow diagram (parallel/fast tier)
 *   6. Fire-and-forget file generation (PDF/DOCX/XLSX) for each artifact
 *
 * Refactored 2026-05 to use orchestrator + prompts registry.
 */

import { createClient } from '@supabase/supabase-js'
import { createOrchestrator, respondWithError } from './lib/orchestrator.js'
import {
  ENTERPRISE_BRIEF,
  MERMAID_DIAGRAM,
  buildHistoryContext,
  buildAnswersContext,
} from './lib/prompts.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const STAGE_MAP = [
  { type: 'intake_summary',    key: 'intakeSummary',    label: 'Intake Summary' },
  { type: 'product_brief',     key: 'productBrief',     label: 'Product Brief' },
  { type: 'workflow_map',      key: 'workflowMap',      label: 'Workflow Map' },
  { type: 'data_model',        key: 'dataModel',        label: 'Data Model' },
  { type: 'automation_model',  key: 'automationModel',  label: 'Automation Model' },
  { type: 'ux_recommendation', key: 'uxRecommendation', label: 'UX Recommendation' },
  { type: 'app_spec',          key: 'appSpec',          label: 'App Spec' },
]

const BRIEF_USER_TEMPLATE = `Generate a complete enterprise product brief for this request:

"{{prompt}}"{{answers}}{{history}}

Build mode: {{buildMode}}
{{docsNote}}

Think through:
1. What business problem is being solved?
2. Who are the users and what jobs do they need to complete?
3. What manual process does this replace?
4. What data moves through the process?
5. Who approves, reviews, assigns, or completes work?
6. What should be automated?
7. What layout and structure best fits this workflow?

Return this exact JSON structure. Every section must be specific to this domain:

{
  "intakeSummary": {
    "understood": "1-2 sentence domain-specific summary",
    "businessProblem": "The exact operational problem",
    "primaryUsers": ["Role 1", "Role 2"],
    "secondaryUsers": ["Role 3"],
    "currentProcess": "Specific manual process being replaced",
    "mainOutcome": "Primary measurable operational improvement"
  },
  "productBrief": {
    "objective": "Single clear sentence",
    "userRoles": [{ "role": "Role name", "access": "What they can do", "estimated": "Approx user count" }],
    "coreWorkflows": ["Primary workflow", "Secondary workflow or exception"],
    "businessRules": ["Specific enforceable rule 1", "Rule 2"],
    "successCriteria": ["Measurable outcome 1", "Outcome 2"],
    "assumptions": ["Design assumption 1"],
    "openQuestions": ["Unresolved business decision 1"]
  },
  "workflowMap": {
    "trigger": "What initiates the workflow",
    "steps": [{ "step": "Step name", "actor": "Role", "action": "What they do", "output": "What this produces", "sla": "Time expectation or null" }],
    "decisionPoints": ["Decision: [condition] → [outcome A] or [outcome B]"],
    "exceptionPaths": ["Exception: [when] → [what happens]"]
  },
  "dataModel": {
    "primaryEntity": "Main business object name",
    "fields": [{ "name": "snake_case", "label": "Human Label", "type": "text|number|email|date|select|textarea", "required": true, "options": [] }],
    "statusFlow": ["Domain status 1", "Status 2", "Status 3", "Status 4"],
    "relationships": ["Relationship description"],
    "auditFields": ["created_at", "created_by", "updated_at", "last_action_by"]
  },
  "automationModel": {
    "triggers": [{ "event": "Trigger event", "condition": "When this is met", "action": "What happens" }],
    "notifications": [{ "event": "Event name", "recipient": "Who is notified", "channel": "Email|Teams|In-app", "template": "Message" }],
    "escalations": [{ "condition": "Escalation trigger", "action": "What happens", "recipient": "Who is escalated to" }],
    "documentGeneration": [{ "document": "Document name", "trigger": "When generated", "format": "PDF|Word|Email" }],
    "integrations": [{ "system": "System name", "type": "Read|Write|Sync", "purpose": "What data is exchanged" }]
  },
  "uxRecommendation": {
    "layoutType": "split_panel_review|queue_detail|kanban_board|table_admin|wizard_flow|workflow_pipeline|command_center|timeline_view|form_first_admin|document_workspace|calendar_scheduler",
    "navigationModel": "Single page|Tabbed|Sidebar nav|Wizard steps",
    "primaryScreens": [{ "screen": "Screen name", "purpose": "What users accomplish", "keyActions": ["Action 1", "Action 2"] }],
    "visualTheme": {
      "mood": "authoritative|warm|operational|technical|clinical|compliance",
      "primaryColor": "#hexcode",
      "colorName": "Descriptive name",
      "rationale": "Why this fits"
    },
    "rationale": "Why this layout fits the workflow"
  },
  "appSpec": {
    "appTitle": "2-4 word domain-specific name",
    "appType": "Specific type",
    "tagline": "One line",
    "purpose": "2-3 sentences",
    "workflowType": "approval_workflow|intake_tracker|status_board",
    "layoutType": "same as uxRecommendation.layoutType",
    "colorTheme": { "name": "color name", "primary": "#hex", "light": "#hex", "text": "#hex" },
    "features": ["Verb-led feature 1", "Feature 2", "Feature 3", "Feature 4"],
    "fields": [{ "name": "snake_case", "label": "Domain label", "type": "text|number|email|date|select|textarea", "required": true, "options": [] }],
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
- Every field name, status, role, screen name is domain-specific
- statusFlow has 3-5 domain-specific states (no Active/Inactive)
- fields have 5-8 domain-specific entries (no generic Name/Description)
- workflowMap.steps shows actual business steps
- automationModel shows real automation opportunities`

function buildBriefPrompt({ prompt, buildMode, clarificationAnswers, conversationHistory }) {
  return BRIEF_USER_TEMPLATE
    .replace('{{prompt}}', prompt)
    .replace('{{answers}}', buildAnswersContext(clarificationAnswers))
    .replace('{{history}}', buildHistoryContext(conversationHistory, 4))
    .replace('{{buildMode}}', buildMode || 'guided')
    .replace('{{docsNote}}', buildMode === 'docs'
      ? 'Documentation First: emphasize stakeholders, approval chain, compliance, document outputs.'
      : '')
}

function normalizeBrief(brief) {
  if (!brief?.appSpec) return brief
  const validTypes = ['approval_workflow', 'intake_tracker', 'status_board']
  if (!validTypes.includes(brief.appSpec.workflowType)) {
    const wf = (brief.appSpec.workflowType || '').toLowerCase()
    if (/approv|review|request|procure|budget/.test(wf))         brief.appSpec.workflowType = 'approval_workflow'
    else if (/intake|ticket|incident|support|case/.test(wf))     brief.appSpec.workflowType = 'intake_tracker'
    else                                                          brief.appSpec.workflowType = 'status_board'
  }
  if (brief.appSpec.fields) {
    brief.appSpec.fields = brief.appSpec.fields.map(f => ({
      ...f,
      name: f.name || (f.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    }))
  }
  return brief
}

async function persistArtifacts(brief, { conversationId, userId, prompt, sourcePrompt }) {
  const appTitle = brief.appSpec?.appTitle || 'App'
  const artifactIds = {}
  const created = []
  for (const stage of STAGE_MAP) {
    if (!brief[stage.key]) continue
    const { data: artifact, error } = await supabase.from('artifacts').insert({
      conversation_id: conversationId,
      user_id: userId,
      artifact_type: stage.type,
      title: `${appTitle} — ${stage.label}`,
      content: brief[stage.key],
      source_prompt: sourcePrompt || prompt,
      version: 1,
      status: 'draft',
      file_urls: {},
    }).select().single()
    if (!error && artifact) {
      artifactIds[stage.type] = artifact.id
      created.push(artifact)
    }
  }
  return { artifactIds, created }
}

async function generateAndPersistDiagram(orch, brief, conversationId) {
  try {
    const mermaidSource = (await orch.text('workflow_diagram', {
      tier: 'fast',
      maxTokens: 1500,
      system: MERMAID_DIAGRAM,
      prompt: `Workflow brief:\n${JSON.stringify(brief?.workflowMap || brief?.productBrief || {}, null, 2)}`,
    })).trim().replace(/^```mermaid\n?/, '').replace(/```$/, '').trim()

    const { data: artifact } = await supabase.from('artifacts').insert({
      conversation_id: conversationId,
      artifact_type: 'workflow_diagram',
      title: 'Workflow Diagram',
      content: { mermaid_source: mermaidSource, diagram_type: 'flowchart' },
      version: 1,
      status: 'draft',
    }).select().single()
    return artifact
  } catch (e) {
    // Diagram generation is non-critical — log but don't fail the whole brief
    return null
  }
}

function fireAndForgetFileGen(artifacts) {
  if (!artifacts?.length) return
  Promise.all(artifacts.map(async (artifact) => {
    try {
      const { default: genFiles } = await import('./artifacts-generate-files.js')
      const fakeReq = { method: 'POST', params: { id: artifact.id }, url: `/api/artifacts/${artifact.id}/files` }
      const fakeRes = { status: () => ({ json: () => {} }), json: () => {}, redirect: () => {} }
      await genFiles(fakeReq, fakeRes)
    } catch {}
  })).catch(() => {})
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationId, buildMode, clarificationAnswers, conversationHistory, aiModel } = req.body
  if (!prompt || !conversationId) return res.status(400).json({ error: 'Missing fields: prompt, conversationId' })

  const orch = createOrchestrator({
    workflow: 'enterprise_brief',
    aiModel,
    traceContext: { conversationId, buildMode },
  })

  try {
    // ─── Generate the 7-stage brief ──────────────────────────────────────────
    const rawBrief = await orch.json('generate_brief', {
      tier: 'smart',
      maxTokens: 7500,
      system: ENTERPRISE_BRIEF,
      prompt: buildBriefPrompt({ prompt, buildMode, clarificationAnswers, conversationHistory }),
    })
    const brief = normalizeBrief(rawBrief)

    // ─── Get userId for artifact ownership ───────────────────────────────────
    const { data: conv } = await supabase.from('conversations').select('user_id').eq('id', conversationId).single()
    const userId = conv?.user_id || null

    // ─── Persist artifacts (one per stage) ───────────────────────────────────
    const { artifactIds, created } = await persistArtifacts(brief, { conversationId, userId, prompt })

    // ─── Persist the brief message card ──────────────────────────────────────
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      message_type: 'confirmation',
      metadata: { cardType: 'enterprise_brief', brief, buildMode, artifactIds, traceId: orch.traceId },
    })

    // ─── Generate workflow diagram (parallel, fast tier) ─────────────────────
    const diagramArtifact = await generateAndPersistDiagram(orch, brief, conversationId)
    if (diagramArtifact) {
      artifactIds.workflow_diagram = diagramArtifact.id
      created.push(diagramArtifact)
    }

    // ─── Kick off file generation in the background ──────────────────────────
    fireAndForgetFileGen(created)

    orch.end({ stageCount: Object.keys(artifactIds).length, hasDiagram: !!diagramArtifact })
    return res.json({ brief, buildMode, artifactIds, traceId: orch.traceId })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}

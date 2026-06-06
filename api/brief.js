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
import { devlog, devlogError } from './lib/devlog.js'
import {
  ENTERPRISE_BRIEF,
  MERMAID_DIAGRAM,
  buildHistoryContext,
  buildAnswersContext,
} from './lib/prompts.js'
import {
  buildRoleContextPrompt,
  getRoleArtifactInstruction,
  getRoleStageOverrides,
} from './lib/roleFlows.js'

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
    "understood": "2-3 sentence domain-specific summary of what is being built and why it matters now",
    "businessProblem": "A full paragraph: the exact operational problem, quantified (time lost, error rate, cost, volume) and who feels the pain",
    "primaryUsers": ["Role 1 (with context)", "Role 2 (with context)", "Role 3"],
    "secondaryUsers": ["Role with how they interact", "Another"],
    "currentProcess": "A detailed description of the current manual process step by step, including the tools used (spreadsheet, email, SharePoint) and where it breaks down",
    "mainOutcome": "The primary measurable operational improvement, quantified with a target"
  },
  "productBrief": {
    "objective": "A clear, specific objective statement (2-3 sentences)",
    "background": "A paragraph of context: why now, prior attempts, and the trigger for this work",
    "scope": { "inScope": ["Capability in scope", "..."], "outOfScope": ["Explicitly excluded", "..."] },
    "userRoles": [{ "role": "Role name", "access": "What they can do in detail", "estimated": "Approx user count" }],
    "coreWorkflows": ["Primary workflow (described)", "Secondary workflow", "Exception workflow", "..."],
    "businessRules": ["Specific enforceable rule with the condition and consequence", "Rule 2", "Rule 3", "..."],
    "successCriteria": ["Measurable outcome with baseline and target", "Outcome 2", "..."],
    "assumptions": ["Concrete checkable design assumption", "..."],
    "dependencies": ["Upstream/downstream system, team, or approval this depends on", "..."],
    "risks": [{ "risk": "Material risk", "impact": "What it affects", "mitigation": "Concrete mitigation", "owner": "Role" }],
    "openQuestions": ["Unresolved business decision and who must decide", "..."]
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

QUALITY CHECKS (enterprise depth — reject your own shallow output):
- Every field name, status, role, screen name is domain-specific
- statusFlow has 3-5 domain-specific states (no Active/Inactive)
- fields have 5-8 domain-specific entries (no generic Name/Description)
- workflowMap.steps shows 5+ actual business steps with actors, actions, outputs, and SLAs
- automationModel shows real automation opportunities (triggers, notifications, escalations)
- intakeSummary.businessProblem and productBrief.background are full paragraphs, not one sentence
- productBrief includes populated scope (in/out), dependencies, and risks
- No field is empty or a single generic sentence; quantify wherever possible`

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

async function persistArtifacts(brief, { conversationId, userId, prompt, sourcePrompt, roleId }) {
  const appTitle = brief.appSpec?.appTitle || 'App'
  const artifactIds = {}
  const created = []
  const stageOverrides = getRoleStageOverrides(roleId)
  for (const stage of STAGE_MAP) {
    if (!brief[stage.key]) continue
    const roleLabel = stageOverrides[stage.key] || stage.label
    const { data: artifact, error } = await supabase.from('artifacts').insert({
      conversation_id: conversationId,
      user_id: userId,
      artifact_type: stage.type,
      title: `${appTitle} — ${roleLabel}`,
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

  const { prompt, conversationId, buildMode, clarificationAnswers, conversationHistory, aiModel, roleContext } = req.body
  if (!prompt || !conversationId) return res.status(400).json({ error: 'Missing fields: prompt, conversationId' })
  const rolePreface = buildRoleContextPrompt(roleContext)
  const roleArtifactInstruction = getRoleArtifactInstruction(roleContext)

  const orch = createOrchestrator({
    workflow: 'enterprise_brief',
    aiModel,
    traceContext: { conversationId, buildMode },
  })

  try {
    // ─── Generate the 7-stage brief ──────────────────────────────────────────
    const baseUserPrompt = buildBriefPrompt({ prompt, buildMode, clarificationAnswers, conversationHistory })
    const userPrompt = roleArtifactInstruction
      ? `${baseUserPrompt}\n\n${roleArtifactInstruction}`
      : baseUserPrompt
    const rawBrief = await orch.json('generate_brief', {
      tier: 'smart',
      maxTokens: 11000,
      system: rolePreface ? `${ENTERPRISE_BRIEF}\n\n${rolePreface}` : ENTERPRISE_BRIEF,
      prompt: userPrompt,
    })
    const brief = normalizeBrief(rawBrief)

    // ─── Get userId for artifact ownership ───────────────────────────────────
    const { data: conv } = await supabase.from('conversations').select('user_id').eq('id', conversationId).single()
    const userId = conv?.user_id || null

    // ─── Persist artifacts (one per stage) ───────────────────────────────────
    const { artifactIds, created } = await persistArtifacts(brief, { conversationId, userId, prompt, roleId: roleContext?.role })

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
    devlog('brief.generated', { conversationId, buildMode, traceId: orch.traceId })
    return res.json({ brief, buildMode, artifactIds, traceId: orch.traceId })
  } catch (err) {
    devlogError('brief.generation_failed', { conversationId, error: err.message })
    return respondWithError(res, err, orch)
  }
}

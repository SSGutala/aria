/**
 * /api/role-brief — Generate role-specific brief and document packages.
 *
 * Roles: Operations, IT/Systems Admin, Compliance/Risk, Finance, HR.
 * Each role produces a meaningfully different document set, prompt frame,
 * and JSON schema. The per-role schemas are deliberately preserved verbatim
 * (they are contracts with the frontend stage renderers).
 *
 * Refactored 2026-05 to use orchestrator + prompts registry.
 *   - Shared identity/tone/quality/JSON-contract comes from ROLE_BRIEF
 *   - Per-role domain expertise overlay is appended (kept here as it is
 *     intrinsically role-specific knowledge)
 *   - The huge JSON schema templates are unchanged below
 */

import { createClient } from '@supabase/supabase-js'
import { createOrchestrator, respondWithError } from './lib/orchestrator.js'
import { devlog, devlogError } from './lib/devlog.js'
import { ROLE_BRIEF, buildHistoryContext } from './lib/prompts.js'
import { buildRoleContextPrompt } from './lib/roleFlows.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const VALID_ROLES = ['operations', 'it_admin', 'compliance', 'finance', 'hr']

// ── Per-role domain expertise overlays (appended to shared ROLE_BRIEF prompt) ─
const ROLE_OVERLAYS = {
  operations: `Role focus: Operations / Business Process Automation.
You are a senior operations architect who has automated hundreds of enterprise workflows.
You know how to map current-state processes, identify bottlenecks, design automation rules, build escalation matrices, and spec integrations.
Use domain language: SOPs, escalation paths, SLAs, RACI, exception handling, integration triggers.`,

  it_admin: `Role focus: IT Systems Architecture / Access Provisioning.
You are a senior IT architect who has designed hundreds of internal admin tools and provisioning systems.
You know permissions matrices, RBAC, SSO integrations, deployment runbooks, incident response flows, and admin console design.
Use domain language: RBAC, provisioning, de-provisioning, ITSM, access tiers, audit logs, runbooks.`,

  compliance: `Role focus: Compliance / Risk / Audit-ready Design.
You are a senior GRC (Governance, Risk, Compliance) consultant who has built compliance programs across regulated industries.
You know controls frameworks, evidence collection, risk matrices, audit trails, remediation workflows, and regulatory mapping.
Use domain language: controls, control owners, evidence, remediation, risk rating, audit cadence, GRC, COSO, SOC 2, ISO 27001.`,

  finance: `Role focus: Financial Workflow Automation / Approval Routing.
You are a senior finance operations architect who has built purchase-to-pay, budget approval, and reconciliation systems.
You know approval matrices, threshold-based routing, cost center management, ERP integrations, and financial reporting.
Use domain language: approval thresholds, cost centers, PO, invoice, reconciliation, GL codes, P2P, ERP.`,

  hr: `Role focus: HR Operations / Employee Lifecycle.
You are a senior HRIS architect who has built onboarding systems, PTO workflows, and employee lifecycle automation.
You know employee journey mapping, policy enforcement, manager approvals, HRIS integrations, and HR notification design.
Use domain language: employee lifecycle, onboarding, offboarding, HRIS, headcount, PTO, leave policy, manager hierarchy.`,
}

// ─────────────────────────────────────────────────────────────────────────────
// Role-specific JSON schema templates (UNCHANGED — these are frontend contracts).
// Each returns the user-message body containing the exact JSON shape expected.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_PROMPTS = {
  operations: (prompt, pkg, answers) => `
Build a comprehensive Operations / Business Ops brief for this project: "${prompt}"

Scope: ${pkg} package
User answers: ${JSON.stringify(answers, null, 2)}

Generate a role-specific brief with EXACTLY this JSON structure:
{
  "intakeSummary": {
    "understood": "What Aria understands about the operational challenge",
    "currentProcess": "Step-by-step description of the current manual process",
    "bottlenecks": ["Identified bottleneck 1", "Bottleneck 2"],
    "primaryUsers": ["Role 1", "Role 2"],
    "mainOutcome": "What the automated system will achieve"
  },
  "processAnalysis": {
    "currentState": "Narrative of the current state process",
    "painPoints": ["Pain point 1", "Pain point 2"],
    "automationOpportunities": ["Opportunity 1", "Opportunity 2"],
    "estimatedTimeSavings": "X hours/week per team"
  },
  "workflowMap": {
    "trigger": "What initiates the workflow",
    "steps": [
      { "step": "Step name", "actor": "Role", "action": "What they do", "output": "What is produced", "sla": "Time SLA or null", "automatable": true }
    ],
    "decisionPoints": ["Decision 1 description"],
    "exceptionPaths": ["Exception 1 description"],
    "escalationRules": [{ "trigger": "Condition", "action": "What happens", "escalateTo": "Role" }]
  },
  "automationModel": {
    "triggers": [{ "event": "Event name", "condition": "When this fires", "action": "What happens" }],
    "routingRules": [{ "condition": "Routing condition", "destination": "Where it goes", "reason": "Why" }],
    "slaEnforcement": [{ "step": "Step name", "sla": "Time limit", "breach": "What happens on breach" }],
    "notifications": [{ "event": "Event", "recipient": "Who", "channel": "Email/Slack/Teams", "template": "Message template" }],
    "integrations": [{ "system": "System name", "direction": "inbound/outbound/bidirectional", "dataExchanged": "What data", "trigger": "When" }]
  },
  "sop": {
    "title": "SOP title",
    "purpose": "Purpose of this SOP",
    "scope": "Who and what this covers",
    "roles": [{ "role": "Role name", "responsibilities": ["Responsibility 1"] }],
    "procedure": [{ "step": 1, "action": "What to do", "actor": "Role", "expectedOutcome": "Result" }],
    "exceptions": [{ "scenario": "Exception scenario", "action": "How to handle" }]
  },
  "dataModel": {
    "primaryEntity": "Main data object name",
    "fields": [{ "name": "field_name", "label": "Field Label", "type": "text|select|textarea|date|number|boolean", "required": true, "options": [] }],
    "statusFlow": ["Status 1", "Status 2"],
    "auditFields": ["created_at", "created_by", "updated_at", "updated_by"]
  },
  "integrationSpec": {
    "systems": [{ "name": "System", "purpose": "Why integrated", "authMethod": "OAuth/API key/SSO", "dataFlow": "What moves", "frequency": "Real-time/batch" }]
  },
  "escalationMatrix": {
    "levels": [{ "level": 1, "trigger": "Condition", "escalateTo": "Role", "sla": "Time", "action": "What happens" }]
  },
}`,

  it_admin: (prompt, pkg, answers) => `
Build a comprehensive IT / Systems Admin brief for this project: "${prompt}"

Scope: ${pkg} package
User answers: ${JSON.stringify(answers, null, 2)}

Generate a role-specific brief with EXACTLY this JSON structure:
{
  "intakeSummary": {
    "understood": "What Aria understands about the IT/systems challenge",
    "systemsInvolved": ["System 1", "System 2"],
    "primaryUsers": ["IT Admin", "End User"],
    "complianceRequirements": ["Requirement 1"],
    "mainOutcome": "What the system will achieve"
  },
  "architectureDoc": {
    "overview": "System architecture narrative",
    "components": [{ "name": "Component", "role": "What it does", "technology": "Tech stack", "owner": "Team/role" }],
    "dataFlow": "How data moves through the system",
    "securityModel": "Authentication, authorization, and data protection approach",
    "deploymentTarget": "Cloud/on-prem/hybrid and specifics"
  },
  "permissionsMatrix": {
    "roles": [{ "role": "Role name", "description": "Who this is", "permissions": ["Can do X", "Can view Y"], "accessLevel": "admin|standard|read-only|approver" }],
    "provisioningTriggers": [{ "event": "Trigger event", "action": "What is provisioned", "timeline": "How fast" }],
    "deprovisioningRules": [{ "trigger": "Trigger", "action": "What is removed", "auditLog": true }]
  },
  "integrationSpec": {
    "systems": [{ "name": "System", "direction": "inbound|outbound|bidirectional", "authMethod": "OAuth/SAML/API key", "dataExchanged": "What data", "syncFrequency": "Real-time/batch/on-demand" }],
    "ssoConfig": { "provider": "SSO provider", "protocol": "SAML/OIDC", "attributes": ["Attribute mapping"] }
  },
  "provisioningWorkflow": {
    "trigger": "What initiates provisioning",
    "steps": [{ "step": "Step name", "actor": "Role", "action": "What happens", "systemsAffected": ["System"] }],
    "approvalRequired": true,
    "automatedSteps": ["Step 1 is automated"],
    "rollbackProcedure": "How to undo provisioning"
  },
  "adminConsoleSpec": {
    "sections": [{ "section": "Section name", "purpose": "What it does", "keyFunctions": ["Function 1"] }],
    "userManagement": "How admins manage users",
    "auditLogAccess": "How admins view audit trails",
    "alertsAndMonitoring": "What monitoring is built in"
  },
  "deploymentRunbook": {
    "prerequisites": ["Prerequisite 1"],
    "steps": [{ "phase": "Phase name", "actions": ["Action 1"], "verificationSteps": ["How to confirm it worked"] }],
    "rollbackPlan": "How to revert deployment",
    "postDeploymentChecks": ["Check 1"]
  },
  "dataModel": {
    "primaryEntity": "Main data object (e.g. AccessRequest, User, System)",
    "fields": [{ "name": "field_name", "label": "Label", "type": "text|select|boolean|date", "required": true, "options": [] }],
    "statusFlow": ["Pending", "Approved", "Provisioned", "Revoked"],
    "auditFields": ["created_at", "requested_by", "approved_by", "provisioned_at"]
  },
  "uxRecommendation": {
    "layoutType": "admin_console|dashboard|form_with_queue",
    "primaryScreens": [{ "screen": "Screen name", "purpose": "What it does", "keyActions": ["Action"] }],
    "visualTheme": { "mood": "technical|clean|authoritative", "primaryColor": "#hex", "colorName": "Name", "rationale": "Why" }
  },
  "appSpec": {
    "appTitle": "App name",
    "appType": "admin_portal|provisioning_tool|access_management",
    "tagline": "One-line value prop",
    "purpose": "What this replaces/enables",
    "features": ["Feature 1"],
    "fields": [{ "name": "field", "label": "Label", "type": "text", "required": true, "options": [] }],
    "statusFlow": ["Pending", "Approved", "Active", "Revoked"],
    "primaryActionLabel": "Submit Request / Provision / Revoke"
  }
}`,

  compliance: (prompt, pkg, answers) => `
Build a comprehensive Compliance / Risk brief for this project: "${prompt}"

Scope: ${pkg} package
User answers: ${JSON.stringify(answers, null, 2)}

Generate a role-specific brief with EXACTLY this JSON structure:
{
  "intakeSummary": {
    "understood": "What Aria understands about the compliance/risk challenge",
    "regulatoryFrameworks": ["SOC 2", "ISO 27001", "HIPAA"],
    "controlOwners": ["Role 1", "Role 2"],
    "auditCadence": "Annual/quarterly/continuous",
    "mainOutcome": "What the compliance system will achieve"
  },
  "controlsFramework": {
    "overview": "Summary of controls approach",
    "controls": [{ "id": "CTRL-01", "name": "Control name", "category": "Access|Data|Process|Technical", "description": "What this control ensures", "owner": "Role", "frequency": "Continuous/Monthly/Quarterly", "evidence": "What evidence is required", "riskRating": "High|Medium|Low" }]
  },
  "riskMatrix": {
    "risks": [{ "id": "RISK-01", "risk": "Risk description", "likelihood": "High|Medium|Low", "impact": "High|Medium|Low", "inherentRisk": "High|Medium|Low", "controls": ["CTRL-01"], "residualRisk": "High|Medium|Low", "owner": "Role", "reviewDate": "Quarterly" }]
  },
  "evidenceCollectionWorkflow": {
    "trigger": "What initiates evidence collection",
    "steps": [{ "step": "Step name", "actor": "Role", "action": "What is collected", "storageLocation": "Where evidence lives", "retentionPeriod": "How long kept" }],
    "automatedCollection": ["What can be collected automatically"],
    "manualCollection": ["What requires human action"]
  },
  "approvalChain": {
    "stages": [{ "stage": "Stage name", "approver": "Role", "criteria": "What they check", "sla": "Time limit", "escalation": "What happens if not actioned" }]
  },
  "auditTrailDesign": {
    "eventsLogged": ["Event 1 — what triggers a log entry"],
    "logFields": ["timestamp", "actor", "action", "outcome", "ip_address"],
    "retentionPolicy": "How long logs are kept",
    "accessControl": "Who can view audit logs",
    "exportFormat": "CSV/PDF/JSON"
  },
  "remediationWorkflow": {
    "trigger": "What triggers remediation",
    "steps": [{ "step": "Step", "actor": "Role", "action": "Action", "sla": "Time", "escalation": "If missed" }],
    "closureCriteria": "What constitutes remediation complete"
  },
  "reportingSpec": {
    "reports": [{ "name": "Report name", "audience": "Who sees this", "frequency": "Monthly/Quarterly/On-demand", "metrics": ["Metric 1"], "format": "Dashboard/PDF/CSV" }]
  },
  "dataModel": {
    "primaryEntity": "Control / Finding / EvidenceRecord",
    "fields": [{ "name": "field_name", "label": "Label", "type": "text|select|date|boolean", "required": true, "options": [] }],
    "statusFlow": ["Open", "In Progress", "Remediated", "Accepted", "Closed"],
    "auditFields": ["created_at", "identified_by", "assigned_to", "remediated_at", "closed_by"]
  },
}`,

  finance: (prompt, pkg, answers) => `
Build a comprehensive Finance brief for this project: "${prompt}"

Scope: ${pkg} package
User answers: ${JSON.stringify(answers, null, 2)}

Generate a role-specific brief with EXACTLY this JSON structure:
{
  "intakeSummary": {
    "understood": "What Aria understands about the financial workflow challenge",
    "processType": "Invoice approval / Budget request / Expense reimbursement / PO approval",
    "approvalLevels": ["Level 1: Manager up to $X", "Level 2: VP up to $Y"],
    "erpSystem": "SAP / NetSuite / QuickBooks / Coupa / other",
    "mainOutcome": "What the system will automate"
  },
  "approvalMatrix": {
    "overview": "How approvals are structured",
    "tiers": [{ "tier": "Tier 1", "threshold": "Up to $X", "approver": "Role", "sla": "24 hours", "escalation": "What happens if not actioned" }],
    "costCenterRules": [{ "costCenter": "Cost center name or ID", "approver": "Who approves", "budget": "Budget limit" }],
    "delegationRules": ["Rule about delegation when approver is OOO"]
  },
  "routingLogic": {
    "rules": [{ "condition": "If amount > $X AND department = Y", "route": "Where it goes", "priority": "High|Normal" }],
    "exceptionHandling": [{ "scenario": "Exception", "action": "How handled", "notifies": "Who is notified" }]
  },
  "workflowMap": {
    "trigger": "What initiates the request",
    "steps": [{ "step": "Step name", "actor": "Role", "action": "What they do", "output": "What is produced", "sla": "Time limit" }],
    "decisionPoints": ["Decision 1"],
    "exceptionPaths": ["Exception path 1"]
  },
  "financialControls": {
    "controls": [{ "control": "Control description", "purpose": "Why it exists", "enforcement": "How it is enforced" }],
    "auditRequirements": ["Audit requirement 1"],
    "segregationOfDuties": "Who can request vs approve vs process"
  },
  "reportingSpec": {
    "dashboards": [{ "name": "Dashboard name", "audience": "CFO / Finance team / Manager", "metrics": ["Metric 1"], "frequency": "Real-time/Weekly/Monthly" }],
    "reports": [{ "name": "Report name", "purpose": "What it shows", "format": "PDF/Excel/Dashboard", "frequency": "Monthly" }]
  },
  "erpIntegration": {
    "system": "ERP system name",
    "syncFields": ["Field 1 that syncs"],
    "frequency": "Real-time / End of day",
    "failureHandling": "What happens if sync fails"
  },
  "dataModel": {
    "primaryEntity": "Purchase Request / Invoice / Expense Report",
    "fields": [{ "name": "field_name", "label": "Label", "type": "text|select|number|date", "required": true, "options": [] }],
    "statusFlow": ["Draft", "Pending Approval", "Approved", "Rejected", "Paid"],
    "auditFields": ["created_at", "submitted_by", "approved_by", "approved_at", "gl_code"]
  },
}`,

  hr: (prompt, pkg, answers) => `
Build a comprehensive HR / People Ops brief for this project: "${prompt}"

Scope: ${pkg} package
User answers: ${JSON.stringify(answers, null, 2)}

Generate a role-specific brief with EXACTLY this JSON structure:
{
  "intakeSummary": {
    "understood": "What Aria understands about the HR/people ops challenge",
    "lifecycleEvent": "Onboarding / Offboarding / Leave / PTO / Promotion / Transfer",
    "primaryUsers": ["Employee (self-service)", "Manager", "HR"],
    "hrisSystem": "Workday / BambooHR / ADP / other",
    "mainOutcome": "What the workflow will automate"
  },
  "employeeJourneyMap": {
    "event": "What lifecycle event this covers",
    "phases": [{ "phase": "Phase name", "actor": "Who drives this phase", "activities": ["Activity 1"], "duration": "Estimated time", "systems": ["System involved"] }],
    "touchpoints": [{ "touchpoint": "Interaction name", "medium": "Email/Portal/In-person", "owner": "HR/Manager/System" }]
  },
  "policyDocumentation": {
    "policies": [{ "policy": "Policy name", "description": "What it covers", "eligibility": "Who qualifies", "limitations": ["Limitation 1"], "approvalRequired": true }]
  },
  "approvalMatrix": {
    "stages": [{ "stage": "Stage name", "approver": "Direct Manager / HR / Executive", "criteria": "What they check", "sla": "Time", "escalation": "If not actioned" }],
    "bypassRules": ["Condition when approval is skipped"]
  },
  "workflowMap": {
    "trigger": "What initiates the workflow (employee submits / manager triggers / system event)",
    "steps": [{ "step": "Step name", "actor": "Role", "action": "What happens", "output": "What is produced", "sla": "Time or null", "automated": true }],
    "decisionPoints": ["Decision 1"],
    "exceptionPaths": ["Exception path 1"]
  },
  "notificationPlan": {
    "notifications": [{ "event": "Trigger event", "recipient": "Employee/Manager/HR", "channel": "Email/Slack/Teams/Portal", "template": "Message content summary", "timing": "Immediately/Day before/Weekly" }]
  },
  "hrisIntegration": {
    "system": "HRIS system name",
    "syncedFields": ["Fields that sync"],
    "direction": "Aria → HRIS / HRIS → Aria / bidirectional",
    "frequency": "Real-time / Nightly"
  },
  "permissionsMatrix": {
    "roles": [{ "role": "Role name", "can": ["Action 1"], "cannot": ["Restricted action"] }]
  },
  "dataModel": {
    "primaryEntity": "Leave Request / Onboarding Record / HR Request",
    "fields": [{ "name": "field_name", "label": "Label", "type": "text|select|date|boolean|number", "required": true, "options": [] }],
    "statusFlow": ["Submitted", "Pending Manager Approval", "Pending HR Review", "Approved", "Rejected"],
    "auditFields": ["created_at", "submitted_by", "employee_id", "approved_by", "effective_date"]
  },
}`,
}

// Format clarification answers into a readable Q/A block.
function formatAnswers(clarificationAnswers) {
  if (!clarificationAnswers) return 'No clarification answers provided.'
  if (typeof clarificationAnswers === 'string') return clarificationAnswers
  if (Array.isArray(clarificationAnswers)) {
    return clarificationAnswers
      .map(qa => qa?.question && qa?.answer ? `Q: ${qa.question}\nA: ${Array.isArray(qa.answer) ? qa.answer.join(', ') : qa.answer}` : null)
      .filter(Boolean).join('\n\n')
  }
  return Object.entries(clarificationAnswers)
    .map(([q, a]) => `Q: ${q}\nA: ${Array.isArray(a) ? a.join(', ') : a}`)
    .join('\n\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationId, role, rolePackage, clarificationAnswers, conversationHistory, aiModel, roleContext } = req.body
  const rolePreface = buildRoleContextPrompt(roleContext)
  if (!prompt || !conversationId || !role) return res.status(400).json({ error: 'Missing required fields: prompt, conversationId, role' })
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: `Invalid role "${role}". Supported: ${VALID_ROLES.join(', ')}` })

  const promptFn = ROLE_PROMPTS[role]
  const overlay = ROLE_OVERLAYS[role]
  if (!promptFn || !overlay) return res.status(400).json({ error: `Role "${role}" is not configured` })

  const orch = createOrchestrator({
    workflow: 'role_brief',
    aiModel,
    traceContext: { conversationId, role, rolePackage: rolePackage || 'guided' },
  })

  try {
    // Compose system: shared ROLE_BRIEF foundation + per-role overlay + (optional) user-profile role preface
    const systemPrompt = rolePreface
      ? `${ROLE_BRIEF}\n\n${overlay}\n\n${rolePreface}`
      : `${ROLE_BRIEF}\n\n${overlay}`

    // Build user prompt: per-role schema body + conversation history tail
    const answersText = formatAnswers(clarificationAnswers)
    const userPrompt = promptFn(prompt, rolePackage || 'guided', answersText) + buildHistoryContext(conversationHistory, 4)

    const brief = await orch.json('generate_role_brief', {
      tier: 'smart',
      maxTokens: 7000,
      system: systemPrompt,
      prompt: userPrompt,
    })

    // Persist enterprise_brief message
    const { error: insertErr } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      message_type: 'confirmation',
      metadata: {
        cardType: 'enterprise_brief',
        brief,
        buildMode: role,
        rolePackage: rolePackage || 'guided',
        artifactIds: {},
        traceId: orch.traceId,
      },
    })
    if (insertErr) console.error('DB insert error (role-brief):', insertErr)

    orch.end({ role, rolePackage: rolePackage || 'guided', stageCount: Object.keys(brief).length })
    devlog('role_brief.generated', { conversationId, role, traceId: orch.traceId })
    return res.json({
      buildMode: role,
      rolePackage: rolePackage || 'guided',
      brief,
      artifactIds: {},
      traceId: orch.traceId,
    })
  } catch (err) {
    devlogError('role_brief.generation_failed', { conversationId, role, error: err.message })
    return respondWithError(res, err, orch)
  }
}

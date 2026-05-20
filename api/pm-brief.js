/**
 * /api/pm-brief — Generate the full PM document stack.
 *
 * Runs 4-6 parallel AI calls (one per logical document group), each at the
 * appropriate model tier:
 *   1. Narrative      (intakeSummary, problemStatement, productBrief)   fast
 *   2. Requirements   (prd, userStories, successMetrics, qaTestPlan)    smart
 *   3. Workflow       (workflowMap, dataModel, automationModel)         balanced
 *   4. Tech & UX      (technicalArchitecture, integrationSpec, ux, app) fast
 *   5. Financial      (businessCase, costBreakdown, roiAnalysis, perms, signoff)   smart    [enterprise+]
 *   6. Compliance     (legalCompliance, dataSecurity, current/future state, launch) balanced [enterprise+]
 *
 * All calls share the same orchestrator trace so total cost/latency is
 * attributable per request. Each call is its own span.
 *
 * Schemas are preserved verbatim — they are frontend contracts.
 *
 * Refactored 2026-05 to use orchestrator + prompts registry.
 */

import { createClient } from '@supabase/supabase-js'
import { createOrchestrator, respondWithError } from './lib/orchestrator.js'
import { devlog, devlogError } from './lib/devlog.js'
import { PM_BRIEF, buildHistoryContext, buildAnswersContext } from './lib/prompts.js'
import { buildRoleContextPrompt } from './lib/roleFlows.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

// ═══════════════════════════════════════════════════════════════════════════
// Per-stage-group prompt builders. Each returns a function that takes
// (prompt, pmPackage, context, histCtx) and returns the user-message body.
// System prompt for every group is the shared PM_BRIEF.
// ═══════════════════════════════════════════════════════════════════════════

function narrativePrompt(prompt, pmPackage, context, histCtx) {
  return `Generate foundation PM documents for this project:

"${prompt}"${context}${histCtx}

PM Package: ${pmPackage || 'lean'}

Return this exact JSON with domain-specific content — no generic placeholders:

{
  "intakeSummary": {
    "understood": "1-2 sentence domain-specific summary",
    "businessProblem": "The exact operational problem being solved",
    "primaryUsers": ["Role 1", "Role 2"],
    "secondaryUsers": ["Role 3"],
    "currentProcess": "The specific manual process being replaced — name the actual system/tool",
    "mainOutcome": "Primary measurable improvement"
  },
  "problemStatement": {
    "currentState": "Detailed current state description",
    "painPoints": ["Specific pain point 1", "Pain point 2", "Pain point 3"],
    "rootCauses": ["Root cause 1", "Root cause 2"],
    "impactedUsers": ["Role 1", "Role 2"],
    "businessImpact": "Quantified impact — time, cost, risk, or quality",
    "proposedSolution": "High-level solution summary",
    "outOfScope": ["What we are NOT solving in this release"]
  },
  "productBrief": {
    "objective": "Single clear sentence",
    "userRoles": [
      { "role": "Role name", "access": "What they can see and do", "estimated": "Approx user count" }
    ],
    "coreWorkflows": ["Primary workflow description", "Secondary workflow or exception path"],
    "businessRules": ["Specific enforceable rule 1", "Rule 2"],
    "successCriteria": ["Measurable outcome 1", "Outcome 2"],
    "assumptions": ["Design assumption 1"],
    "openQuestions": ["Unresolved business decision 1"]
  }
}`
}

function requirementsPrompt(prompt, pmPackage, context, histCtx) {
  return `Generate requirements PM documents for this project:

"${prompt}"${context}${histCtx}

Return this exact JSON with domain-specific content:

{
  "prd": {
    "version": "1.0",
    "status": "Draft",
    "overview": "2-3 sentence executive summary",
    "goals": ["Goal 1 — measurable", "Goal 2"],
    "nonGoals": ["Out-of-scope item 1"],
    "userPersonas": [
      { "name": "Persona name", "role": "Job role", "needs": "Primary need", "painPoints": "Pain this solves" }
    ],
    "functionalRequirements": [
      { "id": "FR-01", "category": "Core Workflow", "requirement": "Domain-specific requirement", "priority": "P0" },
      { "id": "FR-02", "category": "Notifications", "requirement": "Requirement 2", "priority": "P1" },
      { "id": "FR-03", "category": "Access Control", "requirement": "Requirement 3", "priority": "P0" }
    ],
    "nonFunctionalRequirements": [
      { "id": "NFR-01", "category": "Performance", "requirement": "Page load under 2 seconds" },
      { "id": "NFR-02", "category": "Security", "requirement": "Role-based access with audit logging" }
    ],
    "dependencies": ["Dependency 1"],
    "risksAndMitigations": [
      { "risk": "Specific risk", "mitigation": "Mitigation approach", "likelihood": "Medium" }
    ]
  },
  "userStories": {
    "epics": [
      {
        "id": "E-01",
        "title": "Domain-specific epic name",
        "stories": [
          {
            "id": "US-01",
            "title": "Story title",
            "asA": "User role",
            "iWant": "Specific capability",
            "soThat": "Business benefit",
            "acceptanceCriteria": ["Given [context], when [action], then [outcome]"],
            "priority": "P0",
            "estimate": "3"
          }
        ]
      }
    ]
  },
  "successMetrics": {
    "primaryKPIs": [
      { "metric": "Domain-specific metric", "baseline": "Current value", "target": "Target value", "timeline": "3 months post-launch", "measurement": "How measured" }
    ],
    "secondaryMetrics": [
      { "metric": "Secondary metric", "target": "Target", "measurement": "Method" }
    ],
    "leadingIndicators": ["User adoption rate in first 30 days"],
    "laggingIndicators": ["Annual cost savings"],
    "measurementCadence": "Weekly during launch, monthly steady-state",
    "reportingStructure": "Dashboard shared with department heads monthly",
    "successThreshold": "What constitutes a successful launch"
  },
  "qaTestPlan": {
    "scope": "What is in scope for testing",
    "testApproach": "Manual UAT with automation for critical paths",
    "testEnvironments": ["UAT", "Staging"],
    "testCases": [
      { "id": "TC-01", "module": "Core workflow", "testCase": "Happy path test", "preconditions": "Setup needed", "steps": ["Step 1", "Step 2"], "expectedResult": "Expected outcome", "priority": "Critical" },
      { "id": "TC-02", "module": "Access control", "testCase": "Permission validation", "preconditions": "Multiple roles available", "steps": ["Step 1", "Step 2"], "expectedResult": "Correct access", "priority": "Critical" }
    ],
    "regressionCases": ["Re-test core workflow after any change"],
    "exitCriteria": ["All Critical test cases pass", "No P0 defects open", "UAT sign-off from business owner"],
    "defectManagement": "Defects logged in tracking system, triaged by severity"
  }
}`
}

function workflowPrompt(prompt, pmPackage, context, histCtx) {
  return `Generate workflow and system documents for this project:

"${prompt}"${context}${histCtx}

Return this exact JSON with domain-specific content:

{
  "workflowMap": {
    "trigger": "What initiates the workflow",
    "steps": [
      { "step": "Step name", "actor": "Role", "action": "Specific action", "output": "Output produced", "sla": "Time expectation or null" }
    ],
    "decisionPoints": ["Decision: [condition] → [outcome A] or [outcome B]"],
    "exceptionPaths": ["Exception: [when] → [what happens]"]
  },
  "dataModel": {
    "primaryEntity": "Main business object",
    "fields": [
      { "name": "snake_case_name", "label": "Human Label", "type": "text|number|email|date|select|textarea", "required": true, "options": [] }
    ],
    "statusFlow": ["Status 1", "Status 2", "Status 3"],
    "relationships": ["Relationship description"],
    "auditFields": ["created_at", "created_by", "updated_at", "last_action_by"]
  },
  "automationModel": {
    "triggers": [
      { "event": "Trigger event", "condition": "Condition", "action": "Automated action" }
    ],
    "notifications": [
      { "event": "Event", "recipient": "Who", "channel": "Email|Teams|In-app", "template": "Message template" }
    ],
    "escalations": [
      { "condition": "Escalation trigger", "action": "What happens", "recipient": "Who receives it" }
    ],
    "documentGeneration": [],
    "integrations": [
      { "system": "System", "type": "Read|Write|Sync", "purpose": "What data is exchanged" }
    ]
  }
}`
}

function techSpecPrompt(prompt, pmPackage, context, histCtx) {
  return `Generate technical and UX specification documents for this project:

"${prompt}"${context}${histCtx}

Return this exact JSON with domain-specific content:

{
  "technicalArchitecture": {
    "overview": "Architecture summary",
    "components": [
      { "name": "Component", "type": "Frontend|Backend|Database|Integration|External", "description": "What it does", "technology": "Tech stack" }
    ],
    "dataFlow": [
      { "step": 1, "from": "Component A", "to": "Component B", "description": "What moves", "protocol": "HTTP|API|File" }
    ],
    "integrations": [
      { "system": "System", "type": "REST|SOAP|File|DB|OAuth", "direction": "Inbound|Outbound|Bidirectional", "frequency": "Real-time|Batch|On-demand" }
    ],
    "infrastructure": { "hosting": "Cloud|On-premise|Hybrid", "platform": "Platform", "scalability": "Scaling approach", "availability": "SLA target" },
    "securityArchitecture": ["Security consideration 1"],
    "diagramDescription": "Narrative description of the architecture"
  },
  "integrationSpec": {
    "integrations": [
      {
        "id": "INT-01",
        "system": "System name",
        "type": "REST API|SOAP|File|Database|OAuth",
        "direction": "Inbound|Outbound|Bidirectional",
        "purpose": "What this integration does",
        "endpoints": [
          { "method": "POST", "endpoint": "/api/path", "description": "What it does", "authentication": "API Key|OAuth|Basic" }
        ],
        "dataMapping": [
          { "sourceField": "Source field", "targetField": "Target field", "transformation": "Transformation if any" }
        ],
        "errorHandling": "Retry with exponential backoff",
        "frequency": "Real-time|Scheduled|On-demand",
        "sla": "Response time requirement"
      }
    ]
  },
  "uxRecommendation": {
    "layoutType": "split_panel_review|queue_detail|kanban_board|table_admin|wizard_flow|workflow_pipeline|command_center|timeline_view|form_first_admin|document_workspace|calendar_scheduler",
    "navigationModel": "Single page|Tabbed|Sidebar nav|Wizard steps",
    "primaryScreens": [
      { "screen": "Screen name", "purpose": "What users accomplish", "keyActions": ["Action 1", "Action 2"] }
    ],
    "visualTheme": {
      "mood": "authoritative|warm|operational|technical|clinical|compliance",
      "primaryColor": "#hexcode",
      "colorName": "Descriptive color name",
      "rationale": "Why this visual direction fits"
    },
    "rationale": "Why this layout fits the workflow"
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
      "light": "#hexcode",
      "text": "#hexcode"
    },
    "features": ["Feature 1", "Feature 2", "Feature 3"],
    "fields": [
      { "name": "snake_case", "label": "Domain label", "type": "text|number|email|date|select|textarea", "required": true, "options": [] }
    ],
    "statusFlow": ["Status 1", "Status 2", "Status 3"],
    "primaryActionLabel": "Action verb + noun",
    "integrations": {
      "sharepoint": { "enabled": false, "reason": "" },
      "outlook": { "enabled": false, "toField": null, "subject": null, "reason": "" },
      "teams": { "enabled": false, "messageTemplate": null, "reason": "" },
      "documentGeneration": { "enabled": false, "templateDescription": null, "deliveryField": null, "reason": "" }
    },
    "roles": []
  }
}`
}

function financialPrompt(prompt, pmPackage, context, histCtx) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `Generate financial and governance documents for this enterprise project:

"${prompt}"${context}${histCtx}

Return this exact JSON:

{
  "businessCase": {
    "executiveSummary": "3-4 sentence justification for business decision-makers",
    "problemStatement": "Business problem with quantified impact",
    "proposedSolution": "What is being built",
    "strategicAlignment": ["Strategic goal this supports 1"],
    "financialSummary": {
      "investmentRequired": "Estimated investment range",
      "expectedSavings": "Annual savings or value created",
      "paybackPeriod": "Estimated months to ROI",
      "roi": "Estimated ROI %"
    },
    "benefits": [
      { "type": "Quantitative", "benefit": "Specific measurable benefit", "value": "Estimated annual value" },
      { "type": "Qualitative", "benefit": "Non-quantifiable benefit", "value": "Impact description" }
    ],
    "alternatives": [
      { "option": "Alternative considered", "reason": "Why it was rejected" }
    ],
    "recommendation": "Clear recommendation statement"
  },
  "costBreakdown": {
    "categories": [
      {
        "category": "Development",
        "items": [
          { "item": "Line item", "description": "What this covers", "unit": "Hours", "quantity": 40, "unitCost": 150, "total": 6000, "notes": "" }
        ]
      },
      {
        "category": "Infrastructure & Licensing",
        "items": [
          { "item": "Item name", "description": "Description", "unit": "Month", "quantity": 12, "unitCost": 200, "total": 2400, "notes": "" }
        ]
      }
    ],
    "totalCapex": 6000,
    "totalOpex": 2400,
    "grandTotal": 8400,
    "currency": "USD",
    "assumptions": ["Cost assumption 1"]
  },
  "roiAnalysis": {
    "timeframe": "24 months",
    "currentCosts": [
      { "item": "Manual process cost", "annualCost": 50000, "description": "How this cost is estimated" }
    ],
    "projectedSavings": [
      { "item": "Saving category", "annualSaving": 30000, "description": "How this saving is achieved", "confidence": "High" }
    ],
    "implementationCost": 8400,
    "ongoingCost": 2400,
    "netBenefit": 81600,
    "roi": "868%",
    "paybackPeriod": "5 months",
    "sensitivity": [
      { "scenario": "Best Case", "roi": "1200%", "payback": "3 months" },
      { "scenario": "Base Case", "roi": "868%", "payback": "5 months" },
      { "scenario": "Worst Case", "roi": "400%", "payback": "9 months" }
    ]
  },
  "permissionsMatrix": {
    "roles": [
      { "role": "Role name", "description": "Who holds this role", "userCount": "Approx count" }
    ],
    "features": [
      { "feature": "Core Feature", "permissions": {} }
    ],
    "dataAccess": [
      { "dataType": "Data object", "access": {} }
    ],
    "specialPermissions": [
      { "permission": "Special permission", "roles": ["Role 1"], "notes": "When and why" }
    ]
  },
  "stakeholderSignoff": {
    "projectName": "Project name from context",
    "version": "1.0",
    "date": "${today}",
    "approvers": [
      { "name": "Business Owner role", "title": "Job title", "department": "Department", "signoffScope": "Business requirements", "status": "Pending", "comments": "", "date": "" },
      { "name": "IT Lead role", "title": "Job title", "department": "IT", "signoffScope": "Technical feasibility", "status": "Pending", "comments": "", "date": "" }
    ],
    "reviewers": [
      { "name": "Key stakeholder role", "department": "Department", "reviewScope": "Domain-specific review scope" }
    ],
    "changeLog": [
      { "version": "1.0", "date": "${today}", "author": "Aria PM", "changes": "Initial draft generated from requirements" }
    ],
    "approvalNotes": "This document requires sign-off from all listed approvers before development begins."
  }
}`
}

function compliancePrompt(prompt, pmPackage, context, histCtx) {
  const isFullLifecycle = pmPackage === 'full_lifecycle'
  return `Generate compliance and lifecycle documents for this enterprise project:

"${prompt}"${context}${histCtx}

PM Package: ${pmPackage}

Return this exact JSON:

{
  "legalCompliance": {
    "applicableRegulations": [
      { "regulation": "GDPR|HIPAA|SOX|CCPA — whichever applies", "applicability": "Why it applies", "requirements": ["Specific requirement"] }
    ],
    "dataClassification": "Internal|Confidential|Restricted",
    "privacyConsiderations": ["Privacy consideration relevant to this domain"],
    "auditRequirements": ["Audit trail requirement 1"],
    "complianceChecklist": [
      { "item": "Compliance item", "status": "Required", "owner": "Responsible role", "notes": "" }
    ],
    "approvals": [
      { "approver": "Legal/Compliance role", "type": "Required", "status": "Pending" }
    ]
  },
  "dataSecurity": {
    "dataInventory": [
      { "dataType": "Data type handled", "sensitivity": "High|Medium|Low", "storage": "Where stored", "access": "Who can access" }
    ],
    "accessControls": [
      { "role": "User role", "permissions": ["Permission 1"], "restrictions": "What they cannot access" }
    ],
    "encryptionRequirements": ["Data at rest encrypted", "Data in transit via TLS 1.2+"],
    "auditLogging": ["All data access logged", "Status changes tracked with user and timestamp"],
    "securityControls": [
      { "control": "Control name", "description": "What it does", "required": true }
    ],
    "incidentResponse": "Domain-appropriate incident response procedure",
    "complianceNotes": ["Compliance note relevant to this domain"]
  }${isFullLifecycle ? `,
  "currentStateWorkflow": {
    "title": "As-Is Process",
    "description": "Current state overview",
    "actors": ["Actor 1", "Actor 2"],
    "steps": [
      { "step": 1, "actor": "Actor", "action": "Current manual action", "tool": "System or tool used today", "painPoint": "What is painful", "timeSpent": "~X minutes" }
    ],
    "painPoints": ["Overall process pain point"],
    "bottlenecks": ["Where the process regularly stalls"],
    "totalTime": "Estimated total cycle time",
    "errorRate": "Estimated rework or error rate"
  },
  "futureStateWorkflow": {
    "title": "To-Be Process",
    "description": "Future state with the new system",
    "actors": ["Actor 1", "Actor 2"],
    "steps": [
      { "step": 1, "actor": "Actor", "action": "New action in the system", "tool": "New system", "automated": false, "improvement": "What is better" }
    ],
    "improvements": ["Key improvement from automation"],
    "timeReduction": "Estimated time saved per transaction",
    "automatedSteps": ["Step that is now automated"],
    "integrationPoints": ["Where systems connect automatically"]
  },
  "launchPlan": {
    "launchType": "Phased",
    "timeline": [
      { "milestone": "Development Complete", "date": "Week 4", "owner": "Engineering Lead", "dependencies": ["Requirements signed off"], "status": "Planned" },
      { "milestone": "UAT Sign-off", "date": "Week 6", "owner": "Business Owner", "dependencies": ["UAT complete"], "status": "Planned" },
      { "milestone": "Full Launch", "date": "Week 9", "owner": "PM", "dependencies": ["Pilot success criteria met"], "status": "Planned" }
    ],
    "pilotGroups": [
      { "group": "Pilot user group", "size": "10-15 users", "criteria": "Why selected for pilot", "startDate": "Week 7" }
    ],
    "communicationPlan": [
      { "audience": "All users", "message": "Announcement of new system", "channel": "Email", "timing": "2 weeks before launch" }
    ],
    "trainingPlan": [
      { "audience": "End users", "type": "Self-serve video + job aid", "duration": "30 minutes", "materials": "Quick-start guide" }
    ],
    "rollbackPlan": "Maintain parallel operation of existing process for 2 weeks post-launch",
    "successCriteria": "80% of transactions processed through new system within 30 days",
    "goLiveChecklist": ["UAT sign-off complete", "All user accounts provisioned", "Training materials published"]
  }` : ',\n  "currentStateWorkflow": null,\n  "futureStateWorkflow": null,\n  "launchPlan": null'}
}`
}

// ═══════════════════════════════════════════════════════════════════════════
// Stage maps — frontend contracts; preserved verbatim.
// ═══════════════════════════════════════════════════════════════════════════

const CORE_STAGE_MAP = [
  { type: 'intake_summary',     key: 'intakeSummary',        label: 'Intake Summary' },
  { type: 'problem_statement',  key: 'problemStatement',     label: 'Problem Statement' },
  { type: 'product_brief',      key: 'productBrief',         label: 'Product Brief' },
  { type: 'prd',                key: 'prd',                  label: 'Product Requirements Document' },
  { type: 'user_stories',       key: 'userStories',          label: 'User Stories & Acceptance Criteria' },
  { type: 'success_metrics',    key: 'successMetrics',       label: 'Success Metrics & KPIs' },
  { type: 'qa_test_plan',       key: 'qaTestPlan',           label: 'QA & Test Plan' },
]

const SYSTEM_STAGE_MAP = [
  { type: 'workflow_map',           key: 'workflowMap',          label: 'Workflow Map' },
  { type: 'data_model',             key: 'dataModel',            label: 'Data Model' },
  { type: 'automation_model',       key: 'automationModel',      label: 'Automation Model' },
  { type: 'technical_architecture', key: 'technicalArchitecture', label: 'Technical Architecture' },
  { type: 'integration_spec',       key: 'integrationSpec',      label: 'Integration Spec' },
  { type: 'ux_recommendation',      key: 'uxRecommendation',     label: 'UX Recommendation' },
  { type: 'app_spec',               key: 'appSpec',              label: 'App Spec' },
]

const BUSINESS_STAGE_MAP = [
  { type: 'business_case',          key: 'businessCase',          label: 'Business Case' },
  { type: 'cost_breakdown',         key: 'costBreakdown',         label: 'Cost Breakdown' },
  { type: 'roi_analysis',           key: 'roiAnalysis',           label: 'ROI & Savings Analysis' },
  { type: 'legal_compliance',       key: 'legalCompliance',       label: 'Legal & Compliance Checklist' },
  { type: 'data_security',          key: 'dataSecurity',          label: 'Data Privacy & Security' },
  { type: 'permissions_matrix',     key: 'permissionsMatrix',     label: 'Permissions & Role Access Matrix' },
  { type: 'current_state_workflow', key: 'currentStateWorkflow',  label: 'Current State Workflow' },
  { type: 'future_state_workflow',  key: 'futureStateWorkflow',   label: 'Future State Workflow' },
  { type: 'launch_plan',            key: 'launchPlan',            label: 'Launch & Rollout Plan' },
  { type: 'stakeholder_signoff',    key: 'stakeholderSignoff',    label: 'Stakeholder Sign-off' },
]

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function normalizeAppSpec(appSpec) {
  if (!appSpec) return
  const validTypes = ['approval_workflow', 'intake_tracker', 'status_board']
  if (!validTypes.includes(appSpec.workflowType)) {
    const wf = (appSpec.workflowType || '').toLowerCase()
    appSpec.workflowType = /approv|review/.test(wf) ? 'approval_workflow'
      : /intake|ticket/.test(wf)                    ? 'intake_tracker'
      :                                               'status_board'
  }
  if (appSpec.fields) {
    appSpec.fields = appSpec.fields.map(f => ({
      ...f,
      name: f.name || (f.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    }))
  }
}

async function persistArtifacts(brief, { conversationId, userId, prompt, pmPackage }) {
  const appTitle = brief.appSpec?.appTitle
    || brief.intakeSummary?.understood?.split(' ').slice(0, 3).join(' ')
    || 'PM Project'
  const ALL_STAGES = [...CORE_STAGE_MAP, ...SYSTEM_STAGE_MAP, ...BUSINESS_STAGE_MAP]
  const artifactIds = {}
  const created = []
  for (const stage of ALL_STAGES) {
    const content = brief[stage.key]
    if (!content) continue
    const { data: artifact, error } = await supabase.from('artifacts').insert({
      conversation_id: conversationId,
      user_id: userId,
      artifact_type: stage.type,
      title: `${appTitle} — ${stage.label}`,
      content,
      source_prompt: prompt,
      version: 1,
      status: 'draft',
      file_urls: {},
      metadata: { pmPackage: pmPackage || 'lean' },
    }).select().single()
    if (!error && artifact) {
      artifactIds[stage.type] = artifact.id
      created.push(artifact)
    }
  }
  return { artifactIds, created }
}

function fireForgetFileGen(artifacts) {
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

// ═══════════════════════════════════════════════════════════════════════════
// Handler
// ═══════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationId, pmPackage, clarificationAnswers, conversationHistory, aiModel, roleContext } = req.body
  if (!prompt || !conversationId) return res.status(400).json({ error: 'Missing fields: prompt, conversationId' })
  const rolePreface = buildRoleContextPrompt(roleContext)
  const pmSystem = rolePreface ? `${PM_BRIEF}\n\n${rolePreface}` : PM_BRIEF

  const isEnterprise = ['enterprise', 'full_lifecycle'].includes(pmPackage)

  const orch = createOrchestrator({
    workflow: 'pm_brief',
    aiModel,
    traceContext: { conversationId, pmPackage: pmPackage || 'lean', isEnterprise },
  })

  try {
    const context = buildAnswersContext(clarificationAnswers)
    const histCtx = buildHistoryContext(conversationHistory, 4)

    // Define each stage-group as { span, tier, maxTokens, build }
    const stages = [
      { span: 'narrative',     tier: 'fast',     maxTokens: 3000, build: narrativePrompt },
      { span: 'requirements',  tier: 'smart',    maxTokens: 6000, build: requirementsPrompt },
      { span: 'workflow',      tier: 'balanced', maxTokens: 4000, build: workflowPrompt },
      { span: 'tech_spec',     tier: 'fast',     maxTokens: 5000, build: techSpecPrompt },
    ]
    if (isEnterprise) {
      stages.push({ span: 'financial',  tier: 'smart',    maxTokens: 5000, build: financialPrompt })
      stages.push({ span: 'compliance', tier: 'balanced', maxTokens: 5000, build: compliancePrompt })
    }

    // Run all stages in parallel through the same orchestrator (separate spans)
    const partials = await Promise.all(stages.map(s => orch.json(s.span, {
      tier: s.tier,
      maxTokens: s.maxTokens,
      system: pmSystem,
      prompt: s.build(prompt, pmPackage, context, histCtx),
    })))

    // Merge all stage groups into a single brief object
    const brief = Object.assign({}, ...partials)
    normalizeAppSpec(brief.appSpec)

    // Resolve user for artifact ownership
    const { data: conv } = await supabase.from('conversations').select('user_id').eq('id', conversationId).single()
    const userId = conv?.user_id || null

    // Persist artifacts (one per non-null stage)
    const { artifactIds, created } = await persistArtifacts(brief, { conversationId, userId, prompt, pmPackage })

    // Persist enterprise_brief message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      message_type: 'confirmation',
      metadata: {
        cardType: 'enterprise_brief',
        brief,
        buildMode: 'product_manager',
        pmPackage: pmPackage || 'lean',
        artifactIds,
        traceId: orch.traceId,
      },
    })

    fireForgetFileGen(created)

    orch.end({
      pmPackage: pmPackage || 'lean',
      stageGroupCount: stages.length,
      artifactCount: created.length,
    })
    devlog('pm_brief.generated', { conversationId, pmPackage, traceId: orch.traceId })

    return res.json({
      brief,
      buildMode: 'product_manager',
      pmPackage: pmPackage || 'lean',
      artifactIds,
      traceId: orch.traceId,
    })
  } catch (err) {
    devlogError('pm_brief.generation_failed', { conversationId, error: err.message })
    return respondWithError(res, err, orch)
  }
}

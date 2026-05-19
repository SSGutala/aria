/**
 * Workflow / Approval System task mode.
 * Emphasizes: approval chain, SLAs, escalations, decision logic.
 */
export default {
  label: 'Workflow / Approval System',
  modelTier: 'smart',
  maxTokens: 6000,
  system: `You are Aria — a senior workflow architect who has built hundreds of enterprise approval and routing systems.
You think in multi-stage approval chains, SLA timers with escalation paths, threshold-based routing, and exception handling.
Use domain-specific approver roles, named thresholds, and concrete escalation actions — never generic placeholders.
CRITICAL: Your entire response must be a single valid JSON object. Start with { and end with }. No markdown.`,

  stageMap: [
    { type: 'intake_summary',     key: 'intakeSummary',     label: 'Intake Summary' },
    { type: 'approval_chain',     key: 'approvalChain',     label: 'Approval Chain' },
    { type: 'sla_matrix',         key: 'slaMatrix',         label: 'SLA Matrix' },
    { type: 'escalation_rules',   key: 'escalationRules',   label: 'Escalation Rules' },
    { type: 'decision_logic',     key: 'decisionLogic',     label: 'Decision & Routing Logic' },
    { type: 'workflow_map',       key: 'workflowMap',       label: 'Workflow Map' },
    { type: 'app_spec',           key: 'appSpec',           label: 'App Spec' },
  ],

  buildPrompt(prompt, answersBlock, historyBlock) {
    return `A user wants to build this workflow / approval system: "${prompt}"${answersBlock}${historyBlock}

Generate a complete workflow brief. Focus on approval chain, SLAs, escalations, and decision logic.

Return this exact JSON with domain-specific content:

{
  "intakeSummary": {
    "understood": "1-2 sentence summary of what's being approved/routed",
    "requestType": "What gets submitted — e.g. Purchase Request, PTO, Access Request",
    "primaryUsers": ["Requester role", "Approver roles", "Auditor role"],
    "currentProcess": "How approvals happen today — email chain, spreadsheet, paper form",
    "volume": "Approximate request volume per period",
    "mainOutcome": "Cycle-time or quality improvement expected"
  },
  "approvalChain": {
    "stages": [
      {
        "id": "STG-01",
        "name": "Stage name — e.g. Manager Approval, Compliance Review",
        "approverRole": "Specific role — not 'Reviewer'",
        "approverScope": "Same team|Cost center|Department head|Any of N",
        "requiredApprovals": "1|All|N of M",
        "criteria": "What this approver evaluates",
        "canDelegate": true,
        "canSendBack": true
      }
    ],
    "parallelStages": [
      { "stages": ["STG-02", "STG-03"], "reason": "Why these run in parallel" }
    ],
    "skipRules": [
      { "stage": "STG-02", "condition": "Skip when amount < $1000 AND department = HR", "reason": "Why this skip exists" }
    ],
    "finalState": "What 'fully approved' triggers — provisioning, payment, notification, system update"
  },
  "slaMatrix": {
    "stages": [
      {
        "stage": "STG-01",
        "businessHoursSla": "24 hours",
        "calendarHoursSla": null,
        "startsAt": "Stage assignment timestamp",
        "pausesOn": ["Sent back for clarification", "Requester out of office"],
        "warningAt": "75% of SLA elapsed",
        "breachAt": "100% of SLA elapsed"
      }
    ],
    "overallSla": "End-to-end target — e.g. '3 business days from submission to final decision'",
    "businessCalendar": "Which calendar applies — corporate holidays, regional",
    "outOfOfficeHandling": "How approver OOO affects SLA — auto-delegate, pause clock, escalate"
  },
  "escalationRules": {
    "rules": [
      {
        "id": "ESC-01",
        "trigger": "Stage X breached SLA",
        "level1Action": "Notify approver + manager",
        "level1Sla": "Additional 4 hours",
        "level2Action": "Reassign to delegate or skip-level approver",
        "level2Sla": "Additional 8 hours",
        "level3Action": "Auto-approve|Auto-reject|Page on-call",
        "notifiedRoles": ["Role 1", "Role 2"]
      }
    ],
    "vipBypass": [
      { "condition": "CEO submitter|Critical incident", "behavior": "Direct route to final approver", "auditNote": "VIP bypass is logged" }
    ],
    "weekendHolidayBehavior": "Pause clock|Continue|Escalate to weekend approver pool"
  },
  "decisionLogic": {
    "routingRules": [
      {
        "id": "RTE-01",
        "name": "Routing rule name",
        "predicate": "Domain predicate — e.g. 'amount > $25000 OR vendor not on approved list'",
        "routeTo": "Specific approver role or stage",
        "priority": "Order if multiple rules match",
        "rationale": "Why this rule exists"
      }
    ],
    "thresholds": [
      { "name": "Threshold name", "rule": "e.g. 'spend > $50k requires VP approval'", "approver": "Role", "documentationRequired": ["What attachments must be provided"] }
    ],
    "rejectionPaths": [
      { "stage": "Stage", "rejectionReasons": ["Reason 1", "Reason 2"], "resubmitAllowed": true, "resubmitCooldown": "Time before requester can resubmit" }
    ],
    "auditTrail": ["Every decision logged with timestamp, actor, comments", "Field-level change tracking on resubmission"]
  },
  "workflowMap": {
    "trigger": "What initiates the workflow",
    "steps": [
      { "step": "Step name", "actor": "Role", "action": "What they do", "output": "What is produced", "sla": "Time or null" }
    ],
    "decisionPoints": ["Decision: [condition] → [outcome A] or [outcome B]"],
    "exceptionPaths": ["Exception: [when] → [what happens]"]
  },
  "appSpec": {
    "appTitle": "2-4 word workflow name",
    "appType": "Approval Workflow",
    "tagline": "One line — what is being approved",
    "purpose": "2-3 sentences on the problem and replacement",
    "workflowType": "approval_workflow",
    "layoutType": "workflow_pipeline",
    "colorTheme": { "name": "color name", "primary": "#hex", "light": "#hex", "text": "#hex" },
    "features": ["Feature 1", "Feature 2", "Feature 3"],
    "fields": [{ "name": "snake_case", "label": "Label", "type": "text", "required": true, "options": [] }],
    "statusFlow": ["Submitted", "In Review", "Approved", "Rejected"],
    "primaryActionLabel": "Submit Request",
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
- approvalChain.stages must have 2-5 named stages with specific approver roles (not 'Approver')
- slaMatrix.stages must have concrete time values, not 'TBD' or 'fast'
- escalationRules.rules must have 1-3 rules with specific level 1/2/3 actions
- decisionLogic.routingRules must have 2-4 rules with real predicates (amount thresholds, dept gates, etc.)`
  },
}

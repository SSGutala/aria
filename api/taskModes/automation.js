/**
 * Automation Flow task mode.
 * Emphasizes: triggers, conditions, actions, error handling, notifications.
 */
export default {
  label: 'Automation Flow',
  modelTier: 'smart',
  maxTokens: 6000,
  system: `You are Aria — a senior automation architect who has built hundreds of business-process automations (Zapier, Power Automate, Make, n8n, custom).
You think in event triggers, branching conditions, action chains, retry policies, and exception/notification routing.
Use domain-specific event names, condition predicates, and action verbs — never generic placeholders.
CRITICAL: Your entire response must be a single valid JSON object. Start with { and end with }. No markdown.`,

  stageMap: [
    { type: 'intake_summary',     key: 'intakeSummary',     label: 'Intake Summary' },
    { type: 'trigger_catalog',    key: 'triggerCatalog',    label: 'Trigger Catalog' },
    { type: 'condition_logic',    key: 'conditionLogic',    label: 'Condition Logic' },
    { type: 'action_chain',       key: 'actionChain',       label: 'Action Chain' },
    { type: 'error_handling',     key: 'errorHandling',     label: 'Error Handling & Retries' },
    { type: 'notification_plan',  key: 'notificationPlan',  label: 'Notification Plan' },
    { type: 'app_spec',           key: 'appSpec',           label: 'App Spec' },
  ],

  buildPrompt(prompt, answersBlock, historyBlock) {
    return `A user wants to build this automation flow: "${prompt}"${answersBlock}${historyBlock}

Generate a complete automation-flow brief. Focus on event triggers, branching logic, action chains, and exception handling.

Return this exact JSON with domain-specific content:

{
  "intakeSummary": {
    "understood": "1-2 sentence summary of the automation's purpose",
    "businessProblem": "The repetitive manual work this eliminates",
    "currentProcess": "How this is done today (system, frequency, who does it)",
    "frequency": "How often this automation will fire — e.g. 'every new ticket', '~50/day'",
    "mainOutcome": "Time saved or quality improvement expected"
  },
  "triggerCatalog": {
    "primaryTrigger": {
      "name": "Trigger event name",
      "source": "System that emits the event — e.g. ServiceNow, SharePoint, Outlook, Webhook",
      "eventType": "Record created|Record updated|Scheduled|Webhook|Email received|File added",
      "frequency": "Expected fire rate — e.g. '~10/day'",
      "payloadShape": { "field": "type — example" }
    },
    "secondaryTriggers": [
      { "name": "Trigger name", "source": "System", "purpose": "When and why this fires", "interaction": "How it relates to the primary trigger" }
    ],
    "schedules": [
      { "name": "Scheduled job name", "cron": "Cron expression or human description", "purpose": "What this scheduled run does" }
    ]
  },
  "conditionLogic": {
    "branches": [
      {
        "name": "Branch name describing the condition",
        "condition": "Plain-language predicate — e.g. 'amount > $5000 AND department = Engineering'",
        "matches": "What proceeds down this branch",
        "actionRef": "ACT-XX — id of the action chain that runs",
        "elseAction": "What happens if no branch matches"
      }
    ],
    "filters": [
      { "name": "Filter name", "rule": "Records that must be excluded — e.g. 'skip test records'", "reason": "Why this filter exists" }
    ],
    "deduplication": "How duplicate triggers are detected and handled"
  },
  "actionChain": {
    "actions": [
      {
        "id": "ACT-01",
        "name": "Action name",
        "type": "API call|Email|Update record|Create record|Wait|HTTP webhook|Run script",
        "target": "System or service hit",
        "inputs": "What is passed in (from trigger payload or prior step output)",
        "outputs": "What this step produces for downstream steps",
        "dependsOn": ["ACT-00 if applicable"],
        "timeoutSec": 30
      }
    ],
    "executionMode": "Sequential|Parallel where possible",
    "transactional": "Whether the chain rolls back on failure or commits step-by-step"
  },
  "errorHandling": {
    "retryPolicy": {
      "strategy": "Exponential backoff|Fixed interval|None",
      "maxAttempts": 3,
      "baseDelaySec": 5,
      "retryableErrors": ["429", "5xx", "timeout"],
      "nonRetryableErrors": ["400 validation", "401 auth"]
    },
    "deadLetterQueue": "Where failed events land for review",
    "alertingRules": [
      { "condition": "When this fires", "alertTo": "Role or channel", "severity": "P1|P2|P3", "message": "What the alert says" }
    ],
    "rollbackProcedure": "How partial state is cleaned up on chain failure",
    "monitoring": ["Metric or log to watch", "Dashboard or query to use"]
  },
  "notificationPlan": {
    "successNotifications": [
      { "event": "Chain completed successfully", "recipient": "Role", "channel": "Email|Teams|Slack|In-app", "template": "Summary of what happened", "rateLimit": "Throttle rule if any" }
    ],
    "failureNotifications": [
      { "event": "Chain failed after retries", "recipient": "Role", "channel": "Email|Teams|Slack|PagerDuty", "template": "Failure context + remediation steps", "severity": "P1|P2|P3" }
    ],
    "digests": [
      { "name": "Daily digest", "audience": "Role", "cadence": "Daily|Weekly", "content": "What it summarizes" }
    ]
  },
  "appSpec": {
    "appTitle": "2-4 word automation name",
    "appType": "Automation Flow",
    "tagline": "One line — what it automates and who benefits",
    "purpose": "2-3 sentences on what manual work is replaced",
    "workflowType": "approval_workflow|intake_tracker|status_board",
    "layoutType": "command_center",
    "colorTheme": { "name": "color name", "primary": "#hex", "light": "#hex", "text": "#hex" },
    "features": ["Feature 1", "Feature 2", "Feature 3"],
    "fields": [{ "name": "snake_case", "label": "Label", "type": "text", "required": true, "options": [] }],
    "statusFlow": ["Triggered", "Processing", "Completed", "Failed"],
    "primaryActionLabel": "Run Now",
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
- triggerCatalog.primaryTrigger.payloadShape must include 3-6 real fields from the domain
- conditionLogic.branches must have 2-4 named branches with concrete predicates, not 'if condition then action'
- actionChain.actions must have 4-8 sequenced steps with real targets (named systems, not 'External API')
- errorHandling.alertingRules must name specific roles/channels and severity levels`
  },
}

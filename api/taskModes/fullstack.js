/**
 * Full-Stack App task mode.
 * Emphasizes: data model, user roles, API contracts, authentication, integrations.
 */
export default {
  label: 'Full-Stack App',
  modelTier: 'smart',
  maxTokens: 6500,
  system: `You are Aria — a senior full-stack architect who has shipped 50+ enterprise web apps.
You think in entities, relationships, role-based access, REST/GraphQL contracts, and integration boundaries.
Use domain-specific language for entities, fields, endpoints, and auth scopes — never generic placeholders.
CRITICAL: Your entire response must be a single valid JSON object. Start with { and end with }. No markdown.`,

  stageMap: [
    { type: 'intake_summary',         key: 'intakeSummary',        label: 'Intake Summary' },
    { type: 'product_brief',          key: 'productBrief',         label: 'Product Brief' },
    { type: 'data_model',             key: 'dataModel',            label: 'Data Model' },
    { type: 'api_contracts',          key: 'apiContracts',         label: 'API Contracts' },
    { type: 'auth_model',             key: 'authModel',            label: 'Authentication & Authorization' },
    { type: 'integration_spec',       key: 'integrationSpec',      label: 'Integration Spec' },
    { type: 'ux_recommendation',      key: 'uxRecommendation',     label: 'UX Recommendation' },
    { type: 'app_spec',               key: 'appSpec',              label: 'App Spec' },
  ],

  buildPrompt(prompt, answersBlock, historyBlock) {
    return `A user wants to build this full-stack enterprise app: "${prompt}"${answersBlock}${historyBlock}

Generate a complete full-stack architecture brief. Focus on data model rigor, role-based access, and API surface area.

Return this exact JSON with domain-specific content:

{
  "intakeSummary": {
    "understood": "1-2 sentence summary of the app and its primary purpose",
    "businessProblem": "The concrete operational problem this app solves",
    "primaryUsers": ["Role 1", "Role 2"],
    "secondaryUsers": ["Role 3"],
    "currentProcess": "The specific manual process or tool being replaced",
    "mainOutcome": "Primary measurable improvement"
  },
  "productBrief": {
    "objective": "Single clear sentence",
    "userRoles": [
      { "role": "Role name", "access": "What they can see and do", "estimated": "User count" }
    ],
    "coreWorkflows": ["Primary user journey", "Secondary journey"],
    "successCriteria": ["Measurable outcome 1", "Outcome 2"]
  },
  "dataModel": {
    "primaryEntity": "Main business entity",
    "entities": [
      {
        "name": "EntityName",
        "description": "What this entity represents",
        "fields": [
          { "name": "snake_case", "label": "Label", "type": "text|number|email|date|select|textarea|reference", "required": true, "options": [], "references": null }
        ]
      }
    ],
    "relationships": [
      { "from": "EntityA", "to": "EntityB", "type": "one-to-many|many-to-many|one-to-one", "description": "What this relationship represents" }
    ],
    "statusFlow": ["Domain-specific status 1", "Status 2", "Status 3"],
    "auditFields": ["created_at", "created_by", "updated_at", "last_action_by"]
  },
  "apiContracts": {
    "baseUrl": "/api/v1",
    "authentication": "JWT|Session|OAuth2|API Key",
    "endpoints": [
      {
        "method": "POST|GET|PUT|PATCH|DELETE",
        "path": "/resource",
        "purpose": "What this endpoint does",
        "authScope": "Required role or scope",
        "requestSchema": { "field": "type" },
        "responseSchema": { "field": "type" },
        "errorCodes": ["400 — invalid input", "403 — wrong role", "404 — not found"]
      }
    ],
    "rateLimits": "Rate-limit policy",
    "versioning": "Versioning strategy"
  },
  "authModel": {
    "authProvider": "Internal|Auth0|Azure AD|Okta|Google",
    "sessionStrategy": "JWT|Cookie|OAuth refresh",
    "passwordPolicy": "MFA required|Length|Rotation",
    "roles": [
      { "role": "Role name", "permissions": ["resource:action"], "inheritance": "Parent role or null" }
    ],
    "permissions": [
      { "resource": "Resource name", "actions": ["read", "write", "delete", "approve"], "scopedBy": "user|team|org" }
    ],
    "rowLevelSecurity": ["Rule: users can only see their own records", "Managers can see their team"],
    "auditLogging": ["Login events", "Permission changes", "Data modifications"]
  },
  "integrationSpec": {
    "integrations": [
      {
        "system": "External system",
        "type": "REST|GraphQL|Webhook|SAML|OAuth",
        "direction": "Inbound|Outbound|Bidirectional",
        "purpose": "What data is exchanged",
        "authMethod": "API Key|OAuth|Basic",
        "frequency": "Real-time|Scheduled|On-demand"
      }
    ]
  },
  "uxRecommendation": {
    "layoutType": "split_panel_review|queue_detail|kanban_board|table_admin|wizard_flow|workflow_pipeline|command_center|timeline_view|form_first_admin|document_workspace|calendar_scheduler",
    "navigationModel": "Sidebar|Tabbed|Wizard|Single-page",
    "primaryScreens": [
      { "screen": "Screen name", "purpose": "What users accomplish", "keyActions": ["Action 1", "Action 2"] }
    ],
    "visualTheme": {
      "mood": "authoritative|warm|operational|technical|clinical|compliance",
      "primaryColor": "#hexcode",
      "colorName": "Descriptive name",
      "rationale": "Why this fits"
    },
    "rationale": "Why this layout fits"
  },
  "appSpec": {
    "appTitle": "2-4 word domain-specific name",
    "appType": "Specific type",
    "tagline": "One line — what it does and who benefits",
    "purpose": "2-3 sentences",
    "workflowType": "approval_workflow|intake_tracker|status_board",
    "layoutType": "same as uxRecommendation.layoutType",
    "colorTheme": { "name": "color name", "primary": "#hex", "light": "#hex", "text": "#hex" },
    "features": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],
    "fields": [{ "name": "snake_case", "label": "Label", "type": "text", "required": true, "options": [] }],
    "statusFlow": ["Status 1", "Status 2", "Status 3"],
    "primaryActionLabel": "Verb + noun",
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
- entities array must have 2-5 entities specific to this domain, each with 4-8 fields
- apiContracts.endpoints must have 5-10 real endpoints, each with proper request/response schema
- authModel.roles must reflect the actual user roles named in primaryUsers — not generic admin/user
- Every status, field, and role name must use domain language from the prompt`
  },
}

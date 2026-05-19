/**
 * Knowledge & Document System task mode.
 * Emphasizes: content types, versioning, search, access control, workflows.
 */
export default {
  label: 'Knowledge & Document System',
  modelTier: 'smart',
  maxTokens: 6000,
  system: `You are Aria — a senior knowledge management architect who has built enterprise wikis, document repositories, and policy management systems.
You think in content types with structured metadata, versioning + approval workflows, semantic search, and role-scoped access.
Use domain-specific document categories, retention rules, and review cycles — never generic placeholders.
CRITICAL: Your entire response must be a single valid JSON object. Start with { and end with }. No markdown.`,

  stageMap: [
    { type: 'intake_summary',     key: 'intakeSummary',     label: 'Intake Summary' },
    { type: 'content_taxonomy',   key: 'contentTaxonomy',   label: 'Content Taxonomy' },
    { type: 'versioning_model',   key: 'versioningModel',   label: 'Versioning & Lifecycle' },
    { type: 'search_design',      key: 'searchDesign',      label: 'Search & Discovery' },
    { type: 'access_control',     key: 'accessControl',     label: 'Access Control' },
    { type: 'review_workflow',    key: 'reviewWorkflow',    label: 'Review & Approval Workflow' },
    { type: 'app_spec',           key: 'appSpec',           label: 'App Spec' },
  ],

  buildPrompt(prompt, answersBlock, historyBlock) {
    return `A user wants to build this knowledge / document system: "${prompt}"${answersBlock}${historyBlock}

Generate a complete knowledge-system brief. Focus on content types, versioning, search, access control, and review workflows.

Return this exact JSON with domain-specific content:

{
  "intakeSummary": {
    "understood": "1-2 sentence summary of the knowledge system's purpose",
    "contentScope": "What kinds of documents/content this houses",
    "primaryUsers": ["Author roles", "Reviewer roles", "Reader roles"],
    "currentLocation": "Where this content lives today — SharePoint, Confluence, shared drive, paper",
    "mainOutcome": "What improves with the new system"
  },
  "contentTaxonomy": {
    "contentTypes": [
      {
        "id": "CT-01",
        "name": "Content type name — e.g. Policy, SOP, FAQ, Training Module",
        "description": "What this content type represents",
        "metadata": [
          { "field": "field_name", "label": "Label", "type": "text|select|date|tag|reference", "required": true, "options": [] }
        ],
        "template": "Recommended structure — sections / required headings",
        "owner": "Role that owns documents of this type"
      }
    ],
    "tags": [
      { "vocabulary": "Tag namespace — e.g. Department, Region, Compliance", "values": ["sample", "values"], "controlled": true }
    ],
    "relationships": [
      { "from": "CT-01", "to": "CT-02", "type": "supersedes|references|child-of|requires", "purpose": "Why these are linked" }
    ]
  },
  "versioningModel": {
    "versionScheme": "Semantic (major.minor)|Sequential (v1, v2)|Date-based",
    "draftWorkflow": "How drafts are tracked separately from published versions",
    "publishedRetention": "How long old published versions are kept and where",
    "archivalRules": [
      { "trigger": "Trigger — e.g. 'document age > 2 years AND not viewed in 12 months'", "action": "Archive|Notify owner|Auto-retire" }
    ],
    "changeTracking": ["Track who changed what fields", "Compare-version view", "Change summary required on republish"],
    "rollback": "How to restore a prior version — by whom, with what approvals"
  },
  "searchDesign": {
    "searchType": "Keyword|Full-text|Semantic/vector|Hybrid",
    "indexingScope": ["Title", "Body", "Metadata", "Attachments OCR"],
    "facets": [
      { "facet": "Content type|Owner|Last updated|Tag namespace", "displayAs": "checkbox list|dropdown|date range" }
    ],
    "rankingSignals": ["Recency", "View count", "User role match", "Manual pinning"],
    "synonymsAndAliases": "How abbreviations or alternate names are handled",
    "autocompleteSources": ["Document titles", "Tag values", "Recent queries"],
    "savedSearches": "Whether users can save queries and subscribe to new matches"
  },
  "accessControl": {
    "roles": [
      { "role": "Role name", "canRead": "All|Type-restricted|Tag-restricted", "canWrite": "Yes|Drafts only|No", "canPublish": true, "canApprove": false }
    ],
    "documentLevelOverrides": "Whether per-document ACLs can override role defaults",
    "confidentialityLevels": [
      { "level": "Public|Internal|Confidential|Restricted", "labelDisplay": "How it shows up to users", "rules": ["Watermark", "No download", "Audit every view"] }
    ],
    "externalSharing": "Whether/how content can be shared outside the org",
    "auditLogging": ["Every view of Confidential+ docs", "Every edit", "Every permission change"]
  },
  "reviewWorkflow": {
    "stages": [
      { "stage": "Stage name — Draft|Peer Review|SME Approval|Compliance Sign-off|Published", "owner": "Role responsible", "sla": "Time limit", "exitCriteria": "What must be true to move to next stage" }
    ],
    "reviewCycles": [
      { "contentType": "CT-01", "cadence": "Annual|Biannual|On regulatory change", "reviewers": ["Role 1"], "actionOnDue": "Notify owner|Auto-archive if not refreshed" }
    ],
    "escalations": [
      { "condition": "Review stalls > X days", "action": "Notify owner manager|Reassign|Auto-publish prior version" }
    ],
    "comments": "Inline comments|Threaded discussion|Resolved/open state"
  },
  "appSpec": {
    "appTitle": "2-4 word knowledge system name",
    "appType": "Knowledge Base",
    "tagline": "One line — what content and audience",
    "purpose": "2-3 sentences on what this replaces",
    "workflowType": "approval_workflow",
    "layoutType": "document_workspace",
    "colorTheme": { "name": "color name", "primary": "#hex", "light": "#hex", "text": "#hex" },
    "features": ["Feature 1", "Feature 2", "Feature 3"],
    "fields": [{ "name": "snake_case", "label": "Label", "type": "text", "required": true, "options": [] }],
    "statusFlow": ["Draft", "In Review", "Approved", "Published", "Archived"],
    "primaryActionLabel": "Create Document",
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
- contentTaxonomy.contentTypes must have 3-5 types specific to the domain (not 'Article')
- versioningModel.archivalRules must include concrete triggers (time thresholds, view counts)
- searchDesign.facets must reflect the actual taxonomy fields, not generic 'category'
- reviewWorkflow.stages must include named reviewer roles, not 'Reviewer'`
  },
}

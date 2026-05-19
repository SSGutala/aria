/**
 * Dashboard & Reporting task mode.
 * Emphasizes: KPIs, data sources, refresh rates, drill-down paths, permissions.
 */
export default {
  label: 'Dashboard & Reporting',
  modelTier: 'smart',
  maxTokens: 6000,
  system: `You are Aria — a senior analytics architect who has shipped 50+ enterprise dashboards (Tableau, Power BI, Looker, custom).
You think in KPIs with measurable definitions, data sources with refresh cadence, drill-down paths, and role-scoped access.
Use domain-specific metric names, dimensions, and source systems — never generic placeholders like "Sales" or "Users".
CRITICAL: Your entire response must be a single valid JSON object. Start with { and end with }. No markdown.`,

  stageMap: [
    { type: 'intake_summary',     key: 'intakeSummary',     label: 'Intake Summary' },
    { type: 'kpi_catalog',        key: 'kpiCatalog',        label: 'KPI Catalog' },
    { type: 'data_sources',       key: 'dataSources',       label: 'Data Sources' },
    { type: 'refresh_schedule',   key: 'refreshSchedule',   label: 'Refresh & Latency' },
    { type: 'drilldown_paths',    key: 'drilldownPaths',    label: 'Drill-Down Paths' },
    { type: 'permissions_matrix', key: 'permissionsMatrix', label: 'Access & Permissions' },
    { type: 'app_spec',           key: 'appSpec',           label: 'Dashboard Spec' },
  ],

  buildPrompt(prompt, answersBlock, historyBlock) {
    return `A user wants to build this dashboard / reporting tool: "${prompt}"${answersBlock}${historyBlock}

Generate a complete dashboard brief. Focus on metric definitions, source systems, refresh cadence, drill-downs, and role-scoped access.

Return this exact JSON with domain-specific content:

{
  "intakeSummary": {
    "understood": "1-2 sentence summary of the dashboard's purpose",
    "primaryAudience": "Who looks at this most — by job title",
    "decisionsMade": "What decisions this dashboard supports",
    "currentReporting": "How this is reported today — spreadsheet, BI tool, PDF, ad-hoc query",
    "mainOutcome": "What changes once this dashboard exists"
  },
  "kpiCatalog": {
    "primaryKPIs": [
      {
        "id": "KPI-01",
        "name": "KPI name in domain language",
        "definition": "Plain-language definition",
        "formula": "Numerator / Denominator — be precise",
        "unit": "$, %, count, days",
        "target": "Target value or threshold",
        "owner": "Role responsible for moving this metric",
        "vizType": "line|bar|table|gauge|big-number|heatmap"
      }
    ],
    "secondaryMetrics": [
      { "id": "M-01", "name": "Metric", "purpose": "Why it's tracked", "formula": "How it's calculated", "vizType": "type" }
    ],
    "dimensions": [
      { "name": "Dimension name — e.g. Region, Cost Center, Product Line", "values": ["sample", "values"], "usedIn": ["KPI-01"] }
    ],
    "timeWindows": ["Today", "Last 7 days", "MTD", "QTD", "YTD", "Trailing 12 months"]
  },
  "dataSources": {
    "sources": [
      {
        "id": "DS-01",
        "system": "Source system — e.g. Salesforce, SAP, ServiceNow, Snowflake",
        "objects": ["Object/table 1", "Object/table 2"],
        "extractionMethod": "REST API|JDBC|Webhook|Flat file|Direct DB query",
        "authMethod": "OAuth|API key|Service account",
        "owner": "Data steward role"
      }
    ],
    "joins": [
      { "left": "DS-01.field", "right": "DS-02.field", "type": "inner|left|outer", "purpose": "Why these are joined" }
    ],
    "transformations": [
      { "step": "Transformation name", "logic": "What it does — e.g. 'currency conversion at month-end FX rate'" }
    ],
    "knownLimitations": ["Source X only updates nightly", "System Y truncates names over 50 chars"]
  },
  "refreshSchedule": {
    "tiers": [
      {
        "tier": "Real-time|Near real-time|Hourly|Daily|Weekly",
        "metrics": ["KPI-01"],
        "cadence": "Specific cadence — e.g. 'every 15 minutes'",
        "stalenessTolerance": "How stale data can be before users complain",
        "mechanism": "Streaming|Scheduled ETL|Cache invalidation on write"
      }
    ],
    "latencyBudget": "Page load target — e.g. 'under 2s for top-level, under 5s for drill-down'",
    "fallbackBehavior": "What is shown when a source is down — cached data with timestamp banner, etc."
  },
  "drilldownPaths": {
    "paths": [
      {
        "id": "DD-01",
        "from": "Top-level KPI or chart",
        "to": "Detail view name",
        "filters": ["Filters carried through — e.g. date range, region"],
        "purpose": "What question this drill-down answers"
      }
    ],
    "interactiveFilters": [
      { "name": "Filter name", "type": "date range|multi-select|search|slider", "appliesTo": ["KPI-01", "KPI-02"], "default": "Default value" }
    ],
    "exportFormats": ["CSV", "Excel", "PDF", "PNG image"],
    "savedViews": "Whether users can save and share filter combinations"
  },
  "permissionsMatrix": {
    "roles": [
      { "role": "Role name", "scope": "All data|Own team|Own region|Own records", "canExport": true, "canShareLinks": true, "canEditFilters": true }
    ],
    "rowLevelSecurity": [
      { "metric": "KPI-01", "rule": "Users see only rows where region matches their assigned region", "enforcedBy": "Database view|App-layer filter" }
    ],
    "sensitiveData": [
      { "field": "Field with PII or restricted content", "maskingRule": "Mask|Aggregate-only|Hide for non-admins" }
    ],
    "audit": "What dashboard interactions are logged and retained how long"
  },
  "appSpec": {
    "appTitle": "2-4 word dashboard name",
    "appType": "Dashboard",
    "tagline": "One-line value prop",
    "purpose": "2-3 sentences on what decisions this enables",
    "workflowType": "status_board",
    "layoutType": "command_center",
    "colorTheme": { "name": "color name", "primary": "#hex", "light": "#hex", "text": "#hex" },
    "features": ["Feature 1", "Feature 2", "Feature 3"],
    "fields": [],
    "statusFlow": ["On Target", "At Risk", "Off Target"],
    "primaryActionLabel": "View Details",
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
- kpiCatalog.primaryKPIs must have 4-6 metrics with real formulas (numerator/denominator), not '% of something'
- dataSources.sources must name actual systems from the prompt's domain (not 'DataWarehouse')
- refreshSchedule must specify cadence in concrete units (minutes/hours/days), not 'periodically'
- drilldownPaths.paths must have 3+ paths each tied to a specific business question`
  },
}

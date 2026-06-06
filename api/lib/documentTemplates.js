/**
 * ARIA Document Template Registry
 * ────────────────────────────────
 * The single source of truth for every corporate document type Aria can produce.
 *
 * This is the keystone of the document system. `pm-document.js`, the export
 * pipeline, the artifact viewer, and depth validation all read from here.
 *
 * Each template defines WHAT a professional version of that document must
 * contain (required sections, depth, format, role framing, validation). The
 * generation prompt is composed FROM the template, so output depth and
 * structure are guaranteed by data, not by ad-hoc prompt strings.
 *
 * Content shape produced for every document (stored in artifacts.content):
 *   {
 *     documentType: 'prd',
 *     label: 'Product Requirements Document',
 *     format: 'formal_doc' | 'spreadsheet' | 'diagram' | 'presentation' | 'mockup',
 *     depthMode: 'brief' | 'standard' | 'enterprise',
 *     meta: { title, version, owner, date, status, project },
 *     sections: [
 *       { key, title, body, table?: {columns,rows}, bullets?: [], mermaid?: '' }
 *     ],
 *   }
 *
 * Adding a new document type = adding one entry to DOCUMENT_TEMPLATES.
 */

// ── Format types → how the doc renders and exports ──────────────────────────────
export const FORMAT_TYPES = {
  formal_doc:   { exportFormats: ['pdf', 'docx', 'md'] },
  spreadsheet:  { exportFormats: ['xlsx', 'csv', 'pdf'] },
  diagram:      { exportFormats: ['pdf', 'png', 'svg', 'mermaid'] },
  presentation: { exportFormats: ['pptx', 'pdf'] },
  mockup:       { exportFormats: ['pdf', 'png'] },
}

// ── Reusable section fragments appended to most formal documents ────────────────
// Keeps every enterprise document honest: assumptions, risks, open questions, next steps.
const SEC = {
  assumptions:    { key: 'assumptions',    title: 'Assumptions',          guidance: 'Explicit assumptions this document relies on. Each as a concrete, checkable statement.', minWords: 40, kind: 'bullets' },
  dependencies:   { key: 'dependencies',   title: 'Dependencies',         guidance: 'Upstream/downstream systems, teams, approvals, or deliverables this depends on.', minWords: 40, kind: 'bullets' },
  risks:          { key: 'risks',          title: 'Risks & Mitigations',  guidance: 'Material risks with likelihood, impact, and a concrete mitigation/owner for each.', minWords: 60, kind: 'table', columns: ['Risk', 'Likelihood', 'Impact', 'Mitigation', 'Owner'] },
  open_questions: { key: 'open_questions', title: 'Open Questions',       guidance: 'Unresolved decisions blocking finalization, each with who must decide.', minWords: 30, kind: 'bullets' },
  next_steps:     { key: 'next_steps',     title: 'Next Steps',           guidance: 'Concrete, sequenced actions with owners and rough timing.', minWords: 40, kind: 'bullets' },
  approvals:      { key: 'approvals',      title: 'Approvals & Sign-off',  guidance: 'Approval chain: role, name placeholder, decision, date. Who must sign before this proceeds.', minWords: 30, kind: 'table', columns: ['Approver Role', 'Name', 'Decision', 'Date'] },
}

// ── Default depth requirements per mode ─────────────────────────────────────────
export const DEPTH_MODES = {
  brief:      { label: 'Brief',              totalWords: 350,  perSectionMinFactor: 0.4, includeFragments: ['next_steps'] },
  standard:   { label: 'Standard',           totalWords: 900,  perSectionMinFactor: 0.7, includeFragments: ['assumptions', 'risks', 'next_steps'] },
  enterprise: { label: 'Enterprise Detailed', totalWords: 1500, perSectionMinFactor: 1.0, includeFragments: ['assumptions', 'dependencies', 'risks', 'open_questions', 'next_steps', 'approvals'] },
}
export const DEFAULT_DEPTH_MODE = 'enterprise'

// ── Helper to define a formal-doc template concisely ────────────────────────────
function doc(def) {
  return {
    formatType: 'formal_doc',
    category: 'general',
    optionalSections: [],
    roleRelevance: {},
    minimumDepth: { totalWords: DEPTH_MODES.enterprise.totalWords },
    ...def,
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// THE REGISTRY
// ════════════════════════════════════════════════════════════════════════════════
export const DOCUMENT_TEMPLATES = {
  // ── PRODUCT / PM ──────────────────────────────────────────────────────────────
  prd: doc({
    documentType: 'prd',
    label: 'Product Requirements Document',
    aliases: ['prd', 'product requirements', 'product requirements document', 'product spec', 'requirements doc'],
    category: 'product',
    purpose: 'Define what to build and why, in enough detail that design, engineering, and stakeholders can align and execute.',
    requiredSections: [
      { key: 'executive_summary',       title: 'Executive Summary',          guidance: 'What this product is, who it serves, and the business outcome. A senior leader should grasp the whole initiative here.', minWords: 80 },
      { key: 'background',              title: 'Background & Context',        guidance: 'Why now. The operational pain, prior attempts, and the trigger for this work.', minWords: 70 },
      { key: 'problem_statement',       title: 'Problem Statement',           guidance: 'The specific problem, quantified where possible (time lost, error rate, cost).', minWords: 50 },
      { key: 'goals',                   title: 'Goals & Non-Goals',           guidance: 'Explicit in-scope goals and explicit non-goals to prevent scope creep.', minWords: 60 },
      { key: 'users_personas',          title: 'Users & Personas',            guidance: 'Each persona: role, context, what they need, how often they engage.', minWords: 70 },
      { key: 'current_state',           title: 'Current State',               guidance: 'How the workflow happens today, step by step, including the tools used.', minWords: 60 },
      { key: 'future_state',            title: 'Future State',                guidance: 'How the workflow happens with this product. The target experience.', minWords: 60 },
      { key: 'functional_requirements', title: 'Functional Requirements',     guidance: 'Numbered, testable requirements. What the system must do.', minWords: 120, kind: 'table', columns: ['ID', 'Requirement', 'Priority', 'Rationale'] },
      { key: 'nonfunctional',           title: 'Non-Functional Requirements', guidance: 'Performance, security, availability, accessibility, compliance constraints.', minWords: 60 },
      { key: 'user_stories',            title: 'User Stories',                guidance: 'As a <role>, I want <capability>, so that <outcome>. Cover the primary flows.', minWords: 80, kind: 'bullets' },
      { key: 'acceptance_criteria',     title: 'Acceptance Criteria',         guidance: 'Given/When/Then criteria that define "done" for the key requirements.', minWords: 80, kind: 'bullets' },
      { key: 'edge_cases',              title: 'Edge Cases',                  guidance: 'Boundary conditions, failure modes, and unusual but real scenarios.', minWords: 50, kind: 'bullets' },
      { key: 'success_metrics',         title: 'Success Metrics',             guidance: 'Measurable KPIs with baselines and targets tied to the goals.', minWords: 50, kind: 'table', columns: ['Metric', 'Baseline', 'Target', 'How Measured'] },
    ],
    roleRelevance: {
      product_manager: 'Emphasize user value, prioritization rationale, success metrics, and stakeholder alignment.',
      technical_pm:    'Add technical constraints, API/integration dependencies, NFRs, and data implications to each requirement.',
      engineering:     'Make requirements implementation-precise; include data shapes, error handling, and integration points.',
    },
  }),

  feature_scope: doc({
    documentType: 'feature_scope',
    label: 'Feature Scope Document',
    aliases: ['feature scope', 'scope document', 'scoping doc'],
    category: 'product',
    purpose: 'Lock the boundaries of a feature: what is in, what is out, and what it depends on.',
    requiredSections: [
      { key: 'overview',       title: 'Overview',           guidance: 'The feature in two or three sentences and the outcome it enables.', minWords: 50 },
      { key: 'in_scope',       title: 'In Scope',           guidance: 'Specific capabilities included in this delivery.', minWords: 60, kind: 'bullets' },
      { key: 'out_of_scope',   title: 'Out of Scope',       guidance: 'Explicitly excluded capabilities, deferred to later phases.', minWords: 50, kind: 'bullets' },
      { key: 'requirements',   title: 'Requirements',       guidance: 'Numbered functional requirements within scope.', minWords: 80, kind: 'table', columns: ['ID', 'Requirement', 'Priority'] },
      { key: 'acceptance',     title: 'Acceptance Criteria', guidance: 'Conditions that define completion.', minWords: 60, kind: 'bullets' },
    ],
  }),

  // ── TECHNICAL / ENGINEERING ─────────────────────────────────────────────────
  technical_spec: doc({
    documentType: 'technical_spec',
    label: 'Technical Specification',
    aliases: ['technical spec', 'tech spec', 'technical specification', 'engineering spec', 'design doc'],
    category: 'technical',
    purpose: 'Define how the system is built so engineers can implement it without ambiguity.',
    requiredSections: [
      { key: 'system_overview', title: 'System Overview',       guidance: 'What the system does and its place in the broader architecture.', minWords: 70 },
      { key: 'architecture',    title: 'Architecture',          guidance: 'Components, responsibilities, and how they interact. Describe the data flow.', minWords: 90 },
      { key: 'components',       title: 'Components',           guidance: 'Each major component: responsibility, inputs, outputs, technology.', minWords: 80, kind: 'table', columns: ['Component', 'Responsibility', 'Tech', 'Notes'] },
      { key: 'apis',             title: 'APIs',                guidance: 'Endpoints/contracts: method, path, request, response, auth.', minWords: 70, kind: 'table', columns: ['Method', 'Endpoint', 'Purpose', 'Auth'] },
      { key: 'data_model',       title: 'Data Model',          guidance: 'Entities, key fields, types, relationships.', minWords: 70 },
      { key: 'integrations',     title: 'Integrations',        guidance: 'External systems, direction of data, and protocols.', minWords: 50 },
      { key: 'auth_permissions', title: 'Auth & Permissions',  guidance: 'Identity model, roles, and access control rules.', minWords: 50 },
      { key: 'error_handling',   title: 'Error Handling & Logging', guidance: 'Failure modes, retries, observability, and audit logging.', minWords: 50 },
      { key: 'deployment',       title: 'Deployment Notes',    guidance: 'Environments, configuration, rollout and rollback approach.', minWords: 40 },
      { key: 'test_strategy',    title: 'Test Strategy',       guidance: 'Unit/integration/e2e coverage and key test scenarios.', minWords: 50 },
    ],
  }),

  api_spec: doc({
    documentType: 'api_spec',
    label: 'API Specification',
    aliases: ['api spec', 'api specification', 'api documentation', 'api contract'],
    category: 'technical',
    purpose: 'Document API endpoints precisely enough for a consumer to integrate without asking questions.',
    requiredSections: [
      { key: 'overview',     title: 'Overview',            guidance: 'What the API does, base URL, versioning, and conventions.', minWords: 50 },
      { key: 'auth',         title: 'Authentication',      guidance: 'Auth scheme, tokens, scopes, and error responses.', minWords: 40 },
      { key: 'endpoints',    title: 'Endpoints',           guidance: 'Each endpoint: method, path, params, request body, response, status codes.', minWords: 120, kind: 'table', columns: ['Method', 'Endpoint', 'Request', 'Response', 'Notes'] },
      { key: 'data_types',   title: 'Data Types / Schemas', guidance: 'Object schemas with field names, types, and required flags.', minWords: 60 },
      { key: 'errors',       title: 'Error Codes',         guidance: 'Standard error responses and their meanings.', minWords: 40, kind: 'table', columns: ['Code', 'Meaning', 'When'] },
      { key: 'rate_limits',  title: 'Rate Limits & SLAs',  guidance: 'Throttling, quotas, and availability expectations.', minWords: 30 },
    ],
  }),

  qa_test_plan: doc({
    documentType: 'qa_test_plan',
    label: 'QA / Test Plan',
    aliases: ['test plan', 'qa plan', 'qa test plan', 'testing plan', 'uat plan', 'test strategy'],
    category: 'technical',
    purpose: 'Define how the product will be validated before release.',
    requiredSections: [
      { key: 'scope',        title: 'Test Scope',         guidance: 'What is and is not covered by this test effort.', minWords: 50 },
      { key: 'approach',     title: 'Test Approach',      guidance: 'Levels (unit/integration/e2e/UAT), environments, and data strategy.', minWords: 60 },
      { key: 'test_cases',   title: 'Test Cases',         guidance: 'Key cases: scenario, steps, expected result, priority.', minWords: 120, kind: 'table', columns: ['ID', 'Scenario', 'Steps', 'Expected Result', 'Priority'] },
      { key: 'entry_exit',   title: 'Entry / Exit Criteria', guidance: 'Conditions to begin and to declare testing complete.', minWords: 40 },
      { key: 'defect_mgmt',  title: 'Defect Management',  guidance: 'Severity definitions and triage process.', minWords: 40 },
    ],
  }),

  deployment_plan: doc({
    documentType: 'deployment_plan',
    label: 'Deployment & Rollback Plan',
    aliases: ['deployment plan', 'release plan', 'rollout plan', 'rollback plan', 'go-live plan'],
    category: 'technical',
    purpose: 'Plan a safe production release with a tested path to recover.',
    requiredSections: [
      { key: 'release_overview', title: 'Release Overview',  guidance: 'What is being released and the target window.', minWords: 40 },
      { key: 'pre_checks',       title: 'Pre-Deployment Checks', guidance: 'Verifications required before go-live.', minWords: 50, kind: 'bullets' },
      { key: 'steps',            title: 'Deployment Steps',  guidance: 'Ordered, executable steps with owners.', minWords: 70, kind: 'table', columns: ['Step', 'Action', 'Owner', 'Verification'] },
      { key: 'rollback',         title: 'Rollback Plan',     guidance: 'Triggers and exact steps to revert safely.', minWords: 50, kind: 'bullets' },
      { key: 'validation',       title: 'Post-Deploy Validation', guidance: 'How success is confirmed in production.', minWords: 40, kind: 'bullets' },
    ],
  }),

  // ── OPERATIONS ────────────────────────────────────────────────────────────────
  sop: doc({
    documentType: 'sop',
    label: 'Standard Operating Procedure',
    aliases: ['sop', 'standard operating procedure', 'procedure', 'process doc', 'process documentation'],
    category: 'operations',
    purpose: 'Document a repeatable procedure precisely enough for anyone qualified to execute it consistently.',
    requiredSections: [
      { key: 'purpose',          title: 'Purpose',                   guidance: 'Why this procedure exists and the outcome it guarantees.', minWords: 40 },
      { key: 'scope',            title: 'Scope',                     guidance: 'When this procedure applies and when it does not.', minWords: 40 },
      { key: 'audience',         title: 'Audience',                  guidance: 'Who performs this procedure and required qualifications.', minWords: 30 },
      { key: 'roles',            title: 'Roles & Responsibilities',  guidance: 'Each role and what they are accountable for in this procedure.', minWords: 50, kind: 'table', columns: ['Role', 'Responsibility'] },
      { key: 'prerequisites',    title: 'Prerequisites',             guidance: 'Access, tools, inputs, and conditions required before starting.', minWords: 40, kind: 'bullets' },
      { key: 'procedure',        title: 'Step-by-Step Procedure',    guidance: 'Numbered, unambiguous steps. Each step states the actor, action, and result.', minWords: 150, kind: 'table', columns: ['Step', 'Actor', 'Action', 'Result'] },
      { key: 'exceptions',       title: 'Exceptions',                guidance: 'Known exceptions and how to handle each.', minWords: 50, kind: 'bullets' },
      { key: 'escalation',       title: 'Escalation Path',           guidance: 'When and to whom to escalate, with thresholds.', minWords: 40 },
      { key: 'sla',              title: 'SLA Expectations',          guidance: 'Time expectations for each stage of the procedure.', minWords: 30 },
      { key: 'systems',          title: 'Systems Used',              guidance: 'Tools and systems involved and their role.', minWords: 30, kind: 'bullets' },
      { key: 'compliance',       title: 'Compliance Notes',          guidance: 'Regulatory or policy requirements this procedure satisfies.', minWords: 30 },
      { key: 'revision_history', title: 'Revision History',          guidance: 'Version, date, author, and change summary.', minWords: 20, kind: 'table', columns: ['Version', 'Date', 'Author', 'Change'] },
    ],
    roleRelevance: {
      operations: 'Emphasize handoffs, SLAs, and exception handling between teams.',
      it_admin:   'Frame steps around triage, systems access, and resolution with KB references.',
      compliance: 'Tie each step to the control it satisfies and the evidence it produces.',
    },
  }),

  runbook: doc({
    documentType: 'runbook',
    label: 'Operational Runbook',
    aliases: ['runbook', 'run book', 'ops runbook', 'incident runbook'],
    category: 'operations',
    purpose: 'Give on-call/ops exact, executable steps to operate or recover a system.',
    requiredSections: [
      { key: 'overview',     title: 'Overview',            guidance: 'What this runbook covers and when to use it.', minWords: 40 },
      { key: 'triage',       title: 'Triage',              guidance: 'How to assess severity and confirm the issue quickly.', minWords: 50 },
      { key: 'resolution',   title: 'Resolution Steps',    guidance: 'Exact commands/actions to resolve, in order.', minWords: 90, kind: 'table', columns: ['Step', 'Action', 'Expected Result'] },
      { key: 'escalation',   title: 'Escalation',          guidance: 'Thresholds and contacts for escalation.', minWords: 40 },
      { key: 'sla',          title: 'SLA',                 guidance: 'Response and resolution time targets by severity.', minWords: 30 },
      { key: 'references',   title: 'KB References',       guidance: 'Links/identifiers for related knowledge and dashboards.', minWords: 20, kind: 'bullets' },
    ],
  }),

  process_optimization: doc({
    documentType: 'process_optimization',
    label: 'Process Optimization Plan',
    aliases: ['process optimization', 'process improvement', 'future state process', 'current state process', 'process map'],
    category: 'operations',
    purpose: 'Analyze a current process and define a measurably better future state.',
    requiredSections: [
      { key: 'current_state',  title: 'Current State Process', guidance: 'Step-by-step of how it works today, with pain points and time per step.', minWords: 90, kind: 'table', columns: ['Step', 'Actor', 'Time', 'Pain Point'] },
      { key: 'analysis',       title: 'Analysis',              guidance: 'Bottlenecks, redundant steps, and root causes.', minWords: 60 },
      { key: 'future_state',   title: 'Future State Process',  guidance: 'The improved process, step by step, and what changed.', minWords: 90, kind: 'table', columns: ['Step', 'Actor', 'Change', 'Benefit'] },
      { key: 'impact',         title: 'Expected Impact',       guidance: 'Quantified time/cost/error improvement.', minWords: 40 },
    ],
  }),

  // ── FINANCE ─────────────────────────────────────────────────────────────────
  cost_breakdown: {
    documentType: 'cost_breakdown',
    label: 'Cost Breakdown',
    aliases: ['cost breakdown', 'finance breakdown', 'cost analysis', 'budget breakdown', 'spend breakdown'],
    category: 'finance',
    formatType: 'spreadsheet',
    purpose: 'Itemize one-time and recurring costs with assumptions and owners.',
    requiredSections: [
      { key: 'cost_table', title: 'Cost Breakdown', guidance: 'Every cost line with category, description, one-time and recurring amounts, owner, and cost driver.', minWords: 80, kind: 'table', columns: ['Cost Category', 'Description', 'One-Time Cost', 'Recurring Cost', 'Cost Driver', 'Owner', 'Notes'] },
      { key: 'totals',      title: 'Totals',         guidance: 'Summed one-time and annualized recurring totals.', minWords: 20, kind: 'table', columns: ['Type', 'Amount'] },
      { key: 'assumptions', title: 'Assumptions',    guidance: 'Pricing, headcount, and usage assumptions behind the numbers.', minWords: 50, kind: 'bullets' },
    ],
    roleRelevance: {
      finance: 'Add budget categories, approval thresholds, and one-time vs recurring treatment per GAAP norms.',
    },
    minimumDepth: { totalWords: 500 },
    optionalSections: [],
  },

  roi_analysis: {
    documentType: 'roi_analysis',
    label: 'ROI / Savings Analysis',
    aliases: ['roi', 'roi analysis', 'savings analysis', 'cost-benefit', 'cost benefit analysis', 'payback analysis', 'business value'],
    category: 'finance',
    formatType: 'spreadsheet',
    purpose: 'Quantify the financial return of the initiative versus the current manual process.',
    requiredSections: [
      { key: 'current_cost',  title: 'Current Manual Process Cost', guidance: 'Labor hours, error/rework cost, and tooling cost of today\'s process.', minWords: 60, kind: 'table', columns: ['Driver', 'Volume', 'Unit Cost', 'Annual Cost'] },
      { key: 'future_cost',   title: 'Estimated Automated Cost',    guidance: 'Cost of the new process including platform and maintenance.', minWords: 50, kind: 'table', columns: ['Driver', 'Volume', 'Unit Cost', 'Annual Cost'] },
      { key: 'savings',       title: 'Savings & Benefits',          guidance: 'Time savings, labor savings, error reduction, risk reduction.', minWords: 50, kind: 'table', columns: ['Benefit', 'Annual Value', 'Basis'] },
      { key: 'roi_summary',   title: 'ROI Summary',                 guidance: 'Payback period, first-year ROI %, and 3-year value.', minWords: 40, kind: 'table', columns: ['Metric', 'Value'] },
      { key: 'assumptions',   title: 'Assumptions',                 guidance: 'Every assumption behind the figures.', minWords: 50, kind: 'bullets' },
    ],
    minimumDepth: { totalWords: 500 },
    optionalSections: [],
  },

  // ── LEGAL / COMPLIANCE / RISK ─────────────────────────────────────────────────
  risk_assessment: doc({
    documentType: 'risk_assessment',
    label: 'Risk Assessment',
    aliases: ['risk assessment', 'risk analysis', 'risk register', 'risk doc'],
    category: 'governance',
    purpose: 'Identify, rate, and plan mitigation for the risks of this initiative.',
    requiredSections: [
      { key: 'overview',      title: 'Risk Overview',     guidance: 'Context and the scope of risks being assessed.', minWords: 50 },
      { key: 'register',      title: 'Risk Register',     guidance: 'Each risk: category, description, likelihood, impact, mitigation, owner, status, residual risk.', minWords: 120, kind: 'table', columns: ['Risk', 'Category', 'Likelihood', 'Impact', 'Mitigation', 'Owner', 'Residual Risk'] },
      { key: 'escalation',    title: 'Escalation Path',   guidance: 'When risks escalate and to whom.', minWords: 30 },
      { key: 'review_cadence', title: 'Review Cadence',   guidance: 'How often the register is reviewed and by whom.', minWords: 30 },
    ],
    roleRelevance: {
      compliance: 'Map each risk to controls, evidence, retention, and remediation owners.',
    },
  }),

  compliance_checklist: doc({
    documentType: 'compliance_checklist',
    label: 'Compliance / Legal Review Checklist',
    aliases: ['compliance checklist', 'legal review', 'legal checklist', 'compliance audit', 'audit checklist', 'data privacy assessment', 'privacy review'],
    category: 'governance',
    purpose: 'Verify the initiative meets legal, privacy, and compliance obligations before launch.',
    requiredSections: [
      { key: 'data_handled',   title: 'Data Handled',          guidance: 'Categories of data, sensitivity, and lawful basis for processing.', minWords: 50 },
      { key: 'checklist',      title: 'Compliance Checklist',  guidance: 'Each requirement: item, applicable standard, status, evidence, owner.', minWords: 100, kind: 'table', columns: ['Requirement', 'Standard', 'Status', 'Evidence', 'Owner'] },
      { key: 'retention',      title: 'Data Retention & Access', guidance: 'Retention periods, access controls, and deletion process.', minWords: 40 },
      { key: 'audit_trail',    title: 'Audit Trail',           guidance: 'What is logged, where, and for how long.', minWords: 40 },
      { key: 'open_legal',     title: 'Open Legal Questions',  guidance: 'Unresolved legal/privacy questions and who must answer them.', minWords: 30, kind: 'bullets' },
    ],
  }),

  // ── PROJECT / PROGRAM ─────────────────────────────────────────────────────────
  project_charter: doc({
    documentType: 'project_charter',
    label: 'Project Charter',
    aliases: ['project charter', 'program charter', 'charter'],
    category: 'project',
    purpose: 'Authorize a project and align stakeholders on objective, scope, and governance.',
    requiredSections: [
      { key: 'purpose',       title: 'Purpose & Objective',  guidance: 'The business objective and the measurable outcome.', minWords: 50 },
      { key: 'scope',         title: 'Scope',                guidance: 'In-scope and out-of-scope, clearly bounded.', minWords: 50 },
      { key: 'stakeholders',  title: 'Stakeholders',         guidance: 'Sponsor, owner, key stakeholders and their interest.', minWords: 40, kind: 'table', columns: ['Stakeholder', 'Role', 'Interest'] },
      { key: 'milestones',    title: 'Milestones & Timeline', guidance: 'Major milestones with target dates.', minWords: 50, kind: 'table', columns: ['Milestone', 'Target Date', 'Owner'] },
      { key: 'success',       title: 'Success Criteria',     guidance: 'How project success will be judged.', minWords: 40 },
      { key: 'budget',        title: 'Budget & Resources',   guidance: 'High-level budget and resourcing.', minWords: 30 },
    ],
    roleRelevance: {
      project_manager: 'Add RACI, RAID summary, and dependency register references.',
    },
  }),

  raci_matrix: {
    documentType: 'raci_matrix',
    label: 'RACI Matrix',
    aliases: ['raci', 'raci matrix', 'responsibility matrix', 'roles and responsibilities matrix'],
    category: 'project',
    formatType: 'spreadsheet',
    purpose: 'Clarify who is Responsible, Accountable, Consulted, and Informed for each activity.',
    requiredSections: [
      { key: 'matrix', title: 'RACI Matrix', guidance: 'Rows = activities/deliverables. Columns = roles. Each cell = R, A, C, or I. Include all key activities.', minWords: 80, kind: 'table', columns: ['Activity', 'Owner', 'Sponsor', 'Contributor', 'Reviewer', 'Stakeholder'] },
      { key: 'legend', title: 'Legend & Notes', guidance: 'Define R/A/C/I and any role abbreviations.', minWords: 30 },
    ],
    minimumDepth: { totalWords: 300 },
    optionalSections: [],
  },

  status_report: doc({
    documentType: 'status_report',
    label: 'Project Status Report',
    aliases: ['status report', 'project status', 'status update', 'progress report'],
    category: 'project',
    purpose: 'Communicate project health, progress, risks, and decisions needed.',
    requiredSections: [
      { key: 'summary',     title: 'Executive Summary',  guidance: 'Overall status (green/yellow/red) and the one-paragraph story.', minWords: 50 },
      { key: 'progress',    title: 'Progress',           guidance: 'What was accomplished this period.', minWords: 50, kind: 'bullets' },
      { key: 'upcoming',    title: 'Upcoming',           guidance: 'What is planned next period.', minWords: 40, kind: 'bullets' },
      { key: 'risks_issues', title: 'Risks & Issues',    guidance: 'Active risks/issues with owner and mitigation.', minWords: 50, kind: 'table', columns: ['Item', 'Type', 'Impact', 'Owner', 'Action'] },
      { key: 'decisions',   title: 'Decisions Needed',   guidance: 'Decisions required from stakeholders and by when.', minWords: 30, kind: 'bullets' },
    ],
  }),

  // ── SALES / CUSTOMER / EXEC ─────────────────────────────────────────────────
  business_case: doc({
    documentType: 'business_case',
    label: 'Business Case',
    aliases: ['business case', 'business justification', 'investment case', 'roi narrative'],
    category: 'sales',
    purpose: 'Justify an investment with the problem, options, costs, benefits, and recommendation.',
    requiredSections: [
      { key: 'executive_summary', title: 'Executive Summary', guidance: 'The ask, the value, and the recommendation in one tight section.', minWords: 70 },
      { key: 'problem',           title: 'Problem & Opportunity', guidance: 'The business problem, quantified, and the opportunity cost of inaction.', minWords: 60 },
      { key: 'options',           title: 'Options Considered', guidance: 'Alternatives with pros/cons, including do-nothing.', minWords: 60, kind: 'table', columns: ['Option', 'Pros', 'Cons', 'Cost'] },
      { key: 'recommendation',    title: 'Recommendation',    guidance: 'The recommended option and why.', minWords: 40 },
      { key: 'financials',        title: 'Financial Summary', guidance: 'Costs, benefits, payback, and ROI.', minWords: 50, kind: 'table', columns: ['Item', 'Year 1', 'Year 2', 'Year 3'] },
      { key: 'implementation',    title: 'Implementation Approach', guidance: 'High-level plan and timeline.', minWords: 40 },
    ],
  }),

  executive_summary_deck: {
    documentType: 'executive_summary_deck',
    label: 'Executive Summary Deck',
    aliases: ['executive summary deck', 'exec deck', 'executive deck', 'pitch deck', 'stakeholder deck', 'summary deck', 'presentation', 'slide deck'],
    category: 'presentation',
    formatType: 'presentation',
    purpose: 'A concise executive presentation: problem, solution, value, plan, ask.',
    requiredSections: [
      { key: 'title',          title: 'Title Slide',        guidance: 'Initiative name, owner, date, one-line value proposition.', minWords: 15, kind: 'slide' },
      { key: 'agenda',         title: 'Agenda',             guidance: '3-5 agenda items.', minWords: 15, kind: 'slide' },
      { key: 'problem',        title: 'The Problem',        guidance: '3-4 bullets quantifying the pain.', minWords: 30, kind: 'slide' },
      { key: 'solution',       title: 'The Solution',       guidance: 'What we build/do and how it solves the problem.', minWords: 30, kind: 'slide' },
      { key: 'workflow',       title: 'How It Works',       guidance: 'The workflow at a high level, 3-5 steps.', minWords: 30, kind: 'slide' },
      { key: 'value',          title: 'Business Value',     guidance: 'Quantified benefits: time, cost, risk.', minWords: 30, kind: 'slide' },
      { key: 'risks',          title: 'Risks & Mitigations', guidance: 'Top risks and how they are handled.', minWords: 25, kind: 'slide' },
      { key: 'implementation', title: 'Implementation Plan', guidance: 'Phases and timeline.', minWords: 25, kind: 'slide' },
      { key: 'next_steps',     title: 'Next Steps & Ask',   guidance: 'The decision/approval requested and immediate next actions.', minWords: 25, kind: 'slide' },
    ],
    minimumDepth: { totalWords: 250 },
    optionalSections: [],
  },
}

// ── Build alias index once ──────────────────────────────────────────────────────
const ALIAS_INDEX = (() => {
  const idx = []
  for (const tpl of Object.values(DOCUMENT_TEMPLATES)) {
    for (const a of (tpl.aliases || [])) idx.push({ alias: a.toLowerCase(), tpl })
  }
  // Longer aliases first so "product requirements document" beats "product"
  idx.sort((x, y) => y.alias.length - x.alias.length)
  return idx
})()

// ════════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Resolve a free-form user request to a document template.
 * Returns a known template, or a dynamically-synthesized corporate template.
 */
export function resolveDocumentType(request = '') {
  const r = String(request).toLowerCase()
  for (const { alias, tpl } of ALIAS_INDEX) {
    if (r.includes(alias)) return { template: tpl, matched: true }
  }
  return { template: buildDynamicTemplate(request), matched: false }
}

/**
 * Synthesize a reasonable corporate template for an unrecognized document type.
 * Never reject a request — produce a structured general-purpose document.
 */
export function buildDynamicTemplate(request = '') {
  const cleaned = String(request).replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\b(generate|create|make|add|build|a|an|the|for|me|please|document|doc)\b/gi, ' ').replace(/\s+/g, ' ').trim()
  const words = cleaned.split(' ').filter(Boolean).slice(0, 5)
  const label = words.length
    ? words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Custom Document'
  const slug = (words.join('_').toLowerCase() || 'custom')
  return {
    documentType: `custom_${slug}`,
    label,
    aliases: [],
    category: 'custom',
    formatType: 'formal_doc',
    isDynamic: true,
    purpose: `A professional, stakeholder-ready ${label} tailored to this project.`,
    requiredSections: [
      { key: 'purpose',      title: 'Purpose',        guidance: `Why this ${label} exists and the outcome it supports.`, minWords: 50 },
      { key: 'background',   title: 'Background & Context', guidance: 'Relevant context, current situation, and what prompted this.', minWords: 60 },
      { key: 'scope',        title: 'Scope',          guidance: 'What is covered and what is explicitly excluded.', minWords: 50 },
      { key: 'stakeholders', title: 'Stakeholders',   guidance: 'Who is involved and their interest.', minWords: 40, kind: 'table', columns: ['Stakeholder', 'Role', 'Interest'] },
      { key: 'details',      title: 'Details',        guidance: `The substantive content of the ${label}, organized into clear sub-points specific to the domain.`, minWords: 150 },
      { key: 'considerations', title: 'Key Considerations', guidance: 'Constraints, edge cases, and business rules that apply.', minWords: 60 },
    ],
    optionalSections: [],
    roleRelevance: {},
    minimumDepth: { totalWords: DEPTH_MODES.enterprise.totalWords },
  }
}

/**
 * Compose the full generation system prompt for a template, framed by the
 * user's role and the requested depth mode.
 */
export function buildDocumentSystemPrompt(template, { roleContext = null, depthMode = DEFAULT_DEPTH_MODE } = {}) {
  const depth = DEPTH_MODES[depthMode] || DEPTH_MODES[DEFAULT_DEPTH_MODE]
  const sections = getEffectiveSections(template, depthMode)

  const sectionLines = sections.map((s, i) => {
    const min = Math.max(15, Math.round((s.minWords || 50) * depth.perSectionMinFactor))
    const shape = s.kind === 'table'
      ? ` Output as a table with columns: [${(s.columns || []).join(', ')}], with multiple rows.`
      : s.kind === 'bullets'
      ? ' Output as a list of specific, concrete bullet points (not one generic line).'
      : s.kind === 'slide'
      ? ' Output as a slide: a short title plus 3-5 concise bullets.'
      : ' Output as 1-3 substantive paragraphs.'
    return `  ${i + 1}. "${s.key}" — ${s.title}\n     ${s.guidance}\n     Minimum depth: ~${min} words.${shape}`
  }).join('\n')

  const roleFrame = roleContext?.role && template.roleRelevance?.[roleContext.role]
    ? `\n\nROLE FRAMING (user is ${roleContext.role}${roleContext.seniority ? `, ${roleContext.seniority}` : ''}):\n${template.roleRelevance[roleContext.role]}`
    : ''

  return `You are Aria, an enterprise documentation engine. Produce a ${template.label} that a real corporate employee could submit to executives, IT, finance, legal, or a client for review and approval.

PURPOSE OF THIS DOCUMENT: ${template.purpose}

DEPTH MODE: ${depth.label}. This must be a detailed, end-to-end, professional document — NOT a summary or a set of cards. No section may be empty or a single generic sentence. Total length target: at least ~${depth.totalWords} words. Be specific to the actual project, domain, roles, and workflow. Use real business language. No placeholders like "Name" or "Description". No em-dashes in prose.

You MUST return the document with EXACTLY these sections, in this order:
${sectionLines}${roleFrame}

CRITICAL OUTPUT FORMAT — return exactly one valid JSON object, no markdown fences, no preface:
{
  "documentType": "${template.documentType}",
  "label": "${template.label}",
  "format": "${template.formatType}",
  "depthMode": "${depthMode}",
  "meta": { "title": "<specific document title>", "version": "1.0", "owner": "<role or TBD>", "date": "<today>", "status": "draft", "project": "<short project name>" },
  "sections": [
    {
      "key": "<section key from the list above>",
      "title": "<section title>",
      "body": "<prose content as a string; omit if using table/bullets>",
      "bullets": ["<bullet>", "..."],            // only for bullet/slide sections
      "table": { "columns": ["..."], "rows": [["..."]] }  // only for table sections
    }
  ]
}
Include EVERY required section. Populate body OR bullets OR table appropriately per section. Tables must have multiple real rows. Bullets must be specific.`
}

/**
 * Get the sections for a template including the depth-mode standard fragments
 * (assumptions, risks, open questions, next steps, approvals) for formal docs.
 */
export function getEffectiveSections(template, depthMode = DEFAULT_DEPTH_MODE) {
  const depth = DEPTH_MODES[depthMode] || DEPTH_MODES[DEFAULT_DEPTH_MODE]
  const base = [...(template.requiredSections || [])]
  // Only formal documents get the standard governance fragments appended.
  if (template.formatType === 'formal_doc') {
    const existingKeys = new Set(base.map(s => s.key))
    for (const fragKey of depth.includeFragments) {
      const frag = SEC[fragKey]
      if (frag && !existingKeys.has(frag.key)) base.push(frag)
    }
  }
  return base
}

/**
 * Validate a generated document against its template + depth requirements.
 * Returns { ok, issues: [] }. Used to reject + regenerate shallow output.
 */
export function validateDocument(template, content, depthMode = DEFAULT_DEPTH_MODE) {
  const issues = []
  if (!content || typeof content !== 'object') return { ok: false, issues: ['No content returned.'] }

  const sections = Array.isArray(content.sections) ? content.sections : null
  if (!sections) return { ok: false, issues: ['Document has no sections array.'] }

  const depth = DEPTH_MODES[depthMode] || DEPTH_MODES[DEFAULT_DEPTH_MODE]
  const required = getEffectiveSections(template, depthMode)
  const byKey = new Map(sections.map(s => [s.key, s]))
  const byTitle = new Map(sections.map(s => [(s.title || '').toLowerCase(), s]))

  const wordCount = (s) => {
    let text = ''
    if (s.body) text += ' ' + s.body
    if (Array.isArray(s.bullets)) text += ' ' + s.bullets.join(' ')
    if (s.table?.rows) text += ' ' + s.table.rows.flat().join(' ')
    return text.trim().split(/\s+/).filter(Boolean).length
  }

  let total = 0
  for (const req of required) {
    const sec = byKey.get(req.key) || byTitle.get((req.title || '').toLowerCase())
    if (!sec) { issues.push(`Missing required section: ${req.title}`); continue }
    const wc = wordCount(sec)
    total += wc
    const min = Math.max(10, Math.round((req.minWords || 40) * depth.perSectionMinFactor))
    const isTable = req.kind === 'table'
    if (isTable) {
      const rows = sec.table?.rows
      if (!Array.isArray(rows) || rows.length < 2) issues.push(`Section "${req.title}" should be a table with multiple rows.`)
    } else if (wc < min) {
      issues.push(`Section "${req.title}" is too thin (${wc} words, need ~${min}).`)
    }
  }

  if (total < depth.totalWords * 0.6) {
    issues.push(`Document is too short overall (${total} words, target ~${depth.totalWords}).`)
  }

  return { ok: issues.length === 0, issues }
}

/** Export formats available for a given document (by format type). */
export function getExportFormats(template) {
  return FORMAT_TYPES[template.formatType]?.exportFormats || ['pdf', 'json', 'md']
}

/** List all known document types for UI pickers. */
export function listDocumentTypes() {
  return Object.values(DOCUMENT_TEMPLATES).map(t => ({
    documentType: t.documentType,
    label: t.label,
    category: t.category,
    formatType: t.formatType,
  }))
}

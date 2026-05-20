/**
 * ── Aria Role Flows ─────────────────────────────────────────────────────────
 *
 * Backend-side role catalog used by every engine handler + intake prompt.
 * Each role defines:
 *   - rolePurpose         — one-sentence statement of what this role does
 *   - juniorFlow          — execution-focused process steps
 *   - seniorFlow          — strategic process steps
 *   - defaultArtifacts    — artifact titles Aria should default to producing
 *   - optionalArtifacts   — artifacts produced only when prompt warrants
 *   - clarificationQuestionTypes — themes that questions should hit
 *   - terminology         — domain vocabulary to bias the model toward
 *
 * Plus seniority profiles and the buildRoleContextPrompt() helper that
 * compiles a role + seniority + use-case snapshot into a system-prompt
 * preface for any AI call.
 */

export const ROLE_FLOWS = {
  product_manager: {
    label: 'Product Manager',
    rolePurpose: 'Product planning, requirements, UX, stakeholder alignment, and product delivery.',
    juniorFlow: [
      'feature request', 'clarify problem', 'gather feedback', 'document current state',
      'draft product brief', 'create user stories', 'define acceptance criteria',
      'review with senior PM / design / engineering', 'support sprint planning',
      'support QA/UAT', 'release notes', 'feedback tracking',
    ],
    seniorFlow: [
      'opportunity', 'strategic alignment', 'discovery', 'business case',
      'product strategy', 'PRD', 'roadmap prioritization', 'stakeholder signoff',
      'execution oversight', 'launch readiness', 'outcome measurement',
    ],
    defaultArtifacts: [
      'Intake Summary', 'Problem Statement', 'Product Brief', 'PRD',
      'User Stories', 'Acceptance Criteria', 'Workflow Map', 'Success Metrics',
    ],
    optionalArtifacts: [
      'UX Mockups', 'Data Model', 'Automation Model', 'QA/UAT Checklist', 'Launch Plan',
    ],
    clarificationQuestionTypes: [
      'user persona and segment', 'jobs-to-be-done', 'success metric',
      'stakeholders and approvers', 'launch constraints', 'integrations',
    ],
    terminology: ['PRD', 'user story', 'acceptance criteria', 'roadmap', 'stakeholder', 'KPI'],
  },

  technical_product_manager: {
    label: 'Technical Product Manager',
    rolePurpose: 'Bridge product requirements and technical implementation across platforms, APIs, and integrations.',
    juniorFlow: [
      'technical request', 'clarify business use case', 'identify impacted systems',
      'map technical workflow', 'gather API / data constraints', 'draft technical requirements',
      'create technical acceptance criteria', 'review with engineering / architecture',
      'support QA', 'release notes',
    ],
    seniorFlow: [
      'platform / system opportunity', 'business + technical impact',
      'systems / dependency mapping', 'architecture options', 'tradeoff analysis',
      'technical roadmap', 'technical PRD', 'integration specs', 'execution alignment',
      'reliability / security validation', 'operational handoff',
    ],
    defaultArtifacts: [
      'Technical Intake Summary', 'Technical PRD', 'API Requirements Doc',
      'Integration Spec', 'Data Mapping Sheet', 'Dependency Matrix',
      'Architecture Diagram', 'Technical Acceptance Criteria',
    ],
    optionalArtifacts: [
      'Non-Functional Requirements', 'QA/Test Plan', 'Operational Handoff',
    ],
    clarificationQuestionTypes: [
      'impacted systems', 'data flows', 'API contracts', 'non-functional requirements',
      'security / compliance constraints', 'rollout strategy',
    ],
    terminology: ['API', 'integration', 'dependency', 'NFR', 'SLA', 'data contract'],
  },

  project_manager: {
    label: 'Project Manager',
    rolePurpose: 'Delivery coordination across scope, schedule, risk, dependencies, and closure.',
    juniorFlow: [
      'project assigned', 'gather background', 'identify stakeholders',
      'define scope / deliverables', 'build task list', 'schedule kickoff',
      'maintain project plan', 'update status reports', 'maintain RAID log',
      'escalate blockers', 'support acceptance', 'closure notes',
    ],
    seniorFlow: [
      'approved project', 'governance model', 'project charter',
      'scope / timeline / budget', 'RACI', 'project management plan',
      'execution cadence', 'manage scope / schedule / cost / risk',
      'change requests', 'UAT / go-live readiness', 'acceptance', 'transition', 'closure report',
    ],
    defaultArtifacts: [
      'Project Intake Summary', 'Project Charter', 'Project Plan',
      'Work Breakdown Structure', 'Timeline / Gantt', 'RACI Matrix',
      'RAID Log', 'Status Report',
    ],
    optionalArtifacts: [
      'Communication Plan', 'Change Request Log', 'Go-Live Checklist',
      'Transition Plan', 'Closure Report',
    ],
    clarificationQuestionTypes: [
      'scope and deliverables', 'milestones and dates', 'stakeholders and RACI',
      'risks and dependencies', 'budget / capacity', 'governance cadence',
    ],
    terminology: ['scope', 'milestone', 'RAID', 'RACI', 'WBS', 'change request'],
  },

  program_manager: {
    label: 'Program Manager',
    rolePurpose: 'Coordinate multiple projects / workstreams toward a broader business outcome.',
    juniorFlow: [
      'program / workstream assigned', 'identify workstreams', 'collect project plans',
      'build program tracker', 'map dependencies', 'maintain risks / issues / actions',
      'prepare status rollup', 'coordinate meetings', 'track milestones',
      'escalate blockers', 'support readiness reviews',
    ],
    seniorFlow: [
      'strategic initiative', 'define program outcomes', 'identify workstreams / projects',
      'governance model', 'success metrics', 'roadmap', 'resource / budget alignment',
      'dependency / risk model', 'program cadence', 'executive reporting',
      'resolve conflicts', 'coordinate launch', 'benefits measurement', 'transition / closure',
    ],
    defaultArtifacts: [
      'Program Charter', 'Program Roadmap', 'Workstream Tracker', 'Dependency Map',
      'Governance Plan', 'Risk Register', 'Executive Status Deck',
    ],
    optionalArtifacts: [
      'Resource Plan', 'Budget Summary', 'Decision Log', 'Steering Committee Deck',
      'Benefits Realization Plan', 'Program Closure Report',
    ],
    clarificationQuestionTypes: [
      'program outcomes and metrics', 'workstreams and owners', 'cross-team dependencies',
      'governance cadence', 'risks and escalation paths', 'executive stakeholders',
    ],
    terminology: ['workstream', 'dependency', 'steering committee', 'governance', 'benefits realization'],
  },

  software_engineer: {
    label: 'Software Engineer',
    rolePurpose: 'Turn requirements into working, tested, maintainable software.',
    juniorFlow: [
      'ticket assigned', 'read requirements', 'clarify ambiguity', 'inspect codebase',
      'implementation plan', 'branch', 'implement', 'write / update tests',
      'local validation', 'pull request', 'review comments', 'QA support',
      'merge / deploy', 'monitor',
    ],
    seniorFlow: [
      'feature / system problem', 'review requirements', 'assess architecture impact',
      'technical design', 'tradeoffs / dependencies', 'task breakdown',
      'align with architecture / security', 'implement / delegate',
      'code / design review', 'test coverage', 'rollout strategy',
      'production monitoring', 'post-implementation review',
    ],
    defaultArtifacts: [
      'Engineering Task Summary', 'Implementation Plan', 'Task Breakdown',
      'Test Plan', 'PR Summary',
    ],
    optionalArtifacts: [
      'Technical Design Doc', 'Architecture Decision Record', 'API Contract',
      'Rollout Plan', 'Rollback Plan', 'Post-Implementation Review',
    ],
    clarificationQuestionTypes: [
      'inputs and outputs', 'edge cases', 'data / persistence', 'auth and permissions',
      'test strategy', 'deployment and rollout',
    ],
    terminology: ['endpoint', 'schema', 'test', 'deploy', 'rollout', 'PR', 'ADR'],
  },

  it_systems_admin: {
    label: 'IT Team / Systems Admin',
    rolePurpose: 'Manage internal systems, access, devices, infrastructure, identity, integrations, and operational administration.',
    juniorFlow: [
      'IT request', 'classify request', 'verify user / approval', 'check SOP / runbook',
      'perform standard action', 'update ticket / status', 'document resolution',
      'escalate if non-standard', 'close ticket',
    ],
    seniorFlow: [
      'IT project / change', 'assess business / security impact',
      'map affected systems / users', 'define requirements / constraints',
      'solution design', 'change plan', 'approvals', 'build / configure / test',
      'rollback plan', 'deploy during change window', 'monitor impact',
      'update runbooks', 'transition to support',
    ],
    defaultArtifacts: [
      'IT Request Summary', 'Change Request', 'Change Implementation Plan',
      'Rollback Plan', 'Runbook',
    ],
    optionalArtifacts: [
      'Systems Architecture Overview', 'Access Control Matrix', 'Permissions Matrix',
      'Security Checklist', 'Monitoring Plan', 'Integration Spec', 'Post-Implementation Review',
    ],
    clarificationQuestionTypes: [
      'systems affected', 'user / access scope', 'approval / change window',
      'security and compliance', 'rollback strategy', 'monitoring and alerting',
    ],
    terminology: ['change request', 'access control', 'runbook', 'rollback', 'change window'],
  },

  it_support: {
    label: 'IT Support',
    rolePurpose: 'Resolve user-facing issues, fulfill service requests, route tickets, maintain knowledge base, and improve support operations.',
    juniorFlow: [
      'ticket / request received', 'classify incident vs service request',
      'assess priority / severity', 'gather missing info', 'search KB',
      'attempt standard resolution', 'document steps', 'escalate if unresolved',
      'confirm resolution', 'close ticket',
    ],
    seniorFlow: [
      'escalated issue or support pattern', 'assess severity / business impact',
      'coordinate response', 'stakeholder communication', 'workaround / resolution',
      'SLA tracking', 'root cause / problem handoff', 'KB / runbook update',
      'trend review', 'process improvement',
    ],
    defaultArtifacts: [
      'Ticket Summary', 'Troubleshooting Notes', 'Triage Decision Tree',
      'Escalation Summary', 'Knowledge Base Article',
    ],
    optionalArtifacts: [
      'User Communication Draft', 'SLA Report', 'Support Trend Analysis',
      'Post-Incident Review', 'Support Runbook',
    ],
    clarificationQuestionTypes: [
      'issue category and impact', 'affected user / device / app', 'urgency / SLA tier',
      'escalation owner', 'KB / runbook coverage', 'communication needs',
    ],
    terminology: ['incident', 'service request', 'SLA', 'priority', 'escalation', 'KB article'],
  },

  solutions_architect: {
    label: 'Solutions Architect',
    rolePurpose: 'Design technical solutions that meet business requirements and integrate with existing systems.',
    juniorFlow: [
      'solution request', 'gather business / technical requirements',
      'document current environment', 'identify constraints', 'research solution options',
      'draft solution outline', 'create architecture diagrams', 'support POC',
      'document assumptions / risks', 'review with senior architect / engineering',
      'refine solution package',
    ],
    seniorFlow: [
      'business / customer problem', 'understand goals / constraints / systems / stakeholders',
      'assess current architecture', 'define solution options', 'evaluate tradeoffs',
      'recommend target architecture', 'solution design document',
      'align engineering / security / ops', 'support estimation / planning',
      'guide implementation', 'validate requirements', 'go-live / handoff', 'review outcomes',
    ],
    defaultArtifacts: [
      'Requirements Summary', 'Current State Architecture', 'Future State Architecture',
      'Solution Design Document', 'Architecture Decision Records', 'Integration Spec',
    ],
    optionalArtifacts: [
      'Security Review', 'Cost Estimate', 'Migration Plan', 'Implementation Plan',
      'Operational Readiness Plan', 'Architecture Review Deck', 'Handoff Document',
    ],
    clarificationQuestionTypes: [
      'business objective and constraints', 'current systems and integrations',
      'non-functional requirements', 'security and compliance', 'cost and timeline',
      'migration and operations',
    ],
    terminology: ['target architecture', 'ADR', 'integration', 'NFR', 'migration', 'tradeoff'],
  },

  sales_account_executive: {
    label: 'Sales / Account Executive',
    rolePurpose: 'Manage opportunities from lead to close, including qualification, discovery, proposal, negotiation, and handoff.',
    juniorFlow: [
      'lead / opportunity', 'account research', 'qualification', 'discovery call',
      'pain point summary', 'stakeholder mapping', 'demo / proposal coordination',
      'follow-up', 'CRM update', 'objection handling', 'negotiation support',
      'close / disqualify', 'handoff',
    ],
    seniorFlow: [
      'strategic opportunity', 'account research / territory strategy',
      'executive discovery', 'business pain / value drivers', 'buying committee map',
      'align internal solution team', 'value hypothesis / business case',
      'tailored demo / workshop', 'proposal / commercial package',
      'security / legal / procurement', 'negotiation', 'close',
      'customer success handoff', 'expansion tracking',
    ],
    defaultArtifacts: [
      'Account Research Notes', 'Opportunity Plan', 'Discovery Summary',
      'Qualification Checklist', 'Stakeholder / Buying Committee Map',
      'Demo Plan', 'Proposal Draft',
    ],
    optionalArtifacts: [
      'Business Case / ROI Analysis', 'Mutual Action Plan', 'Commercial Proposal',
      'Legal / Procurement Tracker', 'CRM Update Summary', 'Handoff Plan', 'Expansion Plan',
    ],
    clarificationQuestionTypes: [
      'account and industry', 'champion and decision makers', 'pain and value drivers',
      'evaluation criteria and timeline', 'competitive landscape', 'commercial structure',
    ],
    terminology: ['opportunity', 'pipeline', 'qualification', 'champion', 'MEDDICC', 'proposal', 'close'],
  },

  // Fallback: 'other' or unknown role
  other: {
    label: 'Custom role',
    rolePurpose: 'Tailor outputs to the user\'s self-described role and domain.',
    juniorFlow: [], seniorFlow: [],
    defaultArtifacts: ['Intake Summary', 'Workflow Map', 'Requirements Summary'],
    optionalArtifacts: [],
    clarificationQuestionTypes: ['workflow steps', 'stakeholders', 'inputs / outputs', 'success criteria'],
    terminology: [],
  },
}

export const SENIORITY_PROFILES = {
  junior: {
    label: 'Junior / IC',
    questionDepth: 'thorough',
    questionCountTarget: '5-6',
    artifactDepth: 'execution-focused',
    behavior: 'Ask more clarifying questions, provide more guidance, generate templates / checklists, and focus on execution support. Explain reasoning where useful.',
  },
  mid: {
    label: 'Mid-Level',
    questionDepth: 'balanced',
    questionCountTarget: '4-5',
    artifactDepth: 'execution + strategy context',
    behavior: 'Balance guidance with autonomy. Generate execution artifacts plus high-level strategy context. Ask targeted clarification questions.',
  },
  senior: {
    label: 'Senior / Lead',
    questionDepth: 'strategic',
    questionCountTarget: '3-4',
    artifactDepth: 'executive-ready',
    behavior: 'Ask fewer but more strategic questions. Generate executive-ready artifacts. Include risk, strategy, governance, ROI, stakeholder alignment, and decision records.',
  },
  director: {
    label: 'Manager / Director+',
    questionDepth: 'strategic',
    questionCountTarget: '2-3',
    artifactDepth: 'portfolio / governance level',
    behavior: 'Ask 2-3 strategic, framing questions. Generate outputs at portfolio / governance level. Surface tradeoffs, ROI, risk, organizational alignment, and decision needs.',
  },
}

export const USE_CASE_LABELS = {
  apps: 'Internal tools & apps',
  automation: 'Workflow automations',
  docs: 'Documentation / artifacts',
  dashboards: 'Dashboards & reporting',
  all: 'All of the above',
  agentic: 'Agentic workflows',
}

export function getRoleFlow(roleId) {
  return ROLE_FLOWS[roleId] || ROLE_FLOWS.other
}

export function getSeniorityProfile(level) {
  return SENIORITY_PROFILES[level] || SENIORITY_PROFILES.mid
}

/**
 * Compile a role context object into a system-prompt preface that can be
 * appended to any Aria prompt. Returns '' if no role context is set.
 */
export function buildRoleContextPrompt(roleContext) {
  if (!roleContext) return ''
  const { role, customRole, seniority, intendedUseCases = [], overridden } = roleContext
  if (!role && !customRole) return ''

  const flow = getRoleFlow(role)
  const sen = getSeniorityProfile(seniority)
  const useCaseLabels = (intendedUseCases || [])
    .map(id => USE_CASE_LABELS[id])
    .filter(Boolean)

  const roleLabel = (role === 'other' && customRole) ? customRole : flow.label

  return `
USER ROLE CONTEXT — adapt every output to this role and seniority:

  Role:        ${roleLabel}${overridden ? ' (per-chat override)' : ''}
  Purpose:     ${flow.rolePurpose}
  Seniority:   ${sen.label} — ${sen.behavior}
  Use cases:   ${useCaseLabels.length ? useCaseLabels.join(', ') : '(not specified)'}

When asking clarifying questions, hit these themes:
  ${flow.clarificationQuestionTypes.map(t => `- ${t}`).join('\n  ')}

When producing artifacts, default to:
  ${flow.defaultArtifacts.map(a => `- ${a}`).join('\n  ')}

When the prompt warrants, you can also produce:
  ${flow.optionalArtifacts.map(a => `- ${a}`).join('\n  ')}

Question count target for this seniority: ${sen.questionCountTarget}.
Artifact depth: ${sen.artifactDepth}.

IMPORTANT: The user's prompt still determines the immediate task. Role context
shapes terminology, artifacts, and depth — it does NOT override what they asked
for. A PM asking for an automation still gets an automation, but with
PM-relevant scoping and artifacts where useful.
`.trim()
}

import { createMessage } from './ai-client.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found')
  return JSON.parse(match[0])
}

const ARIA_SYSTEM = `You are the core intelligence of Aria — an AI enterprise app builder.

Aria builds internal tools, workflow systems, approval portals, compliance tools, case management systems, document automation, operational command centers, and any enterprise-grade internal application.

You are an enterprise product architect, workflow automation strategist, UX designer, and full-stack engineer.

FIRST PRINCIPLES REASONING — do this before generating the spec:
1. What business problem is being solved?
2. Who is the primary user and what job are they completing?
3. What manual workflow does this replace (spreadsheet, email chain, SharePoint form, paper process)?
4. What data moves through the process?
5. Who approves, reviews, assigns, or completes work?
6. What should be automated?
7. What type of software experience best fits this workflow?

APP TYPES (examples — not a fixed menu. Invent a new type if needed):
Approval queue | Case management console | Intake portal | Vendor management | Procurement system | Compliance checklist | Audit workspace | Onboarding hub | HR request center | IT triage system | Escalation tool | Deal desk | CRM pipeline | Contract tracker | Legal matter manager | Finance reconciliation | Budget approval | Expense review | Inventory tracker | Asset management | Facilities request | Maintenance dispatch | Document wizard | Policy acknowledgment | AI knowledge portal | Operations command center | Risk workspace | Training tracker | Executive reporting | SharePoint replacement | Spreadsheet replacement | Multi-step workflow builder

LAYOUT PATTERNS — pick the one that best fits the workflow:
- "split"     → form panel left + data table right. Best for: approvals, reviews, structured data entry with a master list
- "kanban"    → horizontal status columns with cards. Best for: stage-based workflows, project tracking, anything that moves between states
- "feed"      → persistent sidebar form + scrollable card feed. Best for: intake, support tickets, ongoing logging
- "inbox"     → email-style queue with item detail panel. Best for: case management, review queues, anything you "work through"
- "wizard"    → multi-step guided form with progress. Best for: complex intake, onboarding, document generation, anything sequential
- "timeline"  → vertical chronological activity list. Best for: audit trails, project history, event logs, compliance records
- "table"     → dense filterable data table with row actions. Best for: reporting, admin management, bulk data, anything spreadsheet-like
- "pipeline"  → horizontal stage funnel with deal/item cards and metrics. Best for: sales, recruitment, procurement, stage-gated processes
- "command"   → operational overview with live stats, quick actions, assignment boards. Best for: ops, IT monitoring, dispatch, anything real-time
- "document"  → document-first workspace with form and document preview side by side. Best for: contract review, report generation, policy review
- "calendar"  → time-based scheduling and resource grid. Best for: bookings, shift scheduling, maintenance planning, event management
- "portal"    → role-based multi-section hub with tabs. Best for: employee self-service, multi-department tools, anything with very different views per role

VISUAL DESIGN — pick a visual identity that fits the business context:
- Compliance / audit / legal / risk → structured, authoritative — deep indigo #4F46E5 or slate #475569
- HR / people / onboarding / wellbeing → warm, human, guided — rose #E11D48 or warm amber #D97706
- Finance / budget / approvals / expense → clean, precise, trustworthy — violet #6D28D9 or teal #0D9488
- Operations / logistics / dispatch / facilities → dense, action-heavy — amber #D97706 or orange #EA580C
- IT / engineering / tickets / infrastructure → technical, signal-dense — electric blue #2563EB or gray-blue #475569
- Sales / CRM / pipeline / BD → energetic, conversion-focused — emerald #059669 or blue #0284C7
- Healthcare / clinical / pharma → calm, precise, protocol-aware — teal #0D9488 or blue #0284C7
- Creative / marketing / brand → expressive, modern — purple #9333EA or pink #DB2777
- Legal / contracts / policy → serious, document-heavy — dark indigo #312E81 or neutral #374151
- Product / projects / roadmap → forward-thinking, clear — sky #0284C7 or violet #7C3AED

MANDATORY QUALITY RULES:
- Never generate the same layout twice in a session
- Never reuse a color palette from a prior app
- Never force the app into a template that doesn't fit the workflow
- Domain-specific terminology everywhere — no generic labels
- Status values must reflect actual business states, not "Active / Inactive"
- Fields must be tailored to the domain — not generic "Name / Email / Description"

Return ONLY valid JSON. No explanation. No markdown.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationId, clarificationAnswers, conversationHistory } = req.body
  if (!prompt || !conversationId) return res.status(400).json({ error: 'Missing fields' })

  try {
    const context = clarificationAnswers ? `\nUser clarifications: ${clarificationAnswers}` : ''
    const historyContext = conversationHistory && conversationHistory.length > 0
      ? `\nPrior conversation context: ${conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Aria'}: ${m.content}`).filter(l => !l.endsWith(': ')).slice(-6).join(' | ')}`
      : ''

    const msg = await createMessage({
      max_tokens: 3500,
      smart: true,
      system: ARIA_SYSTEM,
      messages: [{
        role: 'user',
        content: `Generate a complete enterprise app specification for this request:

"${prompt}"${context}${historyContext}

Think through the first principles questions internally, then produce the spec.

Return this exact JSON structure:

{
  "appTitle": "Sharp, specific tool name — 2-4 words, domain-specific. No generic words like 'Manager' or 'System'",
  "appType": "The specific type of enterprise tool this is (e.g. 'Procurement Approval Queue', 'Clinical Trial Case Management', 'Vendor Onboarding Portal')",
  "tagline": "One punchy line — what it does and who it helps",
  "purpose": "2-3 sentences: the exact business problem, the workflow it replaces, and the key value",
  "designRationale": "1-2 sentences: why you chose this layout and visual direction for this specific workflow",
  "workflowType": "approval_workflow | intake_tracker | status_board",
  "layoutType": "split | kanban | feed | inbox | wizard | timeline | table | pipeline | command | document | calendar | portal",
  "visualDirection": {
    "mood": "e.g. 'authoritative and structured' or 'warm and guided' or 'dense and operational'",
    "rationale": "why this visual direction fits this domain"
  },
  "colorTheme": {
    "name": "descriptive color name e.g. 'midnight indigo' or 'clinical teal'",
    "primary": "bold saturated hex — must fit the domain",
    "light": "very light tint of primary (5-12% opacity) for backgrounds and chips",
    "text": "very dark shade of primary for body text"
  },
  "features": [
    "Verb-led feature specific to this tool (not generic)",
    "...",
    "...",
    "..."
  ],
  "fields": [
    {
      "name": "snake_case_field_name",
      "label": "Human readable label",
      "type": "text | number | email | date | select | textarea",
      "required": true,
      "options": ["only for select type"]
    }
  ],
  "statusFlow": ["Domain-specific status names — reflect real business states"],
  "primaryActionLabel": "Action verb + noun (e.g. 'Submit Request', 'Log Incident', 'Open Case')",
  "integrations": {
    "sharepoint": { "enabled": false, "reason": "only true if user mentioned SharePoint/M365 storage" },
    "outlook": { "enabled": false, "toField": null, "subject": null, "reason": "only true if user mentioned email or notifications" },
    "teams": { "enabled": false, "messageTemplate": null, "reason": "only true if user mentioned Teams" },
    "documentGeneration": { "enabled": false, "templateDescription": null, "deliveryField": null, "reason": "only true if user mentioned generating documents or reports" }
  },
  "roles": []
}

FIELD RULES:
- 4-7 fields tailored to THIS specific domain. Not generic.
- Always end with a status select field using statusFlow values as options
- Use realistic business labels (e.g. "Vendor Name", "Contract Value", "Clinical Site ID")
- field name must be snake_case matching the label

STATUS RULES:
- approval_workflow: 3 statuses (pending state → approved/rejected)
- intake_tracker: 4 statuses (new → in progress → resolved/closed)
- status_board: 4 statuses that reflect real stages for this domain
- Labels must be domain-specific: not "Active" but "Under Review" or "Awaiting Sign-off"

COLOR RULES:
- Pick from the domain-appropriate colors in the visual design guide
- Never use grey as primary
- light must be a very pale tint of primary
- text must be very dark version of primary, readable on white backgrounds

SELF-CRITIQUE before returning:
- Would this app make sense for a different industry? If yes, make it more specific.
- Are the field names generic? If yes, make them domain-specific.
- Is the layout the best fit for this workflow? If not, change it.
- Is the color appropriate for the domain? If not, change it.`
      }],
    })

    const spec = extractJSON(msg.content[0].text)

    // Normalize workflowType to valid values for backward compat with build.js
    const validWorkflowTypes = ['approval_workflow', 'intake_tracker', 'status_board']
    if (!validWorkflowTypes.includes(spec.workflowType)) {
      // Map free-form types to closest canonical type
      const wf = (spec.workflowType || '').toLowerCase()
      if (wf.includes('approv') || wf.includes('review') || wf.includes('request') || wf.includes('procure') || wf.includes('budget')) {
        spec.workflowType = 'approval_workflow'
      } else if (wf.includes('intake') || wf.includes('ticket') || wf.includes('incident') || wf.includes('support') || wf.includes('case')) {
        spec.workflowType = 'intake_tracker'
      } else {
        spec.workflowType = 'status_board'
      }
    }

    // Ensure fields have names
    if (spec.fields) {
      spec.fields = spec.fields.map(f => ({
        ...f,
        name: f.name || f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      }))
    }

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      message_type: 'confirmation',
      metadata: { cardType: 'spec', spec },
    })

    return res.json({ spec })

  } catch (err) {
    console.error('Spec error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate spec' })
  }
}

/**
 * /api/pm-document — Generate a single on-demand PM document.
 *
 * User requests a specific named document (e.g. "competitive analysis",
 * "risk assessment", "go-to-market plan"). The handler classifies the
 * request, generates the document with project context, persists it as
 * a new artifact, and posts a confirmation message to the conversation.
 *
 * Refactored 2026-05 to use orchestrator + prompts registry.
 */

import { createClient } from '@supabase/supabase-js'
import { createOrchestrator, respondWithError } from './lib/orchestrator.js'
import { PM_DOCUMENT } from './lib/prompts.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

// Map a free-form user request to a known artifact type + label + category.
// Falls back to a custom-named document if no specific type is detected.
function classifyDocumentRequest(userRequest) {
  const r = userRequest.toLowerCase()

  if (r.includes('financial model') || r.includes('financial analysis')) return { type: 'financial_model', label: 'Financial Model', category: 'financial' }
  if (r.includes('roadmap'))                                              return { type: 'product_roadmap', label: 'Product Roadmap', category: 'planning' }
  if (r.includes('persona') || r.includes('user research'))               return { type: 'user_research', label: 'User Research & Personas', category: 'product' }
  if (r.includes('use case'))                                             return { type: 'use_case_library', label: 'Use Case Library', category: 'product' }
  if (r.includes('stakeholder') && (r.includes('present') || r.includes('deck') || r.includes('slide'))) return { type: 'stakeholder_presentation', label: 'Stakeholder Presentation', category: 'presentation' }
  if (r.includes('risk') || r.includes('risk assessment'))                return { type: 'risk_assessment', label: 'Risk Assessment', category: 'governance' }
  if (r.includes('prioritiz') || r.includes('backlog'))                   return { type: 'prioritization_matrix', label: 'Prioritization Matrix', category: 'planning' }
  if (r.includes('training') || r.includes('enablement'))                 return { type: 'training_plan', label: 'Training & Enablement Plan', category: 'launch' }
  if (r.includes('post-launch') || r.includes('feedback') || r.includes('retro')) return { type: 'post_launch_plan', label: 'Post-Launch Feedback Plan', category: 'launch' }
  if (r.includes('iteration') || r.includes('sprint') || r.includes('backlog')) return { type: 'iteration_backlog', label: 'Iteration Backlog', category: 'planning' }
  if (r.includes('compliance') || r.includes('audit'))                    return { type: 'compliance_audit', label: 'Compliance Audit Document', category: 'governance' }
  if (r.includes('gdpr') || r.includes('privacy'))                        return { type: 'data_privacy', label: 'Data Privacy Assessment', category: 'governance' }
  if (r.includes('change management') || r.includes('change plan'))      return { type: 'change_management', label: 'Change Management Plan', category: 'launch' }
  if (r.includes('vendor') || r.includes('rfp') || r.includes('procurement')) return { type: 'vendor_evaluation', label: 'Vendor Evaluation Matrix', category: 'planning' }
  if (r.includes('sla') || r.includes('service level'))                   return { type: 'sla_document', label: 'SLA & Service Level Agreement', category: 'governance' }
  if (r.includes('api'))                                                  return { type: 'api_documentation', label: 'API Documentation', category: 'technical' }

  // Default: custom document with a slugified type + title-cased label
  const words = userRequest.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/)
  const slug = words.slice(0, 4).join('_').toLowerCase()
  const label = words.slice(0, 5).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return { type: `custom_${slug}`, label, category: 'custom' }
}

const PM_DOCUMENT_USER_TEMPLATE = `Generate a "{{label}}" document for this project.

User request: "{{userRequest}}"{{context}}

Create a detailed, professional document appropriate for an enterprise PM workflow.
The document must be:
- Specific to the domain and project described
- Structured with clear sections
- Ready for stakeholder review
- Not generic or templated

Return a single JSON object. Structure it appropriately for this document type with relevant sections, tables, and content. Use domain-specific language throughout.

For reference, here are example structures by category:
- Planning docs: include sections, timelines, priorities, owners, success metrics
- Financial docs: include tables with numbers, categories, totals, assumptions
- Technical docs: include components, flows, specifications, requirements
- Governance docs: include checklists, policies, roles, compliance items
- Launch docs: include timelines, audiences, actions, owners, dates`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { conversationId, userRequest, projectContext, aiModel } = req.body
  if (!conversationId || !userRequest) {
    return res.status(400).json({ error: 'Missing required fields: conversationId, userRequest' })
  }

  const docInfo = classifyDocumentRequest(userRequest)

  const orch = createOrchestrator({
    workflow: 'pm_document',
    aiModel,
    traceContext: {
      conversationId,
      documentType: docInfo.type,
      category: docInfo.category,
    },
  })

  try {
    const contextStr = projectContext ? `\nProject context: ${JSON.stringify(projectContext, null, 2)}` : ''
    const userPrompt = PM_DOCUMENT_USER_TEMPLATE
      .replace('{{label}}', docInfo.label)
      .replace('{{userRequest}}', userRequest)
      .replace('{{context}}', contextStr)

    const content = await orch.json('generate_pm_document', {
      tier: 'smart',
      maxTokens: 6000,
      system: PM_DOCUMENT,
      prompt: userPrompt,
    })

    // Get userId from conversation
    const { data: conv } = await supabase.from('conversations').select('user_id').eq('id', conversationId).single()
    const userId = conv?.user_id || null

    // Save as artifact
    const { data: artifact, error: artErr } = await supabase
      .from('artifacts')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        artifact_type: docInfo.type,
        title: docInfo.label,
        content,
        source_prompt: userRequest,
        version: 1,
        status: 'draft',
        file_urls: {},
        metadata: { userRequested: true, category: docInfo.category, traceId: orch.traceId },
      })
      .select()
      .single()

    if (artErr) throw new Error('Failed to save document: ' + artErr.message)

    // Save confirmation message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: `I've created the **${docInfo.label}** document and added it to your project assets.`,
      message_type: 'text',
      metadata: { generatedArtifactId: artifact.id, traceId: orch.traceId },
    })

    orch.end({ artifactId: artifact.id, documentType: docInfo.type })
    return res.json({ artifact, docInfo, traceId: orch.traceId })
  } catch (err) {
    return respondWithError(res, err, orch)
  }
}

/**
 * Shared AI client — Multi-provider with smart failover (Gemini-first).
 * Primary: Gemini (1M tokens/min free tier, generous for dev).
 * Fallbacks: Claude → Groq → Ollama.
 * All return the same shape: { content: [{ text: string }] }
 */
import Groq from 'groq-sdk'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_MODEL_FAST = 'gemini-2.5-flash'   // Gemini primary — latest flash (fast + high quality, free tier)
// NOTE: gemini-2.5-pro has a FREE-TIER quota of literally 0 (Google requires a paid
// billing account for Pro), so "smart" calls on Pro 429 immediately. To stay 100% on
// the free tier we route smart calls to Flash too — same 1M-tokens/min free quota.
const GEMINI_MODEL_SMART = 'gemini-2.5-flash'  // Free-tier safe (Pro free quota = 0)
const GEMINI_MAX_TOKENS = 8000

const ANTHROPIC_MODEL   = 'claude-haiku-4-5'         // Fallback — fast + cheap
const ANTHROPIC_SMART   = 'claude-opus-4-7'          // Fallback for smart calls

const GROQ_MODEL_FAST   = 'llama-3.1-8b-instant'     // Fallback on primary exhaustion
const GROQ_MODEL_SMART  = 'llama-3.3-70b-versatile'  // Fallback for smart calls
const GROQ_MAX_TOKENS   = 8000

// Tracks the last time an INTENDED Claude call was forced to degrade to Groq
// (e.g. Anthropic out of credits / rate limited). Cleared on the next successful
// Claude call. The frontend reads this via GET /api/model-status to show a banner.
let _lastFallback = null
// Auto-expire a stale fallback so the degraded banner clears on its own once the
// user stops making Claude calls (e.g. after switching to Ollama).
const FALLBACK_TTL_MS = 120_000
export function getModelStatus() {
  if (_lastFallback && (Date.now() - (_lastFallback.at || 0)) > FALLBACK_TTL_MS) {
    _lastFallback = null
  }
  return _lastFallback
    ? { degraded: true, ..._lastFallback }
    : { degraded: false }
}

const gemini = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null

function parseRetryAfter(errMsg) {
  const match = (errMsg || '').match(/try again in (\d+\.?\d*)s/i)
  return match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : null
}

/**
 * Development mode: return realistic mock responses for testing without API costs.
 * Simulates Claude's actual response format and logic.
 */
function getMockResponse(system, messages, { max_tokens, smart, modelTier }) {
  const userContent = messages[messages.length - 1]?.content || ''

  // Detect what kind of response is being asked for based on the user message
  if (userContent.includes('Analyze the request') || userContent.includes('build mode')) {
    return {
      content: [{
        text: JSON.stringify({
          intro: "I'll help you build this. Let me understand the scope and complexity.",
          recommendedMode: 'guided',
          complexityReason: 'This workflow involves multiple roles and approval steps, so Guided Build will produce a better result.'
        })
      }]
    }
  }

  if (userContent.includes('Generate 4-7 targeted clarifying questions')) {
    return {
      content: [{
        text: JSON.stringify({
          intro: 'Perfect. To design this accurately, I have a few clarifying questions:',
          questions: [
            { type: 'short_answer', question: 'Who are the primary users of this system?', placeholder: 'e.g., Managers, Finance Team, All employees...' },
            { type: 'multiple_choice', question: 'What is the main business problem this solves?', options: ['Replacing a manual process', 'Improving visibility/reporting', 'Enforcing compliance', 'Automating workflow'] },
            { type: 'multi_select', question: 'Which systems need to integrate?', options: ['Microsoft 365 / Teams', 'Email', 'SharePoint', 'None for now'] },
            { type: 'yes_no', question: 'Are there approval/sign-off requirements?' },
            { type: 'short_answer', question: 'What is the timeline?', placeholder: 'e.g., 4 weeks, Q3 2025...' }
          ]
        })
      }]
    }
  }

  if (userContent.includes('enterprise product brief') || userContent.includes('Generate a complete')) {
    return {
      content: [{
        text: JSON.stringify({
          intakeSummary: {
            understood: 'You need an approval workflow system for procurement requests with multi-level authorization.',
            businessProblem: 'Currently, approvals happen via email chains and spreadsheets, causing delays and lost audit trails.',
            primaryUsers: ['Procurement Manager', 'Department Manager', 'CFO'],
            secondaryUsers: ['Finance Analyst'],
            currentProcess: 'Email-based approval chain with manual tracking in shared spreadsheet',
            mainOutcome: 'Reduce approval time from 5 days to 1 day with full audit trail'
          },
          productBrief: {
            objective: 'Build a procurement approval workflow that routes requests based on amount and enforces proper sign-off.',
            userRoles: [
              { role: 'Requester', access: 'Submit requests, view own requests', estimated: '50' },
              { role: 'Manager', access: 'Review and approve/reject direct reports requests', estimated: '20' },
              { role: 'CFO', access: 'Override and final approval for >$50K', estimated: '3' }
            ],
            coreWorkflows: [
              'Requester submits purchase request → Routed to Manager → Routed to CFO if >$50K → Requester notified',
              'Approver can request clarification, which sends request back to Requester'
            ],
            businessRules: [
              'Requests <$10K only need Manager approval',
              'Requests $10K-$50K need Manager + Director approval',
              'Requests >$50K need CFO sign-off',
              'All rejections require written reason'
            ],
            successCriteria: [
              '90% of approvals completed within 24 hours',
              '100% audit trail captured',
              'Zero manual follow-up emails needed'
            ],
            assumptions: ['All approvers are on same tenant', 'Email notifications via Teams'],
            openQuestions: ['Should rejected requests auto-restart or require manual resubmit?']
          },
          workflowMap: {
            trigger: 'Requester clicks "New Purchase Request"',
            steps: [
              { step: 'Submit request', actor: 'Requester', action: 'Fill form, attach PO, submit', output: 'Request created', sla: null },
              { step: 'Manager review', actor: 'Manager', action: 'Review and approve/reject/request info', output: 'Manager decision', sla: '24h' },
              { step: 'Route to CFO?', actor: 'System', action: 'Check if amount >$50K', output: 'Route decision', sla: null },
              { step: 'CFO approval', actor: 'CFO', action: 'Final sign-off', output: 'CFO decision', sla: '48h' }
            ],
            decisionPoints: ['Is amount >$50K? → Route to CFO : Approved', 'Manager approved? → Continue : Rejected'],
            exceptionPaths: ['Request info needed → Return to Requester for clarification', 'Rejected → Notify requester with reason']
          },
          dataModel: {
            primaryEntity: 'PurchaseRequest',
            fields: [
              { name: 'title', label: 'Request Title', type: 'text', required: true, options: [] },
              { name: 'amount', label: 'Requested Amount ($)', type: 'number', required: true, options: [] },
              { name: 'justification', label: 'Business Justification', type: 'textarea', required: true, options: [] },
              { name: 'department', label: 'Department', type: 'select', required: true, options: ['Sales', 'Marketing', 'Operations', 'IT', 'HR'] },
              { name: 'vendor', label: 'Vendor/Supplier', type: 'text', required: true, options: [] },
              { name: 'status', label: 'Status', type: 'select', required: false, options: [] }
            ],
            statusFlow: ['Draft', 'Pending Manager', 'Pending CFO', 'Approved', 'Rejected'],
            relationships: ['CreatedBy → User', 'ApprovedBy → User', 'Department → Organization'],
            auditFields: ['created_at', 'created_by', 'updated_at', 'last_action_by']
          },
          automationModel: {
            triggers: [
              { event: 'Request submitted', condition: 'status=Pending Manager', action: 'Send notification to Manager' },
              { event: 'Manager approved', condition: 'amount>50000', action: 'Route to CFO and send notification' },
              { event: 'CFO approved', condition: 'always', action: 'Send approval to Requester and create PO' }
            ],
            notifications: [
              { event: 'New request', recipient: 'Manager', channel: 'Teams', template: 'You have a new approval request: {title}' },
              { event: 'Request rejected', recipient: 'Requester', channel: 'Email', template: 'Your request was rejected. Reason: {rejectionReason}' }
            ],
            escalations: [
              { condition: 'Manager approval pending >2 days', action: 'Send reminder', recipient: 'Manager' },
              { condition: 'CFO approval pending >3 days', action: 'Escalate to CFO Manager', recipient: 'CFO Manager' }
            ],
            documentGeneration: [],
            integrations: []
          },
          uxRecommendation: {
            layoutType: 'split_panel_review',
            navigationModel: 'Single page',
            primaryScreens: [
              { screen: 'Request Queue', purpose: 'See all pending approvals with filters', keyActions: ['Approve', 'Reject', 'Request Info'] },
              { screen: 'Request Detail', purpose: 'Review full request and make decision', keyActions: ['Approve with comment', 'Reject with reason'] }
            ],
            visualTheme: {
              mood: 'authoritative',
              primaryColor: '#4F46E5',
              colorName: 'Indigo',
              rationale: 'Finance/approval workflows need structured, trustworthy feel. Indigo conveys authority and precision.'
            },
            rationale: 'Split panel (queue left, detail right) is ideal for approval workflows. Users need to see the queue and work through items sequentially.'
          },
          appSpec: {
            appTitle: 'Approval Queue',
            appType: 'Procurement Approval System',
            tagline: 'Streamline purchase approvals with transparent routing and full audit trail.',
            purpose: 'Replace email-based approval chains with a structured workflow that routes requests based on amount, enforces proper sign-off, and creates complete audit trails for compliance.',
            workflowType: 'approval_workflow',
            layoutType: 'split_panel_review',
            colorTheme: {
              name: 'Indigo',
              primary: '#4F46E5',
              light: '#EEF2FF',
              text: '#1F2937'
            },
            features: [
              'Route requests based on amount thresholds',
              'Track approval history with timestamps',
              'Request clarification and send back to requester',
              'Email notifications at each approval step',
              'Bulk approve similar requests',
              'Executive dashboard with pending approvals'
            ],
            fields: [
              { name: 'title', label: 'Request Title', type: 'text', required: true, options: [] },
              { name: 'amount', label: 'Amount ($)', type: 'number', required: true, options: [] },
              { name: 'justification', label: 'Business Justification', type: 'textarea', required: true, options: [] },
              { name: 'department', label: 'Department', type: 'select', required: true, options: ['Sales', 'Marketing', 'Operations', 'IT', 'HR'] },
              { name: 'vendor', label: 'Vendor', type: 'text', required: true, options: [] }
            ],
            statusFlow: ['Draft', 'Pending Manager', 'Pending CFO', 'Approved', 'Rejected'],
            primaryActionLabel: 'Submit Request',
            integrations: {
              sharepoint: { enabled: false, reason: '' },
              outlook: { enabled: true, toField: 'approver_email', subject: 'New approval: {title}', reason: 'Notify approvers via email' },
              teams: { enabled: true, messageTemplate: 'New approval needed: {title} for ${amount}', reason: 'Post to Teams for visibility' },
              documentGeneration: { enabled: false, templateDescription: null, deliveryField: null, reason: '' }
            },
            roles: []
          }
        })
      }]
    }
  }

  // Fallback: generic response
  return {
    content: [{
      text: JSON.stringify({
        type: 'response',
        message: 'Mock response for development',
        metadata: { mode: 'MOCK_RESPONSES' }
      })
    }]
  }
}

async function callGeminiFallback({ system, messages, max_tokens, smart, json = false }) {
  if (!gemini) throw new Error('Gemini not configured — set GOOGLE_API_KEY')
  const model = smart ? GEMINI_MODEL_SMART : GEMINI_MODEL_FAST
  const safetySettings = [
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
  ]

  try {
    const genModel = gemini.getGenerativeModel({ model, safetySettings })
    let fullPrompt = ''
    if (system) fullPrompt += system + '\n\n'
    for (const m of messages) {
      fullPrompt += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n`
    }

    const res = await genModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: Math.min(max_tokens, GEMINI_MAX_TOKENS),
        // Native JSON mode — forces syntactically valid JSON with no markdown
        // fences or prose, which is what large structured docs/specs need to parse.
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    })

    // Track token usage from Gemini metadata
    const meta = res.response.usageMetadata
    if (meta) {
      const { trackUsage, setCurrentProvider } = await import('./lib/tokenTracker.js')
      trackUsage('gemini', { inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 })
      setCurrentProvider('gemini')
    }

    const text = res.response.text?.() || res.response.text
    console.log(`[ai-client] Used Gemini (${model})`)
    return { content: [{ text }] }
  } catch (err) {
    throw new Error(`Gemini error: ${err?.message || String(err)}`)
  }
}

async function callGroqFallback({ system, messages, max_tokens, smart }) {
  if (!groq) throw new Error('Groq not configured — set GROQ_API_KEY for rate-limit fallback')
  const model = smart ? GROQ_MODEL_SMART : GROQ_MODEL_FAST
  const groqMessages = []
  if (system) groqMessages.push({ role: 'system', content: system })
  groqMessages.push(...messages.map(m => ({ role: m.role, content: m.content })))
  const res = await groq.chat.completions.create({
    model,
    messages: groqMessages,
    max_tokens: Math.min(max_tokens, GROQ_MAX_TOKENS),
    temperature: 0.3,
  })

  // Track token usage from Groq response
  if (res.usage) {
    const { trackUsage, setCurrentProvider } = await import('./lib/tokenTracker.js')
    trackUsage('groq', { inputTokens: res.usage.prompt_tokens || 0, outputTokens: res.usage.completion_tokens || 0 })
    setCurrentProvider('groq')
  }

  console.warn(`[ai-client] Used Groq fallback (${model})`)
  return { content: [{ text: res.choices[0].message.content }] }
}

async function callOllamaFallback({ system, messages, max_tokens }) {
  // Call local Ollama instance (http://localhost:11434 by default)
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral'

  try {
    const ollamaMessages = []
    if (system) ollamaMessages.push({ role: 'system', content: system })
    ollamaMessages.push(...messages.map(m => ({ role: m.role, content: m.content })))

    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: false,
      })
    })

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
    const data = await res.json()
    console.log(`[ai-client] Used Ollama (${OLLAMA_MODEL})`)
    return { content: [{ text: data.message?.content || '' }] }
  } catch (err) {
    console.error('[ai-client] Ollama error:', err.message)
    throw new Error(`Ollama not available at ${OLLAMA_URL}. Is it running? (ollama serve)`)
  }
}

/**
 * Unified createMessage() — Gemini primary (1M tokens/min free), then Claude, then Groq.
 * Includes timeout (30s), retry logic, and graceful fallback.
 * When MOCK_RESPONSES=true, returns realistic mock data (for dev/testing without API credits).
 * Returns { content: [{ text: string }] }
 *
 * @param {object}  opts
 * @param {string}  [opts.system]
 * @param {Array}   opts.messages
 * @param {number}  [opts.max_tokens=4000]
 * @param {boolean} [opts.smart=false]    — true uses Opus instead of Haiku
 * @param {string}  [opts.modelTier]      — 'fast'|'medium'|'smart' (maps to smart flag)
 * @param {number}  [opts.timeout=30000]  — timeout in ms
 */
export async function createMessage({ system, messages, max_tokens = 4000, smart = false, modelTier, timeout = 30000, aiModel, expectJson = false }) {
  // Resolve which model to use — explicit param > env default > gemini (primary free tier).
  const resolvedModel = aiModel || process.env.DEFAULT_AI_MODEL || 'gemini'

  // Dev mode: return mock responses without hitting the API
  if (process.env.MOCK_RESPONSES === 'true') {
    return getMockResponse(system, messages, { max_tokens, smart, modelTier })
  }

  // Route to the explicitly selected AI model. CRITICAL: even when a specific
  // provider is selected, fail over on error — a Gemini 503 ("high demand") or
  // quota hit must NOT hard-fail doc/design generation. Order: selected → the
  // other cloud providers → Claude. (App builds that need a hard pin use the
  // modelRouter's __noFailover path instead; this is the resilient default.)
  const wantSmart = smart || modelTier === 'smart'
  async function claudeDirect() {
    if (!anthropic) throw new Error('Anthropic not configured')
    const res = await anthropic.messages.create({ model: wantSmart ? ANTHROPIC_SMART : ANTHROPIC_MODEL, max_tokens, system, messages })
    if (res?.usage) {
      const { trackUsage, setCurrentProvider } = await import('./lib/tokenTracker.js')
      trackUsage('claude', { inputTokens: res.usage.input_tokens || 0, outputTokens: res.usage.output_tokens || 0 })
      setCurrentProvider('claude')
    }
    return res
  }
  // Try a chain of provider thunks in order; return the first success, marking the
  // degraded-provider banner when we move off the selected one.
  async function tryChain(label, chain) {
    const errs = []
    for (let i = 0; i < chain.length; i++) {
      try {
        const r = await chain[i].fn()
        _lastFallback = i === 0 ? null : { reason: 'error', provider: chain[i].name, model: null, at: Date.now() }
        return r
      } catch (e) {
        errs.push(`${chain[i].name}: ${e?.message || e}`)
        console.warn(`[ai-client] ${chain[i].name} failed (${e?.message || e})${i < chain.length - 1 ? ' — failing over' : ''}`)
      }
    }
    throw new Error(`All providers failed for ${label}. ${errs.join(' | ')}`)
  }

  if (resolvedModel === 'groq' && groq) {
    return tryChain('groq-selected', [
      { name: 'groq', fn: () => callGroqFallback({ system, messages, max_tokens, smart: wantSmart }) },
      ...(gemini ? [{ name: 'gemini', fn: () => callGeminiFallback({ system, messages, max_tokens, smart: wantSmart, json: expectJson }) }] : []),
      ...(anthropic ? [{ name: 'claude', fn: claudeDirect }] : []),
    ])
  }
  if (resolvedModel === 'gemini' && gemini) {
    return tryChain('gemini-selected', [
      { name: 'gemini', fn: () => callGeminiFallback({ system, messages, max_tokens, smart: wantSmart, json: expectJson }) },
      ...(groq ? [{ name: 'groq', fn: () => callGroqFallback({ system, messages, max_tokens, smart: wantSmart }) }] : []),
      ...(anthropic ? [{ name: 'claude', fn: claudeDirect }] : []),
    ])
  }
  if (resolvedModel === 'ollama') {
    // Pure Ollama — NO Groq/Claude fallback (per user: Ollama is the standard, always).
    // One retry in case the model is cold-loading, then a clear error if it's down.
    try {
      return await callOllamaFallback({ system, messages, max_tokens })
    } catch (ollamaErr) {
      console.warn('[ai-client] Ollama call failed, retrying once:', ollamaErr.message)
      try {
        return await callOllamaFallback({ system, messages, max_tokens })
      } catch (retryErr) {
        _lastFallback = null // not a credits/Claude issue
        throw new Error(`Ollama is not responding. Make sure it's running ("ollama serve") and the model "${process.env.OLLAMA_MODEL || 'mistral'}" is pulled. (${retryErr.message})`)
      }
    }
  }

  // Default: Try Gemini first (free, generous tier), then fall back to Claude
  const useSmart = smart || modelTier === 'smart'

  // Step 1: Try Gemini (primary) if configured
  if (gemini) {
    try {
      console.log(`[ai-client] Trying Gemini (${useSmart ? GEMINI_MODEL_SMART : GEMINI_MODEL_FAST}) as primary provider`)
      const result = await callGeminiFallback({ system, messages, max_tokens, smart: useSmart, json: expectJson })
      _lastFallback = null
      return result
    } catch (geminiErr) {
      console.warn(`[ai-client] Gemini failed (${geminiErr.message}) — falling back to Claude`)
    }
  }

  // Step 2: Fall back to Claude
  const model = useSmart ? ANTHROPIC_SMART : ANTHROPIC_MODEL
  const MAX_RETRIES = 2
  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`API timeout after ${timeout}ms`)), timeout)
      )

      // Race the API call against timeout
      const res = await Promise.race([
        anthropic.messages.create({ model, max_tokens, system, messages }),
        timeoutPromise
      ])

      // Claude succeeded — track tokens and clear prior degraded state.
      if (res?.usage) {
        const { trackUsage, setCurrentProvider } = await import('./lib/tokenTracker.js')
        trackUsage('claude', { inputTokens: res.usage.input_tokens || 0, outputTokens: res.usage.output_tokens || 0 })
        setCurrentProvider('claude')
      }
      _lastFallback = null
      return res
    } catch (err) {
      lastError = err
      const status = err.status || err.statusCode
      const errMsg = err.message || ''
      const isTimeout = errMsg.includes('timeout')
      const isCreditsError = status === 400 && (errMsg.includes('credit balance') || errMsg.includes('billing') || errMsg.includes('low to access'))
      const isTransient = isTimeout || status === 429 || status === 500 || status === 502 || status === 503 || status === 529

      // Retry on transient errors (not credits errors — those won't fix with a retry)
      if (isTransient && !isCreditsError && attempt < MAX_RETRIES) {
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 500
        console.warn(`[ai-client] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed (${status || 'timeout'}) — retrying in ${Math.round(backoffMs)}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        continue
      }

      // Fall back through the chain: Gemini (primary) → Groq → error
      if ((status === 429 || status === 529 || status >= 500 || isCreditsError)) {
        console.warn(`[ai-client] Anthropic ${isCreditsError ? 'credits exhausted' : status} — trying Gemini (primary)`)
        if (gemini) {
          try {
            _lastFallback = {
              reason: isCreditsError ? 'credits' : (status === 429 ? 'rate_limit' : 'error'),
              provider: 'gemini',
              model: useSmart ? GEMINI_MODEL_SMART : GEMINI_MODEL_FAST,
              at: Date.now(),
            }
            return await callGeminiFallback({ system, messages, max_tokens, smart: useSmart, json: expectJson })
          } catch (geminiErr) {
            console.warn(`[ai-client] Gemini failed (${geminiErr.message}) — falling back to Groq`)
            if (groq) {
              try {
                _lastFallback = {
                  reason: isCreditsError ? 'credits' : (status === 429 ? 'rate_limit' : 'error'),
                  provider: 'groq',
                  model: useSmart ? GROQ_MODEL_SMART : GROQ_MODEL_FAST,
                  at: Date.now(),
                }
                return await callGroqFallback({ system, messages, max_tokens, smart: useSmart })
              } catch (groqErr) {
                throw new Error(`All providers failed. Anthropic: ${lastError.message}. Gemini: ${geminiErr.message}. Groq: ${groqErr.message}`)
              }
            } else {
              throw new Error(`Anthropic and Gemini failed, Groq not configured. Anthropic: ${lastError.message}. Gemini: ${geminiErr.message}`)
            }
          }
        } else if (groq) {
          console.warn(`[ai-client] Gemini not configured — falling back to Groq`)
          try {
            _lastFallback = {
              reason: isCreditsError ? 'credits' : (status === 429 ? 'rate_limit' : 'error'),
              provider: 'groq',
              model: useSmart ? GROQ_MODEL_SMART : GROQ_MODEL_FAST,
              at: Date.now(),
            }
            return await callGroqFallback({ system, messages, max_tokens, smart: useSmart })
          } catch (groqErr) {
            throw new Error(`Both Anthropic and Groq failed. Anthropic: ${lastError.message}. Groq: ${groqErr.message}`)
          }
        } else {
          throw new Error(`All fallback providers exhausted/unavailable: Anthropic ${status}, Gemini not configured, Groq not configured`)
        }
      }

      // Non-transient error or no fallback available
      throw err
    }
  }

  throw lastError || new Error('Failed to get AI response after retries')
}

export { GEMINI_MODEL_FAST, GEMINI_MODEL_SMART, ANTHROPIC_MODEL, ANTHROPIC_SMART, GROQ_MODEL_FAST, GROQ_MODEL_SMART }

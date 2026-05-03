/**
 * Shared AI client — uses Groq if GROQ_API_KEY is set, otherwise Anthropic.
 * Groq uses an OpenAI-compatible API with Llama models (free tier available).
 * Both return the same shape: { content: [{ text: '...' }] }
 */
import Groq from 'groq-sdk'
import Anthropic from '@anthropic-ai/sdk'

const USE_GROQ = !!process.env.GROQ_API_KEY

// Groq models — 8b-instant has 20K TPM (vs 12K for 70b), still excellent quality
const GROQ_MODEL_FAST = 'llama-3.1-8b-instant'   // simple tasks: clarification, build mode
const GROQ_MODEL_SMART = 'llama-3.3-70b-versatile' // complex tasks: spec, brief generation
// Anthropic fallback model
const ANTHROPIC_MODEL = 'claude-opus-4-7'

const groq = USE_GROQ ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null
const anthropic = !USE_GROQ ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null

// Groq free-tier TPM limits per model:
//   llama-3.1-8b-instant:    20,000 TPM  ← use for most calls
//   llama-3.3-70b-versatile: 12,000 TPM  ← only when quality critical + keep tokens low
// Groq hard cap: max_tokens cannot exceed 8192 on free tier

const GROQ_MAX_TOKENS_CAP = 8000 // never request more than this from Groq

/**
 * Unified create() — same interface as anthropic.messages.create()
 * Returns { content: [{ text: string }] }
 *
 * @param {object} opts
 * @param {string}  opts.system
 * @param {Array}   opts.messages
 * @param {number}  [opts.max_tokens=4000]
 * @param {boolean} [opts.smart=false]  — true uses the 70b model (higher quality, lower TPM)
 */
export async function createMessage({ system, messages, max_tokens = 4000, smart = false }) {
  if (USE_GROQ) {
    const groqMessages = []
    if (system) groqMessages.push({ role: 'system', content: system })
    groqMessages.push(...messages.map(m => ({ role: m.role, content: m.content })))

    // Cap output tokens and pick model
    const cappedTokens = Math.min(max_tokens, GROQ_MAX_TOKENS_CAP)
    const model = smart ? GROQ_MODEL_SMART : GROQ_MODEL_FAST

    const res = await groq.chat.completions.create({
      model,
      messages: groqMessages,
      max_tokens: cappedTokens,
      temperature: 0.3,
    })
    return { content: [{ text: res.choices[0].message.content }] }
  } else {
    const res = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens,
      system,
      messages,
    })
    return res
  }
}

export { USE_GROQ, GROQ_MODEL_FAST, GROQ_MODEL_SMART, ANTHROPIC_MODEL }

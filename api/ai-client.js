/**
 * Shared AI client — uses Groq if GROQ_API_KEY is set, otherwise Anthropic.
 * Groq uses an OpenAI-compatible API with Llama models (free tier available).
 * Both return the same shape: { content: [{ text: '...' }] }
 */
import Groq from 'groq-sdk'
import Anthropic from '@anthropic-ai/sdk'

const USE_GROQ = !!process.env.GROQ_API_KEY

// Groq model — best available on free tier
const GROQ_MODEL = 'llama-3.3-70b-versatile'
// Anthropic fallback model
const ANTHROPIC_MODEL = 'claude-opus-4-7'

const groq = USE_GROQ ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null
const anthropic = !USE_GROQ ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null

/**
 * Unified create() — same interface as anthropic.messages.create()
 * Returns { content: [{ text: string }] }
 */
export async function createMessage({ system, messages, max_tokens = 4000 }) {
  if (USE_GROQ) {
    const groqMessages = []
    if (system) groqMessages.push({ role: 'system', content: system })
    groqMessages.push(...messages.map(m => ({ role: m.role, content: m.content })))

    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: groqMessages,
      max_tokens,
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

export { USE_GROQ, GROQ_MODEL, ANTHROPIC_MODEL }

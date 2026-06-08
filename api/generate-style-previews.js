/**
 * /api/generate-style-previews — Generate 3 DISTINCT design-direction previews
 * for the app-build carousel.
 *
 * Before Aria builds the real app, the user is shown three different visual
 * directions (a static, good-looking representative screen for each) so they can
 * SEE what their product could look like and pick a vibe. When they pick one and
 * hit Next (with an optional edit/opinion note), that chosen style is threaded
 * into the real build via the generate-app `context.chosenStyle`.
 *
 * Each preview is a single self-contained /App.js (Sandpack-runnable; AppPreview
 * auto-injects the scaffold). We generate the three in parallel for speed, each
 * locked to a different palette/mood/layout preset so they look genuinely
 * different — not three shades of the same dashboard.
 */

import { generateWithModel } from './lib/modelRouter.js'
import { parse } from '@babel/parser'

/**
 * Validate that a generated preview file is syntactically valid JSX. Returns
 * { ok: true } or { ok: false, error: '<message + line>' }. This is the design-
 * phase equivalent of the app build's compile check — a broken preview (e.g. the
 * model truncated mid-statement) is caught here and auto-repaired before it ever
 * reaches the carousel, so the user never sees a Sandpack syntax error.
 */
function validatePreview(code) {
  if (!code || code.trim().length < 40) return { ok: false, error: 'Preview code is empty or too short (likely truncated).' }
  try {
    parse(code, { sourceType: 'module', plugins: ['jsx'] })
    return { ok: true }
  } catch (err) {
    const loc = err?.loc ? ` (line ${err.loc.line}:${err.loc.column})` : ''
    return { ok: false, error: `${err?.message || String(err)}${loc}` }
  }
}

const PREVIEW_REPAIR_SYSTEM = `You are fixing a broken React preview file. It failed to parse/compile. Return the COMPLETE corrected file — same design intent, same content — but syntactically valid.

Hard rules (unchanged):
- ONE self-contained file: "export default function App()". Import ONLY from "react". NO local/relative imports.
- Tailwind classes for ALL styling. NO external libraries, NO image URLs (use emojis/colored divs).
- The file must be COMPLETE — never truncate. Close every brace, parenthesis, tag, and statement.
Output ONLY the raw corrected file contents (valid JS/JSX). No markdown, no backticks, no commentary.`

/** Run one AI repair pass on a broken preview file, given the parser error. */
async function repairPreview({ code, error, preset, prompt, providerConfig, aiModel }) {
  const fixed = await generateWithModel({
    taskType: 'repair',
    tier: 'balanced',
    system: PREVIEW_REPAIR_SYSTEM,
    prompt: `Product: "${prompt}". Design direction: "${preset.label}".\n\nThis preview file failed to compile with error:\n${error}\n\nBroken file:\n${code}\n\nReturn the complete, corrected, syntactically-valid file.`,
    providerConfig,
    aiModel,
    maxTokens: 6000,
    expectedOutputFormat: 'text',
  })
  return String(fixed || '')
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim()
}

// Three deliberately different design directions. The model fills these with the
// user's actual app concept, but stays inside the preset's palette + layout so
// the three previews read as distinct choices.
const STYLE_PRESETS = [
  {
    id: 'minimal_light',
    label: 'Clean & Minimal',
    vibe: 'Bright, airy, Vercel/Linear-grade. White and light-slate surfaces, one restrained accent, generous whitespace, crisp typography.',
    direction: 'Light theme. Background white or slate-50. Cards: white, rounded-2xl, subtle slate-200 border, soft shadow. ONE accent color (indigo or blue) used only for the primary action and key highlights. Lots of whitespace, calm and confident. Tabular-nums for any numbers.',
  },
  {
    id: 'bold_dark',
    label: 'Bold & Modern',
    vibe: 'Dark, high-contrast, premium. Near-black background, vivid accent, glow on the primary action, big confident type.',
    direction: 'Dark theme. Background slate-950 / zinc-950. Cards: slate-900 with slate-800 border and a soft shadow. A vivid accent (emerald, violet, or cyan) used for the primary action with a subtle glow/ring. Large bold headings, strong hierarchy, energetic but not noisy.',
  },
  {
    id: 'warm_editorial',
    label: 'Warm & Friendly',
    vibe: 'Approachable, human, editorial. Warm neutrals (stone/amber), rounded friendly shapes, soft accents, inviting tone.',
    direction: 'Warm light theme. Background stone-50 / amber-50. Cards: white/stone-50, rounded-2xl, stone-200 border, gentle shadow. Warm accent (amber, orange, or rose). Friendly, rounded, generous padding, a touch of personality (a tasteful emoji accent). Readable and welcoming.',
  },
]

const PREVIEW_SYSTEM_BASE = `You are a senior product designer + React engineer producing ONE static, beautiful PREVIEW screen (not the full app) so a user can judge a visual direction for their product.

This is a DESIGN MOCKUP: it should look like a real, polished screen of the described product, with realistic seeded sample content — but it does NOT need full interactivity. Make it gorgeous and representative at a glance.

Hard rules:
- ONE self-contained file: "export default function App()". Import ONLY from "react". NO local/relative imports.
- Tailwind classes for ALL styling (Tailwind is loaded globally — do NOT import it, no CSS files).
- NO external libraries, NO npm installs, NO network/API calls, NO image URLs (use emojis and colored divs).
- Fill it with realistic sample data for THIS product (real-looking names, numbers, labels) — never lorem ipsum, never "TODO".
- min-h-screen, responsive, a real header/title, and the key sections the product would have.
- TAILWIND CLASSES MUST BE REAL — use only stock Tailwind palette classes (slate, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose with shades 50–950) or arbitrary [#hex] values. NEVER invent class names like bg-deep-charcoal — invented classes render as nothing.
- Buttons, inputs, badges, tabs: always intentionally styled with hover/transition states.

Output ONLY the raw file contents (valid JS/JSX). No markdown, no backticks, no commentary.`

async function generateOnePreview({ preset, prompt, context, providerConfig, aiModel, feedback }) {
  const fb = (feedback || '').trim()
  const system = `${PREVIEW_SYSTEM_BASE}

DESIGN DIRECTION FOR THIS PREVIEW — "${preset.label}":
${preset.direction}

Stay inside this direction's palette and mood. The goal is that this preview looks clearly DIFFERENT from other directions while still fitting the product.${fb ? `\n\nUSER'S DESIGN FEEDBACK (apply this to THIS preview while keeping the "${preset.label}" direction): ${fb}` : ''}`

  const userPrompt = `Product the user wants to build:
"${prompt}"

Produce a single polished preview screen for this product in the "${preset.label}" design direction. Make it look real and intentionally designed.${fb ? `\n\nThe user reviewed the previous designs and asked for these changes — incorporate them: ${fb}` : ''}`

  const file = await generateWithModel({
    taskType: 'codegen',
    tier: 'balanced',
    system,
    prompt: userPrompt,
    context,
    providerConfig,
    aiModel,
    // Roomier budget so the model doesn't truncate mid-statement (the usual
    // cause of "Unexpected token" syntax errors in previews).
    maxTokens: 6000,
    expectedOutputFormat: 'text',
  })

  // Strip any stray markdown fences the model may add.
  let cleaned = String(file || '')
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim()

  // Design-phase auto-fix: validate the generated preview and, if it's broken
  // (e.g. truncated, unbalanced braces), automatically repair it — up to 2
  // passes — so a syntax error never reaches the carousel.
  let check = validatePreview(cleaned)
  for (let attempt = 0; attempt < 2 && !check.ok; attempt++) {
    try {
      const repaired = await repairPreview({ code: cleaned, error: check.error, preset, prompt, providerConfig, aiModel })
      if (repaired && repaired.length > 40) {
        const repairedCheck = validatePreview(repaired)
        // Keep the repaired version if it's valid, or at least no worse.
        if (repairedCheck.ok) { cleaned = repaired; check = repairedCheck; break }
        cleaned = repaired; check = repairedCheck
      }
    } catch { break }
  }

  // Final gate: if it still doesn't parse, signal failure so the caller drops
  // this preset rather than shipping a broken preview to the user.
  if (!validatePreview(cleaned).ok) {
    throw new Error(`Preview for "${preset.label}" failed validation after repair`)
  }

  return cleaned
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, context, providerConfig, aiModel, feedback, lockProvider } = req.body || {}
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: 'Missing required field: prompt' })
  }

  // When the user has locked their model, thread a no-failover flag so previews
  // run ONLY on the chosen provider (no silent gemini→groq→claude switching).
  const pc = lockProvider ? { ...(providerConfig || {}), __noFailover: true } : providerConfig

  try {
    const results = await Promise.allSettled(
      STYLE_PRESETS.map(preset =>
        generateOnePreview({ preset, prompt, context, providerConfig: pc, aiModel, feedback })
          .then(code => ({ preset, code }))
      )
    )

    const styles = results
      .map((r, i) => {
        const preset = STYLE_PRESETS[i]
        if (r.status !== 'fulfilled' || !r.value.code || r.value.code.length < 80) return null
        return {
          id: preset.id,
          label: preset.label,
          vibe: preset.vibe,
          // direction carries the precise palette/theme/mood instructions the
          // codegen needs to faithfully reproduce the chosen design. Dropping it
          // (previously) meant the built app ignored the selected look.
          direction: preset.direction,
          files: { '/App.js': r.value.code },
        }
      })
      .filter(Boolean)

    if (!styles.length) {
      return res.status(502).json({ error: 'Could not generate design previews. Please try again.' })
    }

    return res.json({ styles })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate style previews: ' + (err?.message || String(err)) })
  }
}

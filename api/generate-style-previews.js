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

async function generateOnePreview({ preset, prompt, context, providerConfig, aiModel }) {
  const system = `${PREVIEW_SYSTEM_BASE}

DESIGN DIRECTION FOR THIS PREVIEW — "${preset.label}":
${preset.direction}

Stay inside this direction's palette and mood. The goal is that this preview looks clearly DIFFERENT from other directions while still fitting the product.`

  const userPrompt = `Product the user wants to build:
"${prompt}"

Produce a single polished preview screen for this product in the "${preset.label}" design direction. Make it look real and intentionally designed.`

  const file = await generateWithModel({
    taskType: 'codegen',
    tier: 'balanced',
    system,
    prompt: userPrompt,
    context,
    providerConfig,
    aiModel,
    maxTokens: 4000,
    expectedOutputFormat: 'text',
  })

  // Strip any stray markdown fences the model may add.
  const cleaned = String(file || '')
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim()

  return cleaned
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, context, providerConfig, aiModel } = req.body || {}
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: 'Missing required field: prompt' })
  }

  try {
    const results = await Promise.allSettled(
      STYLE_PRESETS.map(preset =>
        generateOnePreview({ preset, prompt, context, providerConfig, aiModel })
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

/**
 * Staged app generation pipeline.
 *
 *   approved artifacts + prompt
 *     → [plan]      app architecture (entities, screens, components, interactions)
 *     → [file_tree] the React+Tailwind files to generate
 *     → [codegen]   per-file generation (file-by-file — Ollama-friendly)
 *     → [assemble]  inject the deterministic scaffold (entry + Tailwind host)
 *     → [summary]   short user-facing summary
 *     → { plan, fileTree, files, summary, progress }
 *
 * The `files` map ({ "/path": "content" }) IS the generated project — the same
 * representation the Lovable-Clone uses. It renders live in Sandpack (Phase 3),
 * is stored as a project asset (Phase 2), and is patched by the edit loop (Phase 4).
 *
 * Provider-agnostic: every stage goes through generateWithModel(), so it runs on
 * Claude, Groq, or Ollama. Defaults to Ollama (local, $0).
 *
 * Prompt guidance for "full, real features — no stubs/placeholders" is adapted
 * from the Lovable-Clone reference (github.com/BernieTv/Lovable-Clone, MIT,
 * © 2025 Bekzod Tukhtasinov). Infra (E2B/Inngest/Clerk/Prisma) is NOT used.
 */

import { generateWithModel, resolveStageProvider } from './modelRouter.js'

const MAX_FILES = 12

// ── Resolve & stub missing relative imports so one bad import can't blank the
// whole Sandpack preview. Scans `import ... from './x'` and `import './x.css'`.
function stubMissingImports(files) {
  const exists = (p) => Object.prototype.hasOwnProperty.call(files, p)
  const importRe = /import\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]/g

  for (const [fromPath, content] of Object.entries(files)) {
    if (typeof content !== 'string') continue
    const fromDir = fromPath.slice(0, fromPath.lastIndexOf('/')) || ''
    let m
    while ((m = importRe.exec(content)) !== null) {
      // Resolve the relative spec against the importing file's directory.
      const parts = (fromDir + '/' + m[1]).split('/')
      const stack = []
      for (const seg of parts) {
        if (seg === '' || seg === '.') continue
        if (seg === '..') stack.pop()
        else stack.push(seg)
      }
      let resolved = '/' + stack.join('/')

      if (resolved.endsWith('.css')) {
        if (!exists(resolved)) files[resolved] = '/* stub: auto-created to satisfy an import */\n'
        continue
      }
      // Bare module specifier (no extension): try .js / .jsx, else stub a .js component.
      const candidates = [resolved, resolved + '.js', resolved + '.jsx', resolved + '/index.js']
      if (candidates.some(exists)) continue
      const target = resolved + '.js'
      const name = (stack[stack.length - 1] || 'Stub').replace(/[^A-Za-z0-9_]/g, '') || 'Stub'
      files[target] = `import React from "react";
// Auto-stubbed: the generator imported this file but never wrote it.
export default function ${name}() { return null; }
`
    }
  }
}

// ── Deterministic scaffold (no AI): Sandpack "react" runtime + Tailwind via CDN ──
function scaffoldFiles(appName = 'Aria App') {
  return {
    '/public/index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName}</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
    '/index.js': `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")).render(<App />);`,
  }
}

// ── Prompts ──────────────────────────────────────────────────────────────────
const PLAN_SYSTEM = `You are a senior product engineer planning a REAL, working React + Tailwind web app that runs in an in-browser sandbox (Sandpack).

SOURCE DOCUMENTS: If the prepended context contains "sourceDocuments" (a PRD, product design doc, strategy, etc.), treat them as the AUTHORITATIVE specification. Derive the app's features, screens, entities, and data model FROM those documents — the user already specified the product there. The one-line prompt is just a pointer; the documents are the source of truth. Where a PRD lists functional requirements or user stories, the plan's features MUST cover them. Where a design doc describes screens/flows, the uiSections MUST reflect them.

Plan EXACTLY what the user asked for — nothing more, nothing less. Match scope to the request:
- "simple": a single-purpose app (timer, calculator, to-do, note pad, converter, quiz, single dashboard). One screen. A handful of pieces of state. No backend concepts, no records, no CRUD, no status workflow.
- "standard": a multi-feature tool (CRM, tracker, project board, admin console) that genuinely needs multiple screens, seeded records, and create/edit/delete.

CRITICAL: Do NOT invent enterprise structure for apps that don't need it. A Pomodoro timer has NO "entities", NO "Active/Inactive status", NO "records" — it has a countdown, start/pause/reset controls, work/break modes, and a completed-session count. Plan THOSE.

Return ONE JSON object, no markdown:
{
  "appName": "2-4 word specific name",
  "complexity": "simple | standard",
  "summary": "2-3 sentences on what the app does and who uses it",
  "features": ["concrete capability the app MUST have", "..."],
  "uiSections": ["a visible section or control the UI needs", "..."],
  "state": ["a piece of state the app tracks, e.g. 'secondsRemaining', 'isRunning', 'mode', 'completedSessions'"],
  "entities": [{ "name": "Entity", "fields": [{ "name": "snake_case", "type": "text|number|date|select|status|email|textarea", "options": [] }] }],
  "seedData": "realistic sample data to seed, or 'none' for apps without records"
}
"entities"/"seedData" are ONLY for "standard" apps with records — use [] and "none" for simple apps.
Be specific and realistic to the actual request.`

const FILE_TREE_SYSTEM = `You decide the React + Tailwind file list to implement an app plan for an in-browser Sandpack runtime.

DEFAULT TO FEWER FILES. Fewer files = fewer broken imports = a working app. Only split out a file when it carries real, reusable weight.

Rules (MUST follow):
- "/index.js" and "/public/index.html" are PRE-CREATED — do NOT list them.
- "/App.js" is the root (always include it; default export; holds top-level state).
- If the app is "simple", return ONLY "/App.js" — everything inline, ZERO other files.
- For "standard" apps: one file per MAJOR component in "/components/<PascalCase>.js" (default export), shared seed data in "/data/<name>.js", helpers in "/lib/<name>.js". ${MAX_FILES} files MAX.
- Tailwind is global via CDN — Tailwind classes only. NO .css/.scss files.
- Never create a file just to hold one tiny function — inline it instead.

Return ONE JSON object, no markdown:
{ "files": [{ "path": "/App.js", "purpose": "...", "type": "entry|component|data|lib" }, ...] }`

// Shared, opinionated design system injected into every codegen prompt so
// generated apps look intentionally designed (Linear/Vercel/Stripe-grade),
// not like default browser HTML.
const DESIGN_SYSTEM = `DESIGN BAR (LOVABLE QUALITY — the app must be insanely beautiful and polished, matching Google AI Studio / Lovable standards):
DOMAIN-SPECIFIC DESIGN (CRITICAL):
- a focus timer, a CRM, an approval workflow, a finance tracker, and an IT ticket queue each deserve RADICALLY DIFFERENT layouts, palettes, and interactions
- Study what each domain's best apps look like — Linear for task mgmt, Figma for design, Stripe for payments, Apple for consumer focus
- DO NOT use the same dark dashboard for everything — that's corporate boredom
- CHOOSE the right visual architecture PER APP TYPE:
  * Focus tools (timer, notes, calculator): centered, spacious, minimal distractions. Large clear displays. Calming palette (blues, greens, warm neutrals)
  * Dashboards (finance, analytics, admin): grid of stat cards/widgets, summary cards at top, tables below. Command-center feel. Confident neutrals (slate, stone) + sharp accent
  * Forms & workflows (approval, intake, checkout): wizard/step layout or single focused form. Clear progress. Reduce cognitive load
  * Creatives (design, music, drawing): canvas-focused, tools/palettes in sidebars. Dark theme. Lots of breathing room around the canvas
  * Social/Community: cards, feeds, profiles, reactions. Energetic palette. Microinteractions matter

LOVABLE PRODUCTION QUALITY:
- SURFACES: Every card/panel is a hero — rounded-2xl, real shadow (shadow-lg or shadow-xl), subtle border (border-white/10, border-black/5, or border-slate-200), generous padding (p-6 or p-8). Surfaces have DEPTH
- TYPOGRAPHY: hero headline (text-3xl/text-4xl, font-bold), clear subheadings (text-lg, font-semibold), readable body (text-base, leading-relaxed), muted metadata (text-xs/text-sm, text-slate-500). Hierarchy is INSTANT VISUAL SCANNING
- BUTTONS & ACTIONS:
  * Primary CTA: filled with accent, bold text, shadow, hover scale/glow effect, focus ring. VERY VISUALLY DOMINANT. NEVER subtle
  * Secondary actions: outlined or soft bg, subtle hover. QUIET
  * State indicators: hover/active/disabled always visible with transitions (transition-all duration-200)
- PALETTE: Pick ONE dominant palette that feels premium:
  * Dark: slate-900 or zinc-950 backgrounds, with slate-50/white text, ONE bright accent (emerald, cyan, indigo, violet, amber depending on mood)
  * Light: white/slate-50 backgrounds, slate-900 text, ONE accent color chosen for EMOTIONAL FIT, not random
  * NEVER: neon multi-color gradients, random emoji abuse, unstyled HTML, plain default inputs, generic blue-everywhere
- STATE VISUAL CLARITY: Is it loading? → skeleton or spinne. Is it empty? → empathetic empty state with guidance. Is it success? → green + confirmation. Is it error? → red + actionable message. Is something running? → progress bar + elapsed time
- RESPONSIVE & MOBILE: min-h-screen for tall apps, responsive grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3), touch-friendly tap targets (min h-10 w-10), stacked on mobile
- ANIMATION & MOTION: transitions on all color/scale/opacity changes (transition-all duration-200), no needless keyframes, motion respects prefers-reduced-motion if feasible
- TAILWIND REAL CLASSES ONLY (ABSOLUTE): use ONLY real Tailwind utilities or explicit [arbitrary-values]. Built-in palettes: slate gray zinc neutral stone red orange amber yellow lime green emerald teal cyan sky blue indigo violet purple fuchsia pink rose. Each has 50–950. NEVER invent: bg-deep-charcoal, text-bright-green-500, accent-ocean — those produce ZERO styling. For custom hex: bg-[#0f172a] or text-[#34d399]`

const JSX_CORRECTNESS = `JSX CORRECTNESS (these prevent silent rendering bugs that DON'T throw errors):
- Do method calls INSIDE the braces, never after them. WRONG: {seconds}.toString().padStart(2,'0') — everything after the } becomes literal on-screen text. RIGHT: {String(seconds).padStart(2, '0')}.
- For timers/clocks, compute the parts in JS BEFORE the return, then render them: const mm = String(Math.floor(total / 60)).padStart(2, '0'); const ss = String(total % 60).padStart(2, '0'); ... then in JSX: <span>{mm}:{ss}</span>.
- Every { in JSX must contain a complete expression and close with its matching } before any literal text. Re-read each interpolation and confirm no stray ".toString()", ".padStart()", ".toFixed()" sits OUTSIDE the braces.
- Clean up intervals/timeouts in useEffect (return () => clearInterval(id)). Never call setState during render.`

const SINGLE_FILE_CODEGEN_SYSTEM = `You are a WORLD-CLASS React engineer AND product designer (Lovable / Google AI Studio grade) writing ONE self-contained file: /App.js. The ENTIRE app lives in this single file, and it must be FEATURE-COMPLETE, fully functional, AND insanely beautiful.

This is NOT a prototype — it is a SHIPPING-QUALITY web app. Every line of code matters. Every pixel matters.

Hard rules:
- React 18 + hooks. Define EVERY component inline in this one file. Import ONLY from "react" — NO local/relative imports whatsoever (no "./..."), so there is nothing that can break.
- Tailwind classes for ALL styling (Tailwind is loaded globally — do NOT import it, no CSS files).
- NO external libraries, NO npm installs, NO network/API calls, NO image URLs (use emojis and colored divs).
- Build the FULL, REAL, working feature the plan describes — complete and polished, with sensible defaults. NO TODOs, NO stubs, NO placeholders, NO "coming soon".
- "export default function App()" must be the root component.

${DESIGN_SYSTEM}

${JSX_CORRECTNESS}

Output ONLY the raw file contents (valid JS/JSX). No markdown, no backticks, no commentary.`

const CODEGEN_SYSTEM = `You are a senior React engineer AND product designer generating ONE complete file of a multi-file React + Tailwind app that runs in an in-browser sandbox (Sandpack). The finished app must be both fully functional AND genuinely beautiful.

Hard rules:
- React 18 + functional components + hooks. Tailwind classes for ALL styling (Tailwind is global — do NOT import it, do NOT create CSS files).
- NO external UI/component libraries, NO npm installs, NO network/API calls. Local/static seeded data only.
- NO image URLs — use emojis and colored divs (bg-*, aspect-*) as placeholders.
- NO TODOs, NO stubs, NO placeholder text. Build full, real, working features.

IMPORT CONTRACT (most important — this is what keeps the app from breaking):
- You are given the EXACT source of every file you are allowed to import from, under "dependencyFiles".
- You may ONLY import names that are ACTUALLY exported by those files. Match the export kind exactly: a default export → "import X from './path'"; a named export → "import { x } from './path'". NEVER import a name that isn't in the given source.
- Do NOT import any file that is not listed in "dependencyFiles". If you need a helper that doesn't exist, write it inline in THIS file instead.
- Default-export React components.

${DESIGN_SYSTEM}
- CONSISTENCY: this is one file of a larger app — reuse the same palette, radius, spacing, and shadow conventions visible in the dependencyFiles so the whole app feels cohesive.

${JSX_CORRECTNESS}

Output ONLY the raw file contents. No markdown, no backticks, no commentary.`

const SUMMARY_SYSTEM = `Write a short, friendly 1-2 sentence summary of the internal tool that was just built, based on the plan provided. Plain text only — no markdown, no tags, no code.`

const EDIT_PLAN_SYSTEM = `You are the planning brain for edits to an existing React + Tailwind project. Your job is to FULLY understand the user's edit request — every part of it — and turn it into a precise, file-mapped work plan. The user is often asking for SEVERAL things in one message; missing any part is a failure.

Process, in order:
1. READ the entire edit request carefully. Do not stop at the first clause. A request like "make the header dark, add a search box, and sort tasks by due date" is THREE distinct changes — capture all of them.
2. RESTATE what the user wants in your own words so it's clear you understood the whole thing (the "understanding" field).
3. DECOMPOSE it into a list of discrete, concrete sub-changes. One entry per distinct thing the user asked for. Split compound sentences ("and", "also", "then", commas, bullet points) into separate items. Do not merge unrelated asks into one vague item.
4. MAP each sub-change to the specific file(s) that must change to deliver it, using the current file list. A single sub-change may touch multiple files; a single file may serve multiple sub-changes. If a sub-change needs a brand-new file, list it under newFiles.

Select EVERY file genuinely required to satisfy the FULL request — do not under-scope to look minimal. But don't rewrite unrelated files either: include a file only if at least one sub-change actually needs it.

Return ONE JSON object, no markdown:
{
  "understanding": "1-3 sentences restating the COMPLETE request, covering every part the user asked for",
  "changes": [
    { "what": "one discrete sub-change, concretely described", "files": ["/path/that/delivers/it", "..."] }
  ],
  "editFiles": ["/existing/path/to/change", "..."],
  "newFiles": [{ "path": "/new/path", "purpose": "what it's for + which sub-change(s) it serves" }]
}
Rules:
- "changes" MUST cover every part of the request — one item per distinct ask. If the user listed five things, there are five (or more) items.
- "editFiles" is the de-duplicated union of all existing files referenced across "changes".
- Every file in "changes[].files" that already exists must also appear in "editFiles"; every new one in "newFiles".`

const EDIT_CODEGEN_SYSTEM = `You are a senior React engineer applying a requested change to ONE file of an existing React + Tailwind project (runs in an in-browser Sandpack sandbox).

You are given the FULL edit request, the planner's understanding of it, and the SPECIFIC list of sub-changes assigned to THIS file. Implement EVERY assigned sub-change for this file — do not stop after the first one, and do not skip any. If three sub-changes are assigned to this file, all three must be present in your output.

Hard rules (same as generation):
- React 18 + hooks + Tailwind classes only. No CSS files, no external UI libs, no npm installs, no network calls, no image URLs (emojis/colored divs).
- Relative imports for local files; default-export components. Static/local seed data only.
- Apply every sub-change assigned to this file. Preserve all unrelated existing functionality and structure — change only what the assigned sub-changes require.
- Full, working code — no TODOs, stubs, or placeholders.

IMPORT CONTRACT (critical for repairs): you are given the REAL source of the other project files under "dependencyFiles". You may ONLY import names those files actually export, matching the export kind (default vs named). If an import currently references a name that is NOT exported by its target file, FIX it — either import the correct existing name, or add the missing export to the right file if that is the file you're editing. Never invent an export that doesn't exist.

${JSX_CORRECTNESS}

When the change is visual or when you touch markup, hold the same design bar as generation: cohesive palette, gradient background, rounded-2xl cards with shadows, styled buttons with hover/transition, clear typographic hierarchy. Match the existing app's look — never downgrade styled markup to plain HTML.

You are given the file's CURRENT contents (if it exists) and the edit request. Output ONLY the COMPLETE new file contents — no markdown, no backticks, no commentary.`

// Surgical, diff-style editing of an EXISTING file. The model returns only the
// lines that change as SEARCH/REPLACE blocks, which we apply programmatically —
// so unrelated code stays byte-for-byte identical and far fewer tokens are
// generated than a full-file rewrite.
const EDIT_DIFF_SYSTEM = `You are a senior React engineer making a SURGICAL edit to ONE file of an existing React + Tailwind project (in-browser Sandpack runtime).

Do NOT rewrite the whole file. Change ONLY the specific lines the assigned sub-changes require; leave everything else exactly as it is.

Express every edit as one or more SEARCH/REPLACE blocks in EXACTLY this format:

<<<<<<< SEARCH
(lines copied verbatim from the current file, including indentation)
=======
(the replacement lines)
>>>>>>> REPLACE

Rules:
- The SEARCH section MUST be an exact, contiguous copy of text that currently exists in the file — same characters, same indentation. Copy it from the provided current contents; never paraphrase or reformat it.
- Keep each SEARCH block as SMALL as possible: just enough lines to locate the spot uniquely (usually 1-6 lines). If one line changes, don't include the whole function.
- Use a SEPARATE block for each distinct edit location.
- To ADD code, SEARCH for an existing nearby line and repeat it unchanged in both SEARCH and REPLACE, with the new line beside it — so the anchor is exact.
- To DELETE code, put the lines in SEARCH and leave REPLACE empty.
- Apply EVERY assigned sub-change. Preserve all unrelated code, imports, and exports.
- React 18 + hooks + real Tailwind utility classes only (never invented class names). No new libraries, no network calls, no image URLs (emojis/colored divs).
- When a change is visual, hold the design bar (cohesive palette, rounded cards, styled buttons with hover/transition) — but still express it as minimal SEARCH/REPLACE blocks, not a rewrite.

Output ONLY SEARCH/REPLACE blocks. No markdown fences, no prose, no commentary.`

// ── UI/UX Creative Director + Frontend Polish Agent ──────────────────────────
// Runs AFTER the first functional version is generated. Stage 1 (director)
// inspects the working app and writes a domain-specific creative brief. Stage 2
// (polish) rewrites each file to that brief while strictly preserving behavior.
const CREATIVE_DIRECTOR_SYSTEM = `You are a UI/UX Creative Director. You are given an app's plan and the SOURCE of its current, FUNCTIONAL-BUT-BARE implementation. Infer what this SPECIFIC product deserves and write a creative brief a frontend engineer will use to redesign it WITHOUT changing behavior.

Think like a product designer, per domain — do NOT propose a generic SaaS dashboard for everything:
- What type of app is this? Who is the user? What is the main job-to-be-done?
- What emotional tone fits (calm/focused, enterprise/operational, precise/confidence-building, formal/compliance, encouraging/progress, clean/accessible)?
- What is the ONE primary action? What state matters most? What should the user notice first? Which actions should be quieter?

A focus timer, a CRM, an approval workflow, a finance tracker, a legal intake tool, an IT ticket queue, and a learning app must each get a DISTINCT layout, palette, metaphor, and density. Match scope to the app — never bolt enterprise navigation onto a simple single-purpose tool.

Return ONE JSON object, no markdown:
{
  "diagnosis": "1-2 sentences: what is visually weak/unstyled in the current UI",
  "classification": { "appType": "...", "user": "...", "primaryAction": "...", "mainState": "...", "tone": "..." },
  "layout": "the single best fit: centered-hero | dashboard-shell | sidebar-nav | top-nav | split-pane | kanban | table-admin | card-grid | wizard | timeline | calendar | form-focused | command-center | mobile-first",
  "personality": "3-5 adjectives",
  "metaphor": "the core visual metaphor (e.g. 'focus ring / deep-work cockpit', 'request pipeline / command center')",
  "palette": { "mood": "dark|light", "background": "a hex value or a REAL Tailwind class (e.g. '#0f172a' or 'bg-slate-900') — never an invented color name", "surface": "hex or real Tailwind class", "accent": "hex or real Tailwind class", "accentText": "hex or real Tailwind class", "muted": "...", "success": "...", "warning": "...", "danger": "..." },
  "typography": "feel + hierarchy guidance",
  "radius": "e.g. rounded-xl / rounded-2xl", "density": "spacious | balanced | dense",
  "components": ["specific component treatments THIS app needs, e.g. 'pill mode-tabs', 'circular progress timer', 'status badges', 'stat cards', 'approval drawer'"],
  "motion": "interaction/motion guidance (restrained)",
  "stateVisuals": ["functional state → visual cue, e.g. 'running → glowing progress ring + Pause', 'pending → amber badge'"],
  "primaryActionLabel": "the main CTA text"
}
Make palette, layout, and metaphor SPECIFIC to this domain — not a default. Avoid generic SaaS sameness, random gradients, and meaningless glassmorphism.`

const POLISH_SYSTEM = `You are a careful senior frontend engineer doing a VISUAL POLISH PASS on ONE file of a working React + Tailwind app (in-browser Sandpack runtime). You are given the file's CURRENT source, a creative brief for the whole app, and the source of its sibling/dependency files for context.

ABSOLUTE RULE — PRESERVE FUNCTIONALITY (functionality wins over polish; never ship a beautiful broken app):
- Keep EVERY state variable, hook, event handler, effect, data flow, prop, filter, route, CRUD action, status transition, role check, and piece of sample data.
- Keep this file's imports and exports IDENTICAL — same exported names, same default-vs-named kind, same component prop names. Other files depend on them.
- Keep every button wired to its existing handler, every input bound to its state, every form to its submit handler, every tab/route navigating as before.
- Do NOT add controls that do nothing. Do NOT remove or simplify features. Do NOT replace real logic with static/mock UI. Do NOT change the app's core purpose.

YOUR JOB — transform the INTERFACE to match the creative brief:
- Apply the brief's layout, palette, typography, component styling, radius, density, and motion. Make it feel like THIS product, not a generic template.
- Convert functional state into visual state per the brief's stateVisuals (active/hover/disabled/loading/empty/success/error).
- Make the primary action obvious and dominant; make secondary actions quieter.
- Replace EVERY unstyled HTML control with intentionally styled Tailwind components — no raw <button>/<input>/<select>/<table> without classes.
- Responsive layout, accessible contrast, visible focus-visible states, keyboard usable. Add meaningful empty states.
- You MAY extract small presentational helper components WITHIN this file for clarity, but do not move logic out of it.

FIX ANY RENDERING BUGS you find while preserving behavior:
${JSX_CORRECTNESS}

Tailwind classes only (global CDN — don't import it). No new libraries, no npm installs, no network calls, no image URLs (emojis/colored divs only).
TAILWIND CLASSES MUST BE REAL (CRITICAL — invented classes render as NOTHING): use ONLY default Tailwind utilities. For colors use ONLY the built-in palettes (slate, gray, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose) with shades 50–950, e.g. bg-slate-900, text-emerald-400. NEVER invent names like bg-deep-charcoal or text-bright-green-500 — they produce zero styling. For a specific custom color use arbitrary values in square brackets instead: bg-[#0f172a], text-[#34d399]. If the brief's palette gives a hex or a non-Tailwind name, translate it to the nearest real palette class or an [arbitrary-value].
Output ONLY the COMPLETE new file contents (valid JS/JSX). No markdown, no backticks, no commentary.`

/**
 * UI/UX Creative Director + Frontend Polish Agent.
 *
 * Runs after the functional app exists. Generates a domain-specific creative
 * brief, then rewrites each source file to that brief while strictly preserving
 * behavior. Any file whose polished output is empty/errored keeps its ORIGINAL
 * source, so polish can never lose working code (functionality wins).
 *
 * @returns { files, brief, polishedPaths, errors }
 */
export async function runPolishPass({ files, plan = {}, fileList = [], providerConfig = {}, styleDirective = '', lite = false, emit = () => {} } = {}) {
  const out = { ...files }
  const errors = []
  const SCAFFOLD = new Set(['/index.js', '/public/index.html'])
  const sourcePaths = Object.keys(out).filter(p => !SCAFFOLD.has(p) && typeof out[p] === 'string' && out[p].trim())
  if (!sourcePaths.length) return { files: out, brief: null, polishedPaths: [], errors }

  // 1) CREATIVE DIRECTION — inspect the working app, infer its domain, write a brief.
  emit('polish', 'Reviewing the app and setting a creative direction…', { percent: 90 })
  const digest = sourcePaths.map(p => ({ path: p, source: String(out[p]).slice(0, 1400) }))
  let brief = null
  try {
    brief = await generateWithModel({
      taskType: 'polish', system: CREATIVE_DIRECTOR_SYSTEM,
      prompt: `Inspect this app and produce its creative brief.${styleDirective ? ' The user has already chosen a design direction — PRESERVE and refine it, do not contradict it.' : ''}`,
      context: { appPlan: { appName: plan?.appName, complexity: plan?.complexity, summary: plan?.summary, features: plan?.features }, currentFiles: digest, userChosenStyle: styleDirective || null },
      expectedOutputFormat: 'json', maxTokens: 1200, providerConfig,
    })
  } catch (err) {
    errors.push({ stage: 'creative_director', error: err.message })
  }
  if (!brief || typeof brief !== 'object') {
    // No brief → don't risk rewriting blind. Leave the functional app as-is.
    emit('polish', 'Kept the functional build (no creative brief produced).', { percent: 95 })
    return { files: out, brief: null, polishedPaths: [], errors }
  }
  emit('polish', `Creative direction: ${brief.metaphor || brief.layout || 'custom'} — applying polish…`, { layout: brief.layout, percent: 91 })

  // 2) POLISH each source file to the brief, in dependency order (data/lib →
  //    components → /App.js) so each file sees already-polished siblings for a
  //    cohesive look. Exports are held stable, so dependents never break.
  const byType = (f) => (fileList.find(x => x.path === f)?.type) || (f === '/App.js' ? 'entry' : 'component')
  const order = [
    ...sourcePaths.filter(p => ['data', 'lib'].includes(byType(p))),
    ...sourcePaths.filter(p => !['data', 'lib'].includes(byType(p)) && p !== '/App.js'),
    ...sourcePaths.filter(p => p === '/App.js'),
  ]
  const polishedPaths = []
  const total = order.length
  let done = 0
  for (const path of order) {
    const original = out[path]
    const deps = sourcePaths
      .filter(p => p !== path)
      .map(p => ({ path: p, source: String(out[p]).slice(0, 2200) }))
    try {
      const content = await generateWithModel({
        taskType: 'polish', system: POLISH_SYSTEM,
        prompt: `Polish ${path} to the creative brief. Preserve ALL behavior, imports, and exports. Output the complete new file.`,
        context: { creativeBrief: brief, thisFile: { path, currentSource: original }, siblingFiles: deps },
        expectedOutputFormat: 'text', maxTokens: lite ? 3000 : 5000, providerConfig,
      })
      const cleaned = stripFences(content)
      // Guard: only accept a non-trivial result that still looks like a module
      // (keeps an export). Otherwise keep the original — never lose working code.
      if (cleaned && cleaned.length > 30 && /export\s+(default|function|const|class|\{)/.test(cleaned)) {
        out[path] = cleaned
        polishedPaths.push(path)
      } else {
        errors.push({ path, error: 'polish output rejected (kept original)' })
      }
    } catch (err) {
      errors.push({ path, error: err.message })
    } finally {
      done++
      emit('polish', `Polished ${path} (${done} of ${total})…`, { path, index: done, total, percent: 91 + Math.round((done / total) * 6) })
    }
  }

  return { files: out, brief, polishedPaths, errors }
}

/**
 * Apply an iterative edit to an existing project's files map.
 * @returns { files, changedFiles, summary, errors }
 */
export async function runAppEdit({ files = {}, plan = {}, editRequest, providerConfig = {}, onProgress } = {}) {
  const progress = []
  const emit = (stage, message, extra = {}) => {
    const evt = { stage, message, ...extra }
    progress.push(evt)
    try { onProgress?.(evt) } catch {}
  }

  const editableFiles = Object.keys(files).filter(p => p !== '/public/index.html' && p !== '/index.js')

  // 1) Understand + decompose the request, then identify affected files
  emit('edit_plan', 'Reading the full request and breaking it down…', { percent: 8 })
  let editPlan
  try {
    editPlan = await generateWithModel({
      taskType: 'transform', system: EDIT_PLAN_SYSTEM,
      prompt: `Edit request: "${editRequest}"`,
      context: { currentFiles: editableFiles, appName: plan?.appName, primaryEntity: plan?.primaryEntity },
      expectedOutputFormat: 'json', maxTokens: 1500, providerConfig,
    })
  } catch {
    editPlan = { understanding: '', changes: [], editFiles: [], newFiles: [] }
  }

  const understanding = typeof editPlan?.understanding === 'string' ? editPlan.understanding.trim() : ''
  const changeList = safeArray(editPlan?.changes).filter(c => c && typeof c.what === 'string' && c.what.trim())

  // Union the files referenced across the decomposed sub-changes into the edit
  // set — so a multi-part request can't be under-scoped by a terse editFiles list.
  const editFileSet = new Set(safeArray(editPlan?.editFiles).filter(p => files[p]))
  const newFileMap = new Map(safeArray(editPlan?.newFiles).filter(f => f?.path && !files[f.path]).map(f => [f.path, f.purpose || 'apply the requested change']))
  for (const c of changeList) {
    for (const p of safeArray(c.files)) {
      if (files[p]) editFileSet.add(p)
      else if (typeof p === 'string' && p.startsWith('/') && !newFileMap.has(p)) newFileMap.set(p, c.what)
    }
  }

  const toEdit = [...editFileSet]
  const toCreate = [...newFileMap.entries()].map(([path, purpose]) => ({ path, purpose }))
  // Safety net: if the planner found nothing, fall back to editing the root component.
  if (!toEdit.length && !toCreate.length && files['/App.js']) toEdit.push('/App.js')

  // For each target file, the concrete sub-changes it's responsible for. This is
  // what makes a single codegen call address EVERY part of the request that
  // belongs to that file (not just the first thing it noticed).
  const changesForFile = (path) => changeList
    .filter(c => safeArray(c.files).includes(path))
    .map(c => c.what)

  const targets = [
    ...toEdit.map(p => ({ path: p, existing: files[p], subChanges: changesForFile(p) })),
    ...toCreate.map(f => ({ path: f.path, existing: null, purpose: f.purpose, subChanges: changesForFile(f.path) })),
  ]

  if (understanding) emit('edit_plan', `Understood: ${understanding}`, { understanding, percent: 14 })
  if (changeList.length) emit('edit_plan', `Broke it into ${changeList.length} change(s).`, { changes: changeList.map(c => c.what), percent: 17 })
  emit('edit_plan', `Changing ${targets.length} file(s): ${targets.map(t => t.path).join(', ') || '—'}`, { files: targets.map(t => t.path), percent: 20 })

  // 2) Regenerate the affected files — in parallel batches, like the build does.
  //    Each codegen call gets the REAL source of every sibling as context, so
  //    there's no dependency ordering to respect; files are independent and can
  //    run concurrently. (Sequential rewriting is what made edits slower than a
  //    full build, which already parallelizes its codegen.)
  const updated = { ...files }
  const changedFiles = []
  const errors = []
  const siblingPaths = Object.keys(files)
  const lite = resolveStageProvider('codegen', providerConfig) === 'ollama'
  const concurrency = lite ? 1 : 4
  const total = targets.length
  let completed = 0

  // Lean import-contract context. Shipping every sibling's FULL source to every
  // file is O(n²) input tokens — the main reason a few edits exhaust a daily
  // token budget. Instead: send full source only for the siblings THIS file
  // actually imports (so it can fix real import mismatches), and just the export
  // SIGNATURE (names) for everything else (enough to import correctly).
  const dependencyFilesFor = (path, ownSource) => {
    const imported = importedSiblingPaths(ownSource || '', path, files)
    return siblingPaths
      .filter(p => p !== path && files[p] && p !== '/public/index.html')
      .map(p => imported.has(p)
        ? { path: p, source: files[p] }
        : { path: p, exports: exportNamesOf(files[p]) })
  }

  const genEdit = async (t) => {
    // The concrete sub-changes this file owns. If the planner didn't map any to
    // this file specifically, fall back to the whole request so nothing is dropped.
    const assigned = (t.subChanges && t.subChanges.length) ? t.subChanges : [t.purpose || editRequest]
    const assignedText = assigned.map((c, n) => `${n + 1}. ${c}`).join('\n')
    const overall = `Full edit request: "${editRequest}"${understanding ? `\n\nWhat the user wants overall: ${understanding}` : ''}`
    const isNew = !t.existing
    try {
      if (isNew) {
        // New file → no existing lines to patch, so generate complete contents.
        const content = await generateWithModel({
          taskType: 'codegen', system: EDIT_CODEGEN_SYSTEM,
          prompt: `${overall}\n\nCreate ${t.path}. It must deliver:\n${assignedText}\n\nOutput the complete new file.`,
          context: {
            appPlan: { appName: plan?.appName, primaryEntity: plan?.primaryEntity, entities: plan?.entities, statusFlow: plan?.statusFlow },
            assignedSubChanges: assigned,
            thisFile: { path: t.path, currentContents: '(new file)' },
            dependencyFiles: dependencyFilesFor(t.path, ''),
          },
          expectedOutputFormat: 'text', maxTokens: 4000, providerConfig,
        })
        const cleaned = stripFences(content)
        if (cleaned) { updated[t.path] = cleaned; changedFiles.push(t.path) }
        else errors.push({ path: t.path, error: 'empty output' })
      } else {
        // Existing file → surgical SEARCH/REPLACE blocks, applied in-process so
        // unrelated lines are never touched.
        const raw = await generateWithModel({
          taskType: 'codegen', system: EDIT_DIFF_SYSTEM,
          prompt: `${overall}\n\nSub-changes assigned to ${t.path} — implement ALL of them:\n${assignedText}\n\nReturn SEARCH/REPLACE blocks that make ONLY these changes. The file's current contents are in context; copy SEARCH text from them verbatim.`,
          context: {
            appPlan: { appName: plan?.appName, primaryEntity: plan?.primaryEntity, entities: plan?.entities, statusFlow: plan?.statusFlow },
            assignedSubChanges: assigned,
            thisFile: { path: t.path, currentContents: t.existing },
            // Full source only for files this one imports; export signatures otherwise.
            dependencyFiles: dependencyFilesFor(t.path, t.existing),
          },
          expectedOutputFormat: 'text', maxTokens: 2000, providerConfig,
        })
        const blocks = parseEditBlocks(raw)
        if (!blocks.length) {
          errors.push({ path: t.path, error: 'no edit blocks produced' })
        } else {
          const { content, applied, failed } = applyEditBlocks(t.existing, blocks)
          if (applied > 0) {
            updated[t.path] = content
            changedFiles.push(t.path)
            if (failed) errors.push({ path: t.path, error: `${failed} edit block(s) did not match and were skipped` })
          } else {
            errors.push({ path: t.path, error: 'edit blocks did not match the current file' })
          }
        }
      }
    } catch (err) {
      errors.push({ path: t.path, error: err.message })
    } finally {
      completed++
      emit('edit_codegen', `Edited ${t.path} (${completed} of ${total})…`, { path: t.path, index: completed, total, percent: 20 + Math.round((completed / Math.max(1, total)) * 65) })
    }
  }

  emit('edit_codegen', `Editing ${total} file(s)…`, { total, percent: 22 })
  for (let i = 0; i < targets.length; i += concurrency) {
    await Promise.all(targets.slice(i, i + concurrency).map(genEdit))
  }

  // 3) Summary — derived locally (no extra LLM round-trip or token spend). The
  //    AI summary was cosmetic and cost ~900 tokens + a serial call per edit.
  const fileLabel = changedFiles.length
    ? `${changedFiles.length} file${changedFiles.length === 1 ? '' : 's'} (${changedFiles.map(p => p.split('/').pop()).join(', ')})`
    : 'no files'
  const summary = changedFiles.length
    ? `Applied your changes across ${fileLabel}.`
    : `No changes were applied for: ${editRequest}`

  emit('done', `Updated ${changedFiles.length} file(s).`, { changedFiles, errorCount: errors.length, percent: 100 })
  return { files: updated, changedFiles, summary, errors, progress }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function stripFences(s) {
  if (typeof s !== 'string') return ''
  return s.replace(/^\s*```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim()
}

function safeArray(v) { return Array.isArray(v) ? v : [] }

// Parse SEARCH/REPLACE edit blocks from a model's diff-style output.
//   <<<<<<< SEARCH\n<old>\n=======\n<new>\n>>>>>>> REPLACE
function parseEditBlocks(text) {
  if (typeof text !== 'string') return []
  const blocks = []
  const re = /<{5,}\s*SEARCH\s*?\r?\n([\s\S]*?)\r?\n?={5,}\s*?\r?\n([\s\S]*?)\r?\n?>{5,}\s*REPLACE/g
  let m
  while ((m = re.exec(text)) !== null) {
    blocks.push({ search: m[1], replace: m[2] })
  }
  return blocks
}

// Apply SEARCH/REPLACE blocks to a file's contents. Exact match first; falls
// back to a whitespace-tolerant line match so minor indentation drift in the
// model's SEARCH text still lands. Returns { content, applied, failed }.
function applyEditBlocks(original, blocks) {
  let content = original
  let applied = 0
  let failed = 0
  for (const b of blocks) {
    const search = b.search
    const replace = b.replace
    if (!search) { failed++; continue } // pure-insert with no anchor — skip (unreliable)
    if (content.includes(search)) {
      content = content.replace(search, () => replace) // fn form: avoid $-pattern expansion
      applied++
      continue
    }
    const fuzzy = fuzzyLineReplace(content, search, replace)
    if (fuzzy != null) { content = fuzzy; applied++ }
    else failed++
  }
  return { content, applied, failed }
}

// Extract the names a module exports (default + named) via regex — cheap
// alternative to shipping the whole file as an import contract.
function exportNamesOf(source) {
  if (typeof source !== 'string') return []
  const names = new Set()
  if (/export\s+default/.test(source)) names.add('default')
  let m
  const re1 = /export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)/g
  while ((m = re1.exec(source))) names.add(m[1])
  const re2 = /export\s*\{([^}]+)\}/g
  while ((m = re2.exec(source))) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim()
      if (name) names.add(name)
    }
  }
  return [...names]
}

// Resolve a relative import spec from `fromPath` to an actual file key.
function resolveRelImport(spec, fromPath, files) {
  const fromDir = fromPath.slice(0, fromPath.lastIndexOf('/')) || ''
  const parts = (fromDir + '/' + spec).split('/')
  const stack = []
  for (const seg of parts) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') stack.pop()
    else stack.push(seg)
  }
  const base = '/' + stack.join('/')
  for (const cand of [base, base + '.js', base + '.jsx', base + '/index.js', base + '/index.jsx']) {
    if (files[cand]) return cand
  }
  return null
}

// The set of sibling file keys that `source` actually imports (relative only).
function importedSiblingPaths(source, fromPath, files) {
  const set = new Set()
  if (typeof source !== 'string') return set
  const re = /import\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]/g
  let m
  while ((m = re.exec(source))) {
    const resolved = resolveRelImport(m[1], fromPath, files)
    if (resolved) set.add(resolved)
  }
  return set
}

// Match SEARCH against a contiguous run of lines comparing trimmed text, so
// leading/trailing whitespace differences don't block an otherwise-clear edit.
function fuzzyLineReplace(content, search, replace) {
  const cLines = content.split('\n')
  const sLines = search.split('\n')
  if (!sLines.length) return null
  const norm = (s) => s.trim()
  for (let i = 0; i + sLines.length <= cLines.length; i++) {
    let ok = true
    for (let j = 0; j < sLines.length; j++) {
      if (norm(cLines[i + j]) !== norm(sLines[j])) { ok = false; break }
    }
    if (ok) {
      const before = cLines.slice(0, i)
      const after = cLines.slice(i + sLines.length)
      const repl = replace === '' ? [] : replace.split('\n')
      return [...before, ...repl, ...after].join('\n')
    }
  }
  return null
}

// ── The pipeline ─────────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string} opts.prompt          user's app request
 * @param {object|string} [opts.context] approved artifacts (brief, spec, etc.)
 * @param {object} [opts.providerConfig] per-stage provider overrides
 * @param {(evt:object)=>void} [opts.onProgress] progress callback (real, not faked)
 */
export async function runAppPipeline({ prompt, context, chosenStyle, providerConfig = {}, onProgress } = {}) {
  const progress = []
  const startedAt = Date.now()
  const emit = (stage, message, extra = {}) => {
    // Derive a real "time remaining" estimate from elapsed time vs. % complete.
    // This is honest extrapolation (no fake countdown): as work actually
    // progresses, the estimate sharpens. Only meaningful once we're underway.
    let etaSeconds
    const pct = typeof extra.percent === 'number' ? extra.percent : undefined
    if (pct && pct > 4 && pct < 100) {
      const elapsed = (Date.now() - startedAt) / 1000
      etaSeconds = Math.max(1, Math.round((elapsed * (100 - pct)) / pct))
    } else if (pct >= 100) {
      etaSeconds = 0
    }
    const evt = { stage, message, provider: resolveStageProvider(stage === 'done' || stage === 'assemble' ? 'codegen' : stage, providerConfig), etaSeconds, ...extra }
    progress.push(evt)
    try { onProgress?.(evt) } catch {}
  }

  // Local CPU-bound models (Ollama) are slow per token — use a lighter budget
  // (fewer files, smaller outputs) so local builds finish in a tolerable time.
  // Cloud providers (Claude) keep the full budget for maximum quality.
  const lite = resolveStageProvider('codegen', providerConfig) === 'ollama'
  const maxFiles = lite ? 5 : MAX_FILES

  // Chosen design direction from the style carousel (optional). When present it
  // becomes a HARD design constraint threaded into every codegen prompt so the
  // built app matches the preview the user picked, plus any opinion they typed.
  const cs = chosenStyle || context?.chosenStyle
  const styleDirective = cs
    ? `\n\nCHOSEN DESIGN DIRECTION (the user picked this from a preview — MATCH IT FAITHFULLY): "${cs.label || cs.id}". ${cs.vibe || ''}${cs.direction ? ` ${cs.direction}` : ''}${cs.previewCode ? `\n\nThe user selected this EXACT preview screen. Reuse its color palette, typography, spacing, and component styling as the foundation for the whole app — the finished app must look like it belongs in the same product as this screen:\n\`\`\`jsx\n${cs.previewCode}\n\`\`\`` : ''}${context?.styleOpinion ? `\n\nUSER'S DESIGN OPINION / TWEAKS (apply these on top of the chosen direction): ${context.styleOpinion}` : ''}`
    : (context?.styleOpinion ? `\n\nUSER'S DESIGN NOTES (apply these): ${context.styleOpinion}` : '')

  // 1) PLAN
  emit('plan', 'Analyzing approved artifacts and planning the app architecture…', { percent: 6 })
  const plan = await generateWithModel({
    taskType: 'plan', system: PLAN_SYSTEM, prompt, context,
    expectedOutputFormat: 'json', maxTokens: lite ? 1200 : 2500, providerConfig,
  })
  const appName = plan?.appName || 'Aria App'
  emit('plan', `Planned "${appName}" with ${safeArray(plan?.screens).length} screens and ${safeArray(plan?.components).length} components.`, { appName, percent: 16 })

  const files = { ...scaffoldFiles(appName) }
  const errors = []
  let fileList = []   // the generated file manifest (set by both branches below)
  const isSimple = String(plan?.complexity || '').toLowerCase() === 'simple'

  // ── SIMPLE APP → ONE self-contained /App.js. No file tree, no local imports,
  //    so there is literally nothing to mismatch. This is the common case
  //    (timers, calculators, to-dos) and it should never produce a broken app. ──
  if (isSimple) {
    fileList = [{ path: '/App.js', purpose: 'Self-contained single-file app', type: 'entry' }]
    emit('file_tree', 'Single-file app — generating everything in /App.js…', { percent: 28 })
    emit('codegen', 'Writing /App.js…', { total: 1, percent: 40 })
    try {
      const content = await generateWithModel({
        taskType: 'codegen', system: SINGLE_FILE_CODEGEN_SYSTEM,
        prompt: `Build the complete app as a single /App.js file. App: "${appName}". ${plan?.summary || ''}${styleDirective}`,
        context: { appName, summary: plan?.summary, features: plan?.features, uiSections: plan?.uiSections, state: plan?.state },
        expectedOutputFormat: 'text', maxTokens: lite ? 2800 : 4500, providerConfig,
      })
      const cleaned = stripFences(content)
      if (cleaned) files['/App.js'] = cleaned
      else errors.push({ path: '/App.js', error: 'empty output' })
    } catch (err) {
      errors.push({ path: '/App.js', error: err.message })
    }
    emit('codegen', 'Wrote /App.js.', { index: 1, total: 1, percent: 86 })
  } else {
    // ── STANDARD APP → multi-file, generated in DEPENDENCY ORDER so every file
    //    can see the REAL source of what it imports (kills import contract drift).
    //    Tier 1: data + lib (no local deps) → Tier 2: components (see data/lib) →
    //    Tier 3: /App.js (sees everything). Files within a tier run in parallel. ──
    emit('file_tree', 'Designing the project file tree…', { percent: 20 })
    const treeResult = await generateWithModel({
      taskType: 'file_tree', system: FILE_TREE_SYSTEM,
      prompt: 'Produce the file list for this plan.', context: plan,
      expectedOutputFormat: 'json', maxTokens: 1500, providerConfig,
    })
    fileList = safeArray(treeResult?.files).filter(f => f?.path && !['/index.js', '/public/index.html'].includes(f.path))
    if (!fileList.some(f => f.path === '/App.js')) {
      fileList.unshift({ path: '/App.js', purpose: 'Root component composing the app', type: 'entry' })
    }
    fileList = fileList.slice(0, maxFiles)
    emit('file_tree', `Planned ${fileList.length} files.`, { files: fileList.map(f => f.path), percent: 28 })

    const total = fileList.length
    let completed = 0

    // Generate one file. `deps` is the list of already-written paths whose REAL
    // source we hand to the model as the import contract.
    const genFile = async (f, deps) => {
      try {
        const dependencyFiles = deps
          .filter(p => files[p])
          .map(p => ({ path: p, source: files[p] }))
        const content = await generateWithModel({
          taskType: 'codegen', system: CODEGEN_SYSTEM,
          prompt: `Generate the complete contents of ${f.path} now. Purpose: ${f.purpose || 'part of the app'}.\nYou may import ONLY from the files in dependencyFiles, and only names they actually export.${styleDirective}`,
          context: {
            appPlan: { appName, summary: plan?.summary, features: plan?.features, entities: plan?.entities, seedData: plan?.seedData },
            thisFile: { path: f.path, purpose: f.purpose, type: f.type },
            dependencyFiles,
          },
          expectedOutputFormat: 'text', maxTokens: lite ? 2200 : 4000, providerConfig,
        })
        const cleaned = stripFences(content)
        if (cleaned) files[f.path] = cleaned
        else errors.push({ path: f.path, error: 'empty output' })
      } catch (err) {
        errors.push({ path: f.path, error: err.message })
      } finally {
        completed++
        emit('codegen', `Wrote ${f.path} (${completed} of ${total})…`, { path: f.path, index: completed, total, percent: 30 + Math.round((completed / total) * 56) })
      }
    }

    const dataLibFiles = fileList.filter(f => f.path !== '/App.js' && (f.type === 'data' || f.type === 'lib'))
    const componentFiles = fileList.filter(f => f.path !== '/App.js' && f.type !== 'data' && f.type !== 'lib')
    const appFile = fileList.find(f => f.path === '/App.js')
    const concurrency = lite ? 1 : 4
    const runTier = async (tier, deps) => {
      for (let i = 0; i < tier.length; i += concurrency) {
        await Promise.all(tier.slice(i, i + concurrency).map(f => genFile(f, deps)))
      }
    }

    emit('codegen', `Generating ${fileList.length} files in dependency order…`, { total, percent: 30 })
    // Tier 1: data/lib (no local deps).
    await runTier(dataLibFiles, [])
    const dataLibPaths = dataLibFiles.map(f => f.path)
    // Tier 2: components — see real source of all data/lib files.
    await runTier(componentFiles, dataLibPaths)
    // Tier 3: /App.js — sees real source of everything else.
    if (appFile) await genFile(appFile, [...dataLibPaths, ...componentFiles.map(f => f.path)])
  }

  // 4) ASSEMBLE — guarantee a runnable entry exists even if codegen missed App.js
  emit('assemble', 'Assembling the project…', { percent: 90 })
  if (!files['/App.js']) {
    files['/App.js'] = `import React from "react";
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-700">
      <div className="text-center">
        <div className="text-4xl mb-3">⚙️</div>
        <p className="text-sm">App generation incomplete — try regenerating.</p>
      </div>
    </div>
  );
}`
  }

  // 4b) STUB MISSING LOCAL IMPORTS — the model sometimes imports a CSS or
  // component file it never wrote (e.g. `import './App.css'`). Sandpack treats a
  // missing module as a hard build error, blanking the whole preview. Scan every
  // file's relative imports and create a harmless stub for anything missing so a
  // single hallucinated import can't kill the entire app.
  stubMissingImports(files)

  // 4c) CREATIVE POLISH PASS — the functional app now exists; hand it to the
  // UI/UX Creative Director + Polish Agent. It infers the app's domain, writes a
  // domain-specific creative brief, and rewrites each file to that brief while
  // strictly preserving behavior (failed/empty polish keeps the original file).
  // Opt-out via APP_POLISH_PASS=off. Skipped if every source file errored.
  let creativeBrief = null
  const polishOn = String(process.env.APP_POLISH_PASS || 'on').toLowerCase() !== 'off'
  if (polishOn) {
    try {
      const polished = await runPolishPass({ files, plan, fileList, providerConfig, styleDirective, lite, emit })
      creativeBrief = polished.brief
      Object.assign(files, polished.files)
      stubMissingImports(files)
      for (const e of polished.errors || []) errors.push(e)
    } catch (err) {
      errors.push({ stage: 'polish', error: err.message })
    }
  }

  // 5) SUMMARY
  emit('summary', 'Finalizing…', { percent: 98 })
  let summary = ''
  try {
    summary = stripFences(await generateWithModel({
      taskType: 'summary', system: SUMMARY_SYSTEM,
      prompt: 'Summarize what was built.', context: { appName, summary: plan?.summary, screens: plan?.screens },
      expectedOutputFormat: 'text', maxTokens: 300, providerConfig,
    }))
  } catch { summary = plan?.summary || `Built ${appName}.` }

  emit('done', `Generated ${Object.keys(files).length} files for "${appName}".`, { fileCount: Object.keys(files).length, errorCount: errors.length, percent: 100 })

  return {
    appName,
    plan,
    fileTree: fileList,
    files,
    summary,
    creativeBrief,
    errors,
    progress,
    entry: '/App.js',
    runtime: 'sandpack-react',
  }
}

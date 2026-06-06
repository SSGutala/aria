# ARIA — Project Context for Claude

> This file loads automatically into every Claude Code session. It exists so the
> founder (Sai) never has to re-explain the vision, the architecture, or past
> decisions again. Keep it current. If a decision changes, edit this file.

---

## What Aria is (the vision — do NOT ask the user to re-explain this)

Aria is an **AI-native enterprise workflow builder** — positioned as a "Jarvis for the
Corporate Employee." Employees describe an operational need in plain English and Aria
produces a tangible, role-aware deliverable: an internal app/tool, an automated workflow,
enterprise documentation (PRDs, SOPs, briefs), or an analytics view.

Long-term it becomes a governed enterprise AI execution layer (multi-agent, audit trails,
identity-aware execution, M365/SharePoint/CRM integration). Full vision lives in
`ARIA_Validation_Report.docx`. The MVP focus is **intent → working internal app**.

**Differentiators we MUST preserve (these are ahead of competitors like Lovable):**
- Role-aware intake (role + seniority materially change questions, labels, output depth)
- Conversational requirements gathering before building
- Enterprise document/workflow generation alongside apps
- Per-chat role override

Lovable beats us on ONE thing only: the actual generated app quality. Everything around
the app (intake, role-awareness, docs, workflows) is our moat. We fix the app core without
losing the moat.

---

## Stack

- **Frontend:** React + Vite (`src/`), dev server on `:5173`
- **Backend (local):** Express `server.js` on `:3001` — stands in for Vercel serverless
  functions in `api/`. Each `api/*.js` is a handler; `server.js` wires routes to them.
- **DB + Auth:** Supabase (Postgres + RLS). Service key for admin ops.
- **AI:** routed via `api/ai-client.js` → `api/lib/orchestrator.js` across claude/groq/ollama.
- **Model policy (DECIDED 2026-06-03 — HYBRID, user-chosen):** Default = **Groq**
  (`DEFAULT_AI_MODEL=groq`, `APP_ENGINE_PROVIDER=groq`). Groq is FREE, fast, and runs
  `llama-3.3-70b-versatile` (smart tier) — real quality, no Anthropic credits needed.
  **Claude is an opt-in** the user flips in Settings when they want max quality.
  Ollama remains a fully-local $0 option but is NOT default — on the user's Intel
  CPU Mac the only runnable model is `qwen2.5-coder:1.5b`, which produces toy-grade
  apps (this is a hardware ceiling, not a bug). DO NOT silently revert the default
  to claude or ollama — the user explicitly chose Groq-default + Claude-opt-in after
  seeing 1.5b Ollama produce garbage for a "LinkedIn clone" request.

---

## Root causes of "our apps are bad" (diagnosed 2026-05-20)

Three independent problems were stacking. Two are fixed; one is the active rebuild.

1. **[FIXED] Default model was Groq llama-3.1-8b, not Claude.** `.env.local` had
   `DEFAULT_AI_MODEL=groq`. Every generation silently ran on a free 8B model. Changed to
   `claude`. The hardcoded `'groq'` fallback in `Workspace.jsx` was also changed to `claude`.

2. **[USER ACTION] Anthropic API account has no credits.** With Claude selected, the API
   returns `400 credit balance too low` and falls back to Groq. **Claude Max ≠ Anthropic API
   credits** — they're separate products/billing. The app uses the API (`ANTHROPIC_API_KEY`),
   NOT the Max subscription. User must add credits at console.anthropic.com. Until then all
   output silently degrades to llama-8b. **Do not judge generation quality while the API is
   out of credits.**

3. **[ACTIVE REBUILD] The app-builder is a template engine, not a code generator.**
   - `api/spec.js` asks Claude for a tiny JSON spec (~3,500 tokens): `layoutType` (1 of 11
     fixed options), fields, colors, status flow. NOT code.
   - `api/build.js` (~1,500 lines) feeds that spec into 1 of 11 hand-written HTML render
     functions (`renderKanban`, `renderQueueDetail`, `renderCommandCenter`, …).
   - Output = one monolithic HTML blob (React+Babel via CDN) shown in `<iframe srcDoc>`.
   - **Result: every app is one of 11 templates with swapped labels/colors.** No amount of
     prompt tuning raises the ceiling. This is THE thing to replace.

---

## Locked decision: the new app-generation engine (decided 2026-05-20)

Target = **Lovable Cloud parity**:

- **Multi-file React project**, written entirely by Claude (no templates). Real components,
  state, data layer — bespoke per app.
- **Live preview** the user can interact with (running app, not a static mockup). Local-first
  via a real dev server / sandbox runtime; production deploy is a later concern.
- **A managed backend exists** so apps actually work (data persists, forms save). The user
  should NOT have to hand-manage database tables — it's auto-provisioned and hidden, the way
  Lovable Cloud abstracts it. Under the hood this can be Supabase (already in stack).
- **First milestone = ONE flagship app type, end-to-end, flawless.** Prove the engine on one
  genuinely impressive, working, demoable app before going wide.
  - **Flagship = Approval / request tracker** (e.g. expense / leave / purchase-order approvals):
    requester submits a form → approver works a queue → status flows submitted→approved→paid.
    Exercises forms + lists + status transitions + role-based views + a real persistent backend.

Also requested: **surface credit/API errors visibly in the UI** instead of silently falling
back to a weaker model (founder asked for this repeatedly). **[DONE 2026-05-20]**

## Build progress

- **[DONE] Phase 1 — visible degraded-mode banner.** `api/ai-client.js` tracks `_lastFallback`
  (set when an intended Claude call degrades to Groq; cleared on Claude success).
  `GET /api/model-status` exposes it; `Workspace.jsx` polls every 15s + after each AI op and
  shows a yellow banner explaining credits/rate-limit and pointing to console.anthropic.com.
- **[BLOCKED ON USER] Phase 0 — add Anthropic API credits.** Until done, all generation
  silently degrades to llama-8b; do not build/judge the new engine against degraded output.
### App generation engine rebuild (2026-05-26) — reference: github.com/BernieTv/Lovable-Clone (MIT)
Current broken engine: `spec.js` (1 AI call → tiny JSON spec) → `build.js` (`routeToRenderer` fills
1 of 11 hardcoded HTML templates, NO AI at build time) → `generated_html` blob → iframe srcDoc.
That's why apps are instant, shallow, and repetitive.

Decisions (2026-05-26):
- **Staged structured-JSON pipeline** (NOT native tool-calling) through Aria's model router, so it
  works across Claude/Groq/Ollama. Stages: artifacts→plan→file tree→per-file codegen→(schema/
  automation)→files map→preview→validate→repair→edits.
- **Provider-agnostic** via `generateWithModel({provider,model,taskType,prompt,context,expectedOutputFormat})`.
- **Preview = Sandpack** (in-browser bundler, npm package — NO E2B/account/key/server). Apps target React + Tailwind.
- **Default codegen provider = Ollama** (local, $0 — validate the engine without Anthropic credits).
  Claude selectable per-stage. NO E2B/Inngest/Clerk/Prisma/tRPC (the clone's infra — all avoided).
- Reused from clone (logic only, MIT attribution): iterative loop + `<task_summary>` completion,
  files-map (`{path:content}`) as the project, anti-shallow prompt (full features, modular, no stubs),
  readFiles-for-edit-context, title/response generators.
- Phases: 1) router + staged pipeline  2) store files map as project asset + file-tree view
  3) Sandpack preview + validation  4) iterative edit loop  5) repair loop. Additive — does NOT
  touch onboarding/role/chat/artifact/doc/export systems or replace any UI.

**[DONE] Phase 1** (2026-05-26):
- `api/lib/modelRouter.js` — `generateWithModel({provider,model,taskType,prompt,context,expectedOutputFormat})`
  + `STAGE_DEFAULTS` (all Ollama by default; overridable per-stage via providerConfig). Wraps the
  orchestrator/ai-client; no vendor lock. (`model` per-call override accepted but not yet enforced — TODO.)
- `api/lib/appPipeline.js` — `runAppPipeline({prompt,context,providerConfig,onProgress})`: plan → file_tree
  → per-file codegen (file-by-file, Ollama-friendly) → assemble (deterministic scaffold: /public/index.html
  with Tailwind CDN + /index.js React root) → summary. Returns `{appName,plan,fileTree,files,summary,errors,progress,entry,runtime:'sandpack-react'}`.
  Anti-shallow prompts adapted from clone (MIT attribution in file header). MAX_FILES=12. React+Tailwind only, no CSS files, no external libs, no image URLs, static seed data.
- `api/generate-app.js` + `POST /api/generate-app` route — gathers approved artifacts (latest brief
  message + product_brief/data_model/workflow/automation/ux/app_spec artifacts) as context, runs pipeline,
  returns files map. Verified: route wired, validates input (400). NOT persisted yet (Phase 2), NOT wired to
  UI yet (Phase 3). Test locally for $0 with Ollama running.
**[DONE] Phase 2** (2026-05-27):
- New table **`app_projects`** (`supabase/migrations/20260527_app_projects.sql`) — files jsonb,
  app_plan, file_tree, summary, entry, runtime, provider_config, generation_errors, edit_history,
  validation, status, version + RLS. SEPARATE from legacy `generated_apps` (whose NOT NULL/CHECK
  constraints don't fit multi-file projects). **USER MUST RUN THIS MIGRATION in Supabase SQL editor.**
- `generate-app.js` now persists pipeline output to `app_projects` (best-effort try/catch — still
  returns the project if the table isn't created yet) and returns `{...result, projectId, project}`.
- `src/components/AppProjectViewer.jsx` — Aria-styled file-tree + read-only code viewer (no new deps),
  reusable by Phase 3. `generateAppProject()` client helper added to `src/lib/claude.js`.
- Frontend not yet wired to a button (Phase 3). Load projects via `supabase.from('app_projects')` (RLS-protected).
**[DONE] Phase 3** (2026-05-27):
- Installed `@codesandbox/sandpack-react@^2.20.0` (client pkg, no service/key).
- `src/components/AppPreview.jsx` — Sandpack live in-browser preview of the files map (template "react",
  Tailwind via CDN in /public/index.html). Bundler errors surface in Sandpack's overlay = validation signal.
- `src/components/AppProjectPanel.jsx` — Preview/Code tabs (reuses AppProjectViewer); optional onEdit input bar (Phase 4).
- Wired Build button (spec card + enterprise_brief card) → `handleGenerateApp` (new engine) in Workspace.jsx.
  Honest progress label (no faked stage completion). On error, auto-falls-back to legacy `handleBuildApp`.
  Result renders in a full-screen overlay (`currentProject` state) via AppProjectPanel.
- Build compiles (main bundle +~0.6MB from Sandpack — TODO: React.lazy the preview to code-split).
**[DONE] Phase 4 + 5** (2026-05-27):
- `runAppEdit({files,plan,editRequest,providerConfig})` in `appPipeline.js` — identifies the minimal
  affected files (edit-plan stage) → regenerates ONLY those (or adds new ones) → merges → summary.
  Safety net: if planner finds nothing, edits /App.js.
- `api/edit-app.js` + `POST /api/edit-app` — loads app_projects, runs the edit, persists updated files,
  bumps version, appends `edit_history`. Best-effort persist (returns edited files even if table missing).
- **Phase 5 repair = an edit** seeded with error text (`isRepair:true, errorText`). "✦ Fix with AI"
  button in AppProjectPanel appears when `generation_errors` exist and calls the repair path.
- Client `editAppProject(projectId, editRequest, {isRepair,errorText})`; Workspace `handleEditProject`
  wired to AppProjectPanel `onEdit` + the edit input bar.
- All compiles; both routes validate (400). Live Sandpack-runtime-error auto-capture for repair is a
  refinement (currently repair seeds from recorded generation_errors or the user's described problem).

### Streaming progress UI (2026-05-27)
- `/api/generate-app` streams NDJSON when `stream:true` (or Accept: application/x-ndjson): `{type:'progress',stage,message,percent}` per event, then `{type:'result',...}`. Pipeline emits real `percent` per stage (plan 6/16, file_tree 20/28, codegen 30→86 by file index, assemble 90, summary 95, done 100).
- Client `generateAppProjectStream(convId, prompt, {onEvent})` reads the stream; falls back to non-stream. Workspace shows a real, monotonic **percentage bar** (genProgress state) above the input while generating — driven by actual events, not faked. `@keyframes pulse` added to index.css.

### Hardware reality (user's machine — IMPORTANT)
- User is on an **Intel Mac** (Core i5-1038NG7, 16GB) — Ollama runs **100% CPU, no GPU accel**.
- **qwen2.5-coder:7b is too slow** here (couldn't finish "say hi" in 3 min). Switched to
  **`OLLAMA_MODEL=qwen2.5-coder:1.5b`** (responds in ~24s cold, faster warm). 7b still on disk (`ollama rm qwen2.5-coder:7b` to reclaim 4.7GB).
- Added **"lite mode"** in appPipeline: when codegen provider is ollama → maxFiles 5 (vs 12), plan 1200 tok (vs 2500), codegen 2200 tok (vs 4000). Claude path unchanged (full quality).
- **Verified working:** streaming emits live events, runs on Ollama (no Groq fallback). But local builds are SLOW on this CPU (several minutes). **For fast, high-quality builds → use Claude (needs Anthropic API credits); flip codegen provider via providerConfig.** Local Ollama is for $0 plumbing validation.

### App engine status: Phases 1–5 COMPLETE (all additive, legacy /api/build preserved as fallback)
**Manual steps to test live:** (1) run `supabase/migrations/20260527_app_projects.sql`; (2) have Ollama
running locally (e.g. `ollama serve` + a coding model like `qwen2.5-coder`) OR add Anthropic credits and
set provider to claude. Then click Build on a spec/brief card → staged generation → Sandpack preview.
**Follow-ups:** React.lazy the Sandpack preview (main bundle +~0.6MB); SSE for live per-stage progress;
per-call model override in modelRouter; capture live Sandpack runtime errors to auto-trigger repair.

### Document system overhaul (2026-05-20)
Goal: stop generating shallow pseudo-documents; produce enterprise-grade, role-aware,
editable, exportable corporate documents — any type the user asks for.
- **[DONE] `api/lib/documentTemplates.js`** — registry of 18 corporate doc types (PRD, SOP,
  technical spec, API spec, QA/test plan, deployment plan, runbook, process optimization,
  cost breakdown, ROI, risk assessment, compliance checklist, project charter, RACI,
  status report, business case, exec summary deck, feature scope) + dynamic template for
  ANY unknown type. Each defines requiredSections, minimumDepth, formatType, exportFormats,
  roleRelevance, validationRules. Functions: resolveDocumentType, buildDocumentSystemPrompt,
  buildDynamicTemplate, validateDocument, getEffectiveSections, getExportFormats, listDocumentTypes.
  Depth modes: brief | standard | enterprise (DEFAULT = enterprise). Formal docs auto-append
  governance fragments (assumptions, dependencies, risks, open questions, next steps, approvals).
- **[DONE] Content shape** = `{ documentType, label, format, depthMode, meta, sections:[{key,title,body,bullets,table}] }`.
  Stored in `artifacts.content` (NOTE: artifacts table has NO `metadata` column — keep doc
  meta inside `content`).
- **[DONE] `api/pm-document.js`** — registry-driven: resolve → deep prompt → generate →
  validateDocument → regenerate once if too thin → persist artifact → fire file gen.
- **[DONE] Section-aware exports** (`api/artifacts-generate-files.js`) — PDF/DOCX/XLSX/CSV/MD
  render the section shape as real documents/tables/sheets. Format dispatch prefers
  `content.exportFormats`, filtered to generatable formats (no fake buttons). pptx/png/svg
  not yet generated (presentation/diagram fall back to PDF) — TODO.
- **[DONE] Section-aware viewer** (`src/components/ArtifactViewer.jsx`) — `SectionDocView`
  renders any section doc; `contentToMarkdown` + export format list are section-aware;
  product_brief case now shows background/scope/dependencies/risks.
- **[DONE] Chat document router** (`src/pages/Workspace.jsx` `looksLikeDocumentRequest`) —
  "generate a PRD / create an SOP / make a finance breakdown" route to `/api/pm-document`,
  while app builds ("build a tracker app") still go to the app engine.
- **[DONE] Deeper brief** — `ENTERPRISE_BRIEF` depth mandate + `brief.js` richer field
  guidance (paragraphs, scope, dependencies, risks) + maxTokens 7500→11000.
- **[DONE] `ARTIFACT_EDIT` prompt** — "make it more detailed" now expands/deepens instead of
  shallow-rewrite; preserves the sections shape.
- **[TODO follow-ups]** ArtifactPanel "Add Document" modal still calls `/api/artifacts`
  (not registry-driven) — rewire to pm-document + add a depth-mode selector. Multi-doc
  requests ("generate all docs for approval") currently make one doc. Real PPTX export.
  TYPE_META has no entries for new doc types (header chip falls back to title — fine, polish).
- **[BLOCKED ON USER] Validate output quality** — needs Anthropic API credits; until then
  generation runs on llama-8b and will look shallow regardless of the new prompts.

---

## Key files

| Area | File |
|------|------|
| AI client (model routing, fallbacks) | `api/ai-client.js` |
| Orchestrator (tiers, traces, JSON parsing) | `api/lib/orchestrator.js` |
| Prompts | `api/lib/prompts.js` |
| Intake/triage entrypoint | `api/generate.js` |
| Engine handlers | `api/engines/{software,docs,automation,analytics}.js` |
| Spec generation (to be replaced) | `api/spec.js` |
| App build / template renderers (to be replaced) | `api/build.js` |
| Role orchestration | `api/lib/roleFlows.js` |
| Conversational fallback | `api/chat.js` |
| Main workspace UI | `src/pages/Workspace.jsx` |
| Generated app viewer | `src/pages/GeneratedApp.jsx` |
| Auth | `src/pages/Login.jsx`, `src/pages/SignupProfile.jsx` |

---

## Model policy (user directive, 2026-05-27) — IMPORTANT
- **Ollama is the STANDARD default, always.** Do NOT use Claude or Groq unless the user explicitly
  selects them in Settings. `.env.local` DEFAULT_AI_MODEL=ollama, VITE_DEFAULT_AI_MODEL=ollama.
- ai-client `resolvedModel` defaults to `ollama`. The Ollama path does **NOT fall back to Groq/Claude**
  (retries Ollama once, then errors clearly). Only the explicit Claude path retains its Groq fallback.
- Model switch was **removed from the input bar** (InputZone shows a read-only indicator) and **moved to
  Settings → "Generation model"** (persisted to `localStorage['aria_model']`; Workspace reads it on load,
  defaults to 'ollama'). Changing the model requires a workspace reload to apply.
- Degraded/credits banner now auto-expires after 2 min (getModelStatus TTL).
- NETWORK error message reworded: points at "Aria API server not running on :3001", not "check internet".
- App-build prompts no longer hijacked to doc-gen (APP_BUILD_SIGNALS override in looksLikeDocumentRequest).
- **CRITICAL ROUTING RULE (user directive):** the DEFAULT for any build brief is the FULL multi-artifact
  pipeline (brief.js → 7 editable stages: intake_summary, product_brief, workflow_map, data_model,
  automation_model, ux_recommendation, app_spec + workflow_diagram). The single-document generator
  (pm-document) is ONLY for SHORT, explicit requests like "generate a PRD"/"create an SOP"/"add a risk
  assessment". `looksLikeDocumentRequest` now returns false for messages > 240 chars (build briefs) and
  for APP_BUILD_SIGNALS. The conversational `/api/chat` handler only fires for explicit questions ('?')
  or when there's an active build — it must NEVER intercept build/continue requests.
  Do NOT add routing that diverts normal build briefs away from the full multi-artifact flow.
- Reminder: user is on Intel Mac CPU → OLLAMA_MODEL=qwen2.5-coder:1.5b (7b too slow). Quality/speed limited.

## Conventions

- Model: Claude (`claude-opus-4-7` for smart work). Never silently use Groq as a primary.
- Local dev: `node server.js` (:3001) + `npm run dev` (:5173). Restart `server.js` after
  editing any `api/*.js`.
- Commits: only when asked. Co-author trailer for Claude.
- `.env.local` is gitignored and holds live secrets — never commit it, never echo keys.

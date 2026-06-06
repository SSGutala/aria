# Parked flows — Briefs & Documentation

As of 2026-06-03 the workspace runs in **DIRECT BUILD MODE**: a build prompt goes
straight to staged app generation. The guided intake → discovery questions →
enterprise brief → corporate-document pipeline is **bypassed, not deleted**. This
file is the index for turning it back on later.

## The switch

`src/pages/Workspace.jsx`

```js
const DIRECT_BUILD_MODE = true   // flip to false to restore the guided flow
```

When `true`:
- `handleSubmit` routes build prompts directly to `handleGenerateApp()`.
- The document-request router (`looksLikeDocumentRequest` → `handleRequestDocument`)
  is skipped.
- Conversational/question detection still works (genuine questions get a chat reply).

Flip to `false` and the original behavior returns with no other changes.

## Code that is parked (still in the repo, just not reached)

### Frontend — `src/pages/Workspace.jsx`
- `runAnalyzeAndQuestion()` — classifies the prompt into an engine, shows the EngineIntakeCard.
- `handleEngineConfirm()` / `runEngineQuestions()` — engine confirmation → discovery questions.
- `handleBuildModeSelect()`, `handlePMPackageSelect()`, role-package handlers.
- `runBrief()` — generates the multi-artifact enterprise brief.
- `runSpec()` — quick-path app spec card.
- `handleRequestDocument()` — corporate document generation (PRD/SOP/etc.).

### Frontend components (still imported / renderable)
- `EngineIntakeCard.jsx`, `DocsTypeCard.jsx`
- `BuildModeCard.jsx`, `PMPackageCard.jsx`, `RolePackageCard.jsx`
- `SpecCard`, `ArtifactCard.jsx`, `ArtifactViewer.jsx`, `ArtifactPanel.jsx`
- `WorkflowDiagramCanvas.jsx`

### Backend
- `api/generate.js` — intake triage + engine routing + clarification questions.
- `api/engines/{software,docs,automation,analytics}.js` — per-engine handlers.
- `api/pm-document.js`, `api/lib/documentTemplates.js` — corporate document generation.
- Brief/spec generators reached via `api/generate.js` clarification stage.

### Client API wrappers — `src/lib/claude.js`
- `analyzeAndQuestion`, `getEngineQuestions`, `getModeQuestions`,
  `getPMPackageOrQuestions`, `getRolePackageOrQuestions`,
  `generateBrief`, `generateSpec`, `generatePMBrief`, `generateRoleBrief`,
  `requestPMDocument`.

## To re-enable

1. Set `DIRECT_BUILD_MODE = false` in `src/pages/Workspace.jsx`.
2. Restart nothing on the frontend (Vite HMR), refresh the browser.
3. (Optional) add a UI toggle so users can choose "just build" vs "guided build"
   instead of a hardcoded flag.

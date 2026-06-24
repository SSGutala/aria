# Chai

Isolated Next.js app under `apps/chai/` — AI-native workflow builder with rich artifact editors and external connectors.

## Quick start

```bash
cd apps/chai
cp .env.example .env.local
npm install
npm run db:push
npm run dev   # http://localhost:4321
```

Click **Create demo project** on the home page to seed artifacts + design mockups.

## Connectors (OAuth)

| Provider | Creates | Env vars |
|----------|---------|----------|
| Google | Docs, Sheets, Slides | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Microsoft 365 | Word, Excel, PowerPoint (OneDrive) | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` |
| Lucidchart | Diagram with **Standard Import** (flow nodes / roadmap tasks) | `LUCID_CLIENT_ID`, `LUCID_CLIENT_SECRET` |
| Figma | Template embed + plugin spec (cannot create files via REST) | `FIGMA_*`, `FIGMA_TEMPLATE_FILE_KEY` |

Settings → Connect each provider. On an artifact, **Connect** creates a real file in the user's account and embeds it.

## Figma plugin

Figma REST cannot create files. Use the bundled plugin:

1. In Figma: Plugins → Development → Import plugin from manifest → `apps/chai/figma-plugin/manifest.json`
2. Connect a design variant in Chai (Designs tab)
3. Run plugin → paste plugin-spec URL: `/api/integrations/figma/plugin-spec?variantId=...`

## PNG mockup capture

On the Designs tab, **Save PNG reference** captures the static HTML mockup via `html-to-image` and stores `previewImage` on the variant for Figma handoff.

## Isolation

This app does not import from the Aria root. See `apps/README.md`.

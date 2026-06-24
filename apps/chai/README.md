# Chai

Isolated Next.js app under `apps/chai/` — Phase 1–2: rich artifact editors + Google/Figma/Lucid connectors.

## Quick start

```bash
cd apps/chai
cp .env.example .env.local
npm install
npm run db:push
npm run dev   # http://localhost:4321
```

Click **Create demo project** on the home page.

## Connectors (OAuth)

| Provider | Creates |
|----------|---------|
| Google | Docs, Sheets, Slides |
| Lucidchart | Empty diagram (embed after connect) |
| Figma | Template embed + mockup spec comment |

Settings → Connect each provider. On an artifact, **Connect** creates a file in the user's account.

## Isolation

This app does not import from the Aria root. See `apps/README.md`.

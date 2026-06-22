# Apps (isolated projects)

This directory holds **separate applications** that live in the Aria repo for convenience but do **not** share code, config, or runtime with the main Aria app at the repository root.

## Isolation rules

Each subfolder under `apps/` must be fully self-contained:

| Must have (per app) | Must NOT do |
|---------------------|-------------|
| Own `package.json` and `node_modules/` | Import from `../../src`, `../../api`, or any root Aria path |
| Own dev/build/start scripts | Modify root `package.json`, `vite.config.js`, `server.js`, or `vercel.json` |
| Own `.env` / `.env.example` (gitignored) | Share Supabase project, API keys, or deploy targets unless intentional |
| Own README with app-specific setup | Add npm/yarn/pnpm workspaces at repo root without an explicit decision |

Changes inside `apps/<name>/` must not affect the root Aria app. The root app does not reference anything under `apps/`.

## Working on an app

```bash
cd apps/<app-name>
npm install
npm run dev   # or whatever scripts the app defines
```

Run Aria separately from the repo root:

```bash
cd /path/to/aria
npm run dev
```

## When a new repo makes more sense

Stay in this monorepo when you want one git history, shared docs, and easy local access to both codebases. Create a **new repository** when:

- A different team owns the second product
- You need separate CI/CD, releases, or access control
- Licensing or open-source boundaries differ
- The second app has a long-term independent lifecycle and the monorepo feels noisy

For a solo founder experimenting with a second product, **same repo + isolated folder is a good plan**.

## Adding a new app

1. Copy `greenfield/` to `apps/<your-app-name>/` (or scaffold fresh).
2. Rename the `name` field in `package.json`.
3. Keep all source, config, and env inside that folder.

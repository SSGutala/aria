# Aria — AI-Native Enterprise Workflow Builder

Aria is a chat-based web app where users describe an internal business tool in plain English and receive a fully functional, deployed application.

## Stack

- **Frontend:** React + Vite
- **Styling:** Tailwind CSS
- **Database + Auth:** Supabase
- **AI Generation:** Anthropic Claude API (`claude-sonnet-4-5`)
- **Email:** Resend
- **Deployment:** Vercel

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon key
- `ANTHROPIC_API_KEY` — your Anthropic API key (server-side only, set in Vercel)
- `RESEND_API_KEY` — your Resend API key (server-side only, set in Vercel)
- `VITE_APP_URL` — your deployed Vercel URL (e.g. `https://aria.vercel.app`)

For the serverless functions you also need:
- `SUPABASE_SERVICE_KEY` — your Supabase service role key (for server-side operations)

### 3. Supabase setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase-schema.sql`
3. Enable Email auth in Authentication → Providers

### 4. Local development

```bash
npm run dev
```

For local API testing, use [Vercel CLI](https://vercel.com/docs/cli):

```bash
npm install -g vercel
vercel dev
```

### 5. Deploy to Vercel

```bash
vercel --prod
```

Set all environment variables in your Vercel project settings (Dashboard → Settings → Environment Variables). The `ANTHROPIC_API_KEY` and `RESEND_API_KEY` must only be set as server-side env vars (not prefixed with `VITE_`).

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Login / signup |
| `/workspace` | Main workspace (requires auth) |
| `/workspace/:convId` | Specific conversation (requires auth) |
| `/app/:slug` | Generated app view (public) |

## API Routes

| Route | Description |
|-------|-------------|
| `POST /api/generate` | Main AI generation engine |
| `POST /api/submit` | Handle form submissions |
| `POST /api/update-status` | Update submission status |

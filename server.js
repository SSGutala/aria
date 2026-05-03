import fetch, { Headers, Request, Response, FormData } from 'node-fetch'
if (!globalThis.fetch) globalThis.fetch = fetch
if (!globalThis.Headers) globalThis.Headers = Headers
if (!globalThis.Request) globalThis.Request = Request
if (!globalThis.Response) globalThis.Response = Response
if (!globalThis.FormData) globalThis.FormData = FormData

import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually
try {
  const envLocal = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  envLocal.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=')
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  })
} catch {}

import express from 'express'
import cors from 'cors'

const app = express()
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  process.env.FRONTEND_URL,
].filter(Boolean)

// Public routes that generated apps call from any domain
const publicRoutes = ['/api/submit', '/api/submissions', '/api/update-status']

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, same-origin server calls)
    if (!origin) return cb(null, true)
    // Allow any netlify.app subdomain (generated apps are embedded there)
    if (origin.includes('.netlify.app')) return cb(null, true)
    // Allow any onrender.com (server-to-server calls)
    if (origin.includes('.onrender.com')) return cb(null, true)
    if (allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json())

// Dynamically load each API handler
async function loadHandler(name) {
  const mod = await import(`./api/${name}.js`)
  return mod.default
}

app.post('/api/generate', async (req, res) => {
  const handler = await loadHandler('generate')
  return handler(req, res)
})

app.post('/api/spec', async (req, res) => {
  const handler = await loadHandler('spec')
  return handler(req, res)
})

app.post('/api/build', async (req, res) => {
  const handler = await loadHandler('build')
  return handler(req, res)
})

app.post('/api/edit', async (req, res) => {
  const handler = await loadHandler('edit')
  return handler(req, res)
})

app.post('/api/brief', async (req, res) => {
  const handler = await loadHandler('brief')
  return handler(req, res)
})

// ─── Artifacts ────────────────────────────────────────────────────────────────
app.get('/api/artifacts', async (req, res) => {
  const handler = await loadHandler('artifacts')
  return handler(req, res)
})
app.post('/api/artifacts', async (req, res) => {
  const handler = await loadHandler('artifacts')
  return handler(req, res)
})
app.patch('/api/artifacts/:id', async (req, res) => {
  const handler = await loadHandler('artifacts')
  return handler(req, res)
})
app.post('/api/artifacts/ai-edit', async (req, res) => {
  const { default: h } = await import('./api/artifacts-ai-edit.js')
  return h(req, res)
})
app.post('/api/artifacts/:id/files', async (req, res) => {
  const { default: h } = await import('./api/artifacts-generate-files.js')
  return h(req, res)
})
// Serve a file inline for preview / direct download
app.get('/api/artifacts/:id/download/:format', async (req, res) => {
  const { createClient: cc } = await import('@supabase/supabase-js')
  const sb = cc(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY)
  const { data: artifact } = await sb.from('artifacts').select('file_urls,title').eq('id', req.params.id).single()
  if (!artifact?.file_urls?.[req.params.format]) return res.status(404).json({ error: 'File not found — generate files first' })
  // Redirect to Supabase public URL
  return res.redirect(artifact.file_urls[req.params.format])
})

app.post('/api/submit', async (req, res) => {
  const handler = await loadHandler('submit')
  return handler(req, res)
})

app.post('/api/update-status', async (req, res) => {
  const handler = await loadHandler('update-status')
  return handler(req, res)
})

app.get('/api/submissions', async (req, res) => {
  const handler = await loadHandler('submissions')
  return handler(req, res)
})

// ─── M365 routes ─────────────────────────────────────────────────────────────
app.get('/api/m365/auth', async (req, res) => {
  const { default: h } = await import('./api/m365/auth.js')
  return h(req, res)
})
app.get('/api/m365/callback', async (req, res) => {
  const { default: h } = await import('./api/m365/callback.js')
  return h(req, res)
})
app.get('/api/m365/status', async (req, res) => {
  const { default: h } = await import('./api/m365/status.js')
  return h(req, res)
})
app.post('/api/m365/disconnect', async (req, res) => {
  const { default: h } = await import('./api/m365/disconnect.js')
  return h(req, res)
})
app.get('/api/m365/sharepoint-sites', async (req, res) => {
  const { default: h } = await import('./api/m365/sharepoint-sites.js')
  return h(req, res)
})
app.get('/api/m365/teams-channels', async (req, res) => {
  const { default: h } = await import('./api/m365/teams-channels.js')
  return h(req, res)
})

// ─── Document generation ─────────────────────────────────────────────────────
app.post('/api/documents/generate', async (req, res) => {
  const { default: h } = await import('./api/documents/generate.js')
  return h(req, res)
})

// ─── Integration execution ───────────────────────────────────────────────────
app.post('/api/integrations/execute', async (req, res) => {
  const { default: h } = await import('./api/integrations/execute.js')
  return h(req, res)
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})

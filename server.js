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
app.use(cors())
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

app.post('/api/submit', async (req, res) => {
  const handler = await loadHandler('submit')
  return handler(req, res)
})

app.post('/api/update-status', async (req, res) => {
  const handler = await loadHandler('update-status')
  return handler(req, res)
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})

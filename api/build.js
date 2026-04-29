import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

function generateSlug(title) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${base}-${rand}`
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found')
  return JSON.parse(match[0])
}

// ─── Generate the full custom HTML app ───────────────────────────────────────
async function generateAppHTML(spec, appId, simplified = false) {
  const { primary, light, text: textColor } = spec.colorTheme || {}
  const p = primary || '#7C3AED'
  const l = light || '#F5F3FF'
  const t = textColor || '#2E1065'
  const apiBase = process.env.API_BASE_URL || 'http://localhost:3001'
  const layoutType = spec.layoutType || 'split'

  const layoutInstructions = {
    kanban: `
LAYOUT — KANBAN BOARD:
- Full-width horizontal columns, one per status
- Each column has a header with status name + card count badge
- Cards inside each column show key submission info at a glance
- A prominent "+ ${spec.primaryActionLabel || 'Add Item'}" button in the top nav opens a MODAL FORM
- Clicking a card could expand it to show all details
- Drag feel (visual only, no actual DnD needed) — cards should look like they belong in columns
- Empty columns show a dashed placeholder with encouraging text
- The board should scroll horizontally if there are many columns`,

    feed: `
LAYOUT — INTAKE FEED:
- Fixed left sidebar (320px) contains the form — always visible, never scrolls away
- Right side is a scrollable feed of submission cards
- Each card shows: primary field value (bold headline), secondary fields as metadata chips, status badge (colored), ticket ID, date
- Filter pills above the feed to filter by status
- Cards animate in with a subtle fade
- The form sidebar has a colored accent top border using PRIMARY color
- Empty feed shows a friendly illustration-style empty state`,

    split: `
LAYOUT — SPLIT VIEW:
- Left panel (380px fixed): the submission form with a gradient header using PRIMARY color
- Right panel (flex): tabbed or filtered data table/list
- Stats bar below the top nav: total count + per-status counts as colored chips
- Table has: ticket ID, key fields (first 3-4), status dropdown (inline, colored), date
- Filter tabs across the top of the right panel
- Rows have subtle hover state
- The form should feel like a polished SaaS intake form`,
  }

  const prompt = `You are a senior product engineer at a world-class SaaS company (think Linear, Notion, Vercel). Your job is to generate a COMPLETE, production-quality web application as a single self-contained HTML file.

This app must feel like it was purpose-built for this exact use case — NOT a generic form template. Every label, placeholder, empty state, color choice, and layout decision should reflect the specific domain.

═══ APP SPECIFICATION ═══
Title: "${spec.appTitle}"
Tagline: "${spec.tagline || ''}"
Purpose: "${spec.purpose}"
Workflow type: ${spec.workflowType}
Primary action: "${spec.primaryActionLabel || 'Submit'}"
Fields: ${JSON.stringify(spec.fields, null, 2)}
Status flow: ${JSON.stringify(spec.statusFlow)}
Primary color: ${p}
Light color: ${l}
Text color: ${t}

═══ LAYOUT TO BUILD ═══
${layoutInstructions[layoutType] || layoutInstructions.split}

═══ API ENDPOINTS (fetch, CORS enabled) ═══
const API = '${apiBase}'
const APP_ID = '${appId}'

// Load submissions on mount and after actions
GET \`\${API}/api/submissions?appId=\${APP_ID}\`
→ { submissions: [{ id, ticket_id, data: {field_name: value}, status, submitted_at }] }

// Submit form
POST \`\${API}/api/submit\`
body: JSON.stringify({ appId: APP_ID, formData: { field_name: value } })
headers: { 'Content-Type': 'application/json' }
→ { ticketId: "XXX-001", submission: { id, ... } }

// Update status inline
POST \`\${API}/api/update-status\`
body: JSON.stringify({ submissionId: "uuid", status: "New Status", appId: APP_ID })
headers: { 'Content-Type': 'application/json' }

═══ HTML STRUCTURE (use exactly this shell) ═══
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${spec.appTitle}</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif; background: #F8FAFC; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes modalIn { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: none; } }
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 2px; }
</style>
</head>
<body>
<div id="root"></div>
<div id="error-overlay" style="display:none;position:fixed;inset:0;background:#FEF2F2;padding:40px;font-family:monospace;font-size:13px;color:#991B1B;white-space:pre-wrap;overflow:auto;z-index:9999"></div>
<script>
window.onerror = function(msg, src, line, col, err) {
  var el = document.getElementById('error-overlay')
  if (el) { el.style.display = 'block'; el.textContent = 'JS Error: ' + msg + '\nLine: ' + line + '\n\n' + (err && err.stack ? err.stack : '') }
}
window.addEventListener('unhandledrejection', function(e) {
  var el = document.getElementById('error-overlay')
  if (el) { el.style.display = 'block'; el.textContent = 'Promise Error: ' + (e.reason && e.reason.stack ? e.reason.stack : e.reason) }
})
</script>
<script type="text/babel">
const { useState, useEffect, useCallback, useRef, Fragment } = React

const API = '${apiBase}'
const APP_ID = '${appId}'
const PRIMARY = '${p}'
const LIGHT = '${l}'
const TEXT_COLOR = '${t}'
const STATUS_OPTIONS = ${JSON.stringify(spec.statusFlow)}
const FIELDS = ${JSON.stringify(spec.fields)}
const PRIMARY_ACTION = '${spec.primaryActionLabel || 'Submit'}'

// Status colors — cycle through these per status index
const STATUS_COLORS = [
  { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6', border: '#BFDBFE' },
  { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', border: '#BBF7D0' },
  { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444', border: '#FECACA' },
  { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316', border: '#FED7AA' },
  { bg: '#F5F3FF', text: '#6D28D9', dot: '#8B5CF6', border: '#DDD6FE' },
  { bg: '#ECFEFF', text: '#0E7490', dot: '#06B6D4', border: '#A5F3FC' },
]
const statusColor = (status) => {
  const idx = STATUS_OPTIONS.indexOf(status)
  return STATUS_COLORS[idx >= 0 ? idx % STATUS_COLORS.length : 0]
}

// ─── Write your complete React app below ─────────────────────────────────────
// Requirements:
// 1. UNIQUE to "${spec.appTitle}" — not a generic template. Every detail matters.
// 2. Load submissions on mount with useEffect → GET /api/submissions
// 3. Handle all states: loading (spinner), error (friendly message), empty (encouraging CTA)
// 4. Form submission: POST /api/submit → show success with ticket ID → refresh list
// 5. Status updates: inline dropdown/selector → POST /api/update-status → optimistic update
// 6. The nav/header must show app name, live status dot, entry count, and primary action button
// 7. Domain-specific touches: use real-world labels, help text, placeholders for ${spec.appTitle}
// 8. Animations: cards fadeIn on load, modal scales in, status updates flash briefly
// 9. All colors use PRIMARY (${p}), LIGHT (${l}), TEXT_COLOR (${t}) variables — no hardcoded colors for brand elements

// ─── YOUR COMPLETE APP CODE GOES HERE ────────────────────────────────────────
// CRITICAL RULES TO AVOID BLANK PAGE:
// 1. Define ALL components BEFORE the ReactDOM.createRoot call
// 2. The LAST line of this script must be: ReactDOM.createRoot(document.getElementById('root')).render(<App />)
// 3. Never use import/export — everything is in one script
// 4. Use React.Fragment or <> </> not import Fragment
// 5. All variables (API, APP_ID, PRIMARY, etc.) are already defined above — use them directly
// 6. Keep code concise — avoid deeply nested components
// 7. Always wrap ReactDOM.createRoot in try/catch

// Define your App component and any sub-components here, then render at the bottom:

try {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />)
} catch(e) {
  document.getElementById('error-overlay').style.display = 'block'
  document.getElementById('error-overlay').textContent = 'Render error: ' + e.message + '\n' + e.stack
}
</script>
</body>
</html>

═══ DESIGN RULES ═══
- Enterprise tool: clean, professional, high information density
- Every label/placeholder must feel authentic to ${spec.appTitle}
- Status badges use STATUS_COLORS — distinct color per status
- Primary button: PRIMARY color, white text
- Form fields: #F8FAFC bg, border turns PRIMARY on focus
- Empty states: icon + headline + subtext + CTA
- Loading: spinner with PRIMARY border color
- Ticket IDs in monospace. Dates as "May 12" format.
- Write CONCISE, efficient React — avoid unnecessary verbosity
- IMPORTANT: The complete HTML must fit in one response. Keep components lean.

Return ONLY the complete HTML. Must end with </html>. No markdown, no explanation.`

  // On retry, use a much simpler prompt that produces less code
  const finalPrompt = simplified ? `Generate a simple but complete working React web app for: "${spec.appTitle}"
Purpose: ${spec.purpose}
Fields: ${spec.fields.map(f => f.label).join(', ')}
Statuses: ${spec.statusFlow.join(', ')}
Color: ${p}
API base: ${apiBase}, App ID: ${appId}

Use this exact shell:
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${spec.appTitle}</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>*{box-sizing:border-box}body{margin:0;font-family:sans-serif;background:#f8fafc}</style>
</head><body><div id="root"></div>
<script type="text/babel">
const {useState,useEffect}=React
const API='${apiBase}',APP_ID='${appId}',PRIMARY='${p}'

function App(){
  // WRITE A SIMPLE WORKING APP HERE
  // Load submissions: GET API+'/api/submissions?appId='+APP_ID
  // Submit form: POST API+'/api/submit' body:{appId:APP_ID,formData:{...}}
  // Update status: POST API+'/api/update-status' body:{submissionId,status,appId:APP_ID}
  return <div>Loading...</div>
}

try{ReactDOM.createRoot(document.getElementById('root')).render(<App/>)}catch(e){document.body.innerHTML='<pre style="color:red">'+e.message+'</pre>'}
</script></body></html>

Keep it under 200 lines. Return ONLY the HTML.` : prompt

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 16000,
    system: 'You are an expert React/HTML engineer. Return only the complete HTML document, nothing else. No markdown fences, no explanation. The HTML MUST end with </html>.',
    messages: [{ role: 'user', content: finalPrompt }],
  })

  // Extract text content only
  const raw = msg.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  // Strip any accidental markdown fences
  let html = raw.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim()

  // Validate completeness
  const isComplete = html.includes('</html>') && html.includes('ReactDOM.createRoot') && html.includes('function App')
  if (!isComplete) {
    console.warn('Generated HTML incomplete — retrying with simplified prompt')
    return generateAppHTML(spec, appId, true) // retry flag
  }

  return html
}

// ─── Generate lean metadata schema ───────────────────────────────────────────
async function generateSchema(spec) {
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: 'Return only valid JSON, no explanation.',
    messages: [{
      role: 'user',
      content: `Generate a metadata schema for this app spec. Return JSON only:
{
  "appTitle": "${spec.appTitle}",
  "workflowType": "${spec.workflowType}",
  "layoutType": "${spec.layoutType || 'split'}",
  "colorTheme": ${JSON.stringify(spec.colorTheme)},
  "fields": ${JSON.stringify(spec.fields)},
  "statusOptions": ${JSON.stringify(spec.statusFlow)},
  "defaultStatus": "${spec.statusFlow[0]}",
  "primaryActionLabel": "${spec.primaryActionLabel || 'Submit'}",
  "integrations": ${JSON.stringify(spec.integrations || {})},
  "roles": ${JSON.stringify(spec.roles || [])}
}`,
    }],
  })

  try {
    return extractJSON(msg.content[0].text)
  } catch {
    // Return a safe fallback schema
    return {
      appTitle: spec.appTitle,
      workflowType: spec.workflowType,
      layoutType: spec.layoutType || 'split',
      colorTheme: spec.colorTheme,
      fields: spec.fields,
      statusOptions: spec.statusFlow,
      defaultStatus: spec.statusFlow[0],
      primaryActionLabel: spec.primaryActionLabel || 'Submit',
      integrations: spec.integrations || {},
      roles: spec.roles || [],
    }
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, conversationId, spec, clarificationAnswers } = req.body
  if (!prompt || !conversationId || !spec) return res.status(400).json({ error: 'Missing fields' })

  try {
    const slug = generateSlug(spec.appTitle)
    const tableName = 'app_' + slug.replace(/-/g, '_')

    const convData = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single()

    // Generate metadata schema
    const schema = await generateSchema(spec)

    // Insert the app record first to get the appId
    const { data: appData, error: appError } = await supabase
      .from('generated_apps')
      .insert({
        conversation_id: conversationId,
        user_id: convData.data?.user_id,
        title: spec.appTitle,
        workflow_type: spec.workflowType,
        schema,
        table_name: tableName,
        notification_config: schema.notificationConfig || {},
        status: 'deployed',
        slug,
      })
      .select()
      .single()

    if (appError) throw new Error(appError.message)

    // Now generate the full custom HTML with the real appId embedded
    const generatedHtml = await generateAppHTML(spec, appData.id)

    // Update the record with the generated HTML and mark as deployed
    await supabase
      .from('generated_apps')
      .update({
        generated_html: generatedHtml,
        status: 'deployed',
      })
      .eq('id', appData.id)

    // Save the app_card message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      message_type: 'app_card',
      metadata: { schema, slug, appId: appData.id },
    })

    await supabase.from('conversations').update({
      title: spec.appTitle,
      updated_at: new Date().toISOString(),
    }).eq('id', conversationId)

    return res.json({ type: 'app_card', schema, slug, appId: appData.id })

  } catch (err) {
    console.error('Build error:', err)
    return res.status(500).json({ error: err.message || 'Build failed. Please try again.' })
  }
}

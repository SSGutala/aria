/**
 * Generate a filled document from a template + form data
 * POST /api/documents/generate
 * Body: { appId, submissionId, templateId?, formData, deliverTo? }
 */
import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'
import { sendOutlookEmail } from '../m365/graph.js'
import Anthropic from '@anthropic-ai/sdk'

const require = createRequire(import.meta.url)
const PizZip = require('pizzip')
const Docxtemplater = require('docxtemplater')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Generate a .docx from base64 template + data ───────────────────────────
function fillDocxTemplate(base64Template, data) {
  const content = Buffer.from(base64Template, 'base64')
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  })
  doc.render(data)
  const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  return buf.toString('base64')
}

// ─── Generate HTML document via Claude ──────────────────────────────────────
async function generateHTMLDocument(schema, formData, templateDescription) {
  const fieldLines = Object.entries(formData)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2048,
    system: 'You are a professional document writer. Return only clean HTML document content, no markdown, no explanation.',
    messages: [{
      role: 'user',
      content: `Generate a professional ${templateDescription || 'business document'} using this data:

App: ${schema.appTitle}
Form data:
${fieldLines}

Return a complete, well-formatted HTML document with:
- Professional header with app name
- Clearly organized sections
- All submitted data presented clearly
- Footer with date
- Clean, print-ready styling in a <style> tag
- No external dependencies`
    }],
  })

  return msg.content[0].text
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { appId, submissionId, formData, deliverTo, userId, templateDescription } = req.body
  if (!appId || !formData) return res.status(400).json({ error: 'Missing required fields' })

  try {
    // Get app schema
    const { data: app } = await supabase.from('generated_apps').select('*').eq('id', appId).single()
    if (!app) return res.status(404).json({ error: 'App not found' })

    const schema = app.schema || {}
    const integrations = schema.integrations || {}

    // Check if there's a stored docx template
    const { data: template } = await supabase
      .from('document_templates')
      .select('*')
      .eq('app_id', appId)
      .single()

    let documentBase64 = null
    let documentName = `${schema.appTitle || 'document'}-${Date.now()}`
    let htmlContent = null

    if (template?.template_content && template.template_type === 'docx') {
      // Fill existing .docx template
      documentBase64 = fillDocxTemplate(template.template_content, formData)
      documentName += '.docx'
    } else {
      // Generate HTML document via Claude
      const desc = templateDescription || integrations.documentGeneration?.templateDescription || schema.appTitle
      htmlContent = await generateHTMLDocument(schema, formData, desc)
      documentBase64 = Buffer.from(htmlContent).toString('base64')
      documentName += '.html'
    }

    // Deliver via Outlook if requested
    if (deliverTo && userId) {
      const emailBody = htmlContent || `
        <html><body>
          <h2>${schema.appTitle} — Document</h2>
          <p>Please find your generated document attached.</p>
        </body></html>
      `

      await sendOutlookEmail(userId, {
        to: Array.isArray(deliverTo) ? deliverTo : [deliverTo],
        subject: `${schema.appTitle} — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        body: emailBody,
        attachments: documentBase64 && !htmlContent ? [{
          name: documentName,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          contentBytes: documentBase64,
        }] : [],
      })
    }

    // Update submission record with doc info
    if (submissionId) {
      await supabase.from('app_submissions').update({
        data: { ...(formData), _documentGenerated: true, _documentName: documentName },
      }).eq('id', submissionId)
    }

    return res.json({
      success: true,
      documentName,
      documentBase64: htmlContent ? null : documentBase64, // return for client download
      htmlContent: htmlContent || null,
      delivered: !!deliverTo,
    })
  } catch (err) {
    console.error('Document generation error:', err)
    return res.status(500).json({ error: err.message })
  }
}

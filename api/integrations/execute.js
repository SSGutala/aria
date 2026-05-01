/**
 * Execute M365 integration actions after a form submission
 * POST /api/integrations/execute
 * Body: { appId, submissionId, formData, userId }
 */
import { createClient } from '@supabase/supabase-js'
import {
  sendOutlookEmail,
  addSharePointListItem,
  ensureSharePointList,
  postTeamsMessage,
  getConnection,
} from '../m365/graph.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

function interpolate(template, data) {
  return template.replace(/\{(\w+)\}/g, (_, key) => data[key] || key)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { appId, submissionId, formData, userId, ticketId } = req.body
  if (!appId || !formData) return res.status(400).json({ error: 'Missing required fields' })

  // Get app and its integration config
  const { data: app } = await supabase.from('generated_apps').select('*').eq('id', appId).single()
  if (!app) return res.status(404).json({ error: 'App not found' })

  const schema = app.schema || {}
  const integrations = schema.integrations || {}
  const appOwnerId = app.user_id

  // Use app owner's M365 connection (the person who built the app)
  const conn = await getConnection(appOwnerId)
  const results = { sharepoint: null, outlook: null, teams: null, document: null }
  const errors = []

  // ─── SharePoint ──────────────────────────────────────────────────────────
  if (integrations.sharepoint?.enabled && conn) {
    try {
      const sp = integrations.sharepoint
      const siteId = sp.siteId

      if (siteId) {
        // Ensure list exists
        let listId = sp.listId
        if (!listId) {
          listId = await ensureSharePointList(appOwnerId, siteId, app.title, schema.fields || [])
          // Cache the list ID back into the schema
          await supabase.from('generated_apps').update({
            schema: { ...schema, integrations: { ...integrations, sharepoint: { ...sp, listId } } }
          }).eq('id', appId)
        }

        const spFields = { Title: formData[schema.fields?.[0]?.name] || ticketId || 'Submission', ...formData, TicketId: ticketId }
        await addSharePointListItem(appOwnerId, siteId, listId, spFields)
        results.sharepoint = 'success'
      }
    } catch (err) {
      console.error('SharePoint error:', err.message)
      errors.push({ integration: 'sharepoint', error: err.message })
    }
  }

  // ─── Outlook email ───────────────────────────────────────────────────────
  if (integrations.outlook?.enabled && conn) {
    try {
      const ol = integrations.outlook
      // Find recipient email from form data
      const toEmail = ol.toField ? formData[ol.toField] : ol.toEmail
      const ccEmails = ol.ccEmails || []

      if (toEmail) {
        const allFields = (schema.fields || []).filter(f => f.name !== 'status')
        const tableRows = allFields.map(f => `
          <tr>
            <td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #F3F4F6;white-space:nowrap">${f.label}</td>
            <td style="padding:8px 12px;color:#111827;border-bottom:1px solid #F3F4F6">${formData[f.name] || '—'}</td>
          </tr>`).join('')

        const emailBody = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto">
            <div style="background:${schema.colorTheme?.primary||'#7C3AED'};padding:24px 28px;border-radius:12px 12px 0 0">
              <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">${app.title}</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px">New submission received</p>
            </div>
            <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:24px 28px">
              <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
                ${tableRows}
              </table>
              <div style="background:#F9FAFB;border-radius:8px;padding:12px 16px;font-size:12px;color:#6B7280">
                Reference: <strong style="font-family:monospace">${ticketId || submissionId}</strong>
                · Submitted ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
              </div>
            </div>
          </div>`

        const recipients = [toEmail, ...ccEmails]
        const subject = interpolate(ol.subject || `New ${app.title} submission — {ticketId}`, { ...formData, ticketId: ticketId || '' })

        await sendOutlookEmail(appOwnerId, { to: recipients, subject, body: emailBody })
        results.outlook = 'success'
      }
    } catch (err) {
      console.error('Outlook error:', err.message)
      errors.push({ integration: 'outlook', error: err.message })
    }
  }

  // ─── Teams notification ──────────────────────────────────────────────────
  if (integrations.teams?.enabled && conn) {
    try {
      const t = integrations.teams
      if (t.teamId && t.channelId) {
        const firstField = schema.fields?.[0]
        const primaryValue = firstField ? formData[firstField.name] : 'submission'
        const messageTemplate = t.messageTemplate || `📋 New <b>${app.title}</b> submission: <b>{primary}</b> — ref <code>{ticketId}</code>`
        const message = interpolate(messageTemplate, { ...formData, primary: primaryValue, ticketId: ticketId || '' })

        await postTeamsMessage(appOwnerId, { teamId: t.teamId, channelId: t.channelId, message })
        results.teams = 'success'
      }
    } catch (err) {
      console.error('Teams error:', err.message)
      errors.push({ integration: 'teams', error: err.message })
    }
  }

  // ─── Document generation + email ─────────────────────────────────────────
  if (integrations.documentGeneration?.enabled && conn) {
    try {
      const dg = integrations.documentGeneration
      const deliveryEmail = dg.deliveryField ? formData[dg.deliveryField] : dg.deliveryEmail

      if (deliveryEmail) {
        // Call the document generation endpoint internally
        const docRes = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3001'}/api/documents/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId, submissionId, formData,
            deliverTo: deliveryEmail,
            userId: appOwnerId,
            templateDescription: dg.templateDescription,
          }),
        })
        const docResult = await docRes.json()
        results.document = docResult.success ? 'delivered' : `error: ${docResult.error}`
      }
    } catch (err) {
      console.error('Document generation error:', err.message)
      errors.push({ integration: 'document', error: err.message })
    }
  }

  return res.json({ results, errors })
}

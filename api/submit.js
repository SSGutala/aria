import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { appId, formData } = req.body
  if (!appId || !formData) return res.status(400).json({ error: 'Missing required fields' })

  try {
    const { data: app, error: appError } = await supabase
      .from('generated_apps')
      .select('*')
      .eq('id', appId)
      .single()
    if (appError || !app) return res.status(404).json({ error: 'App not found' })

    // generate ticket ID
    const { count } = await supabase
      .from('app_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('app_id', appId)

    const prefix = (app.title || 'APP')
      .split(/\s+/)
      .map(w => w[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 4) || 'APP'
    const ticketId = `${prefix}-${String((count || 0) + 1).padStart(3, '0')}`

    const schema = app.schema || {}
    const defaultStatus = schema.defaultStatus || (schema.statusOptions?.[0]) || 'Pending'

    const { data: submission, error: subError } = await supabase
      .from('app_submissions')
      .insert({
        app_id: appId,
        ticket_id: ticketId,
        data: formData,
        status: defaultStatus,
      })
      .select()
      .single()

    if (subError) throw new Error(subError.message)

    const notif = app.notification_config || {}
    const appUrl = `${process.env.VITE_APP_URL || 'https://aria.vercel.app'}/app/${app.slug}`
    const fieldEntries = Object.entries(formData).map(([k, v]) => {
      const field = (schema.fields || []).find(f => f.name === k)
      return `${field?.label || k}: ${v}`
    }).join('\n')

    // send emails — failures must not block response
    try {
      if (notif.sendConfirmationToSubmitter && notif.submitterEmailField && formData[notif.submitterEmailField]) {
        await resend.emails.send({
          from: 'aria@aria-app.com',
          to: formData[notif.submitterEmailField],
          subject: `Your request has been submitted — ${ticketId}`,
          text: `Your ${app.title} request has been received.\n\nTicket ID: ${ticketId}\n\n${fieldEntries}\n\nYou will be notified when the status changes.`,
        })
      }
    } catch (emailErr) {
      console.error('Submitter email failed:', emailErr)
    }

    try {
      if (notif.notifyOnSubmission && notif.notifyEmails?.length > 0) {
        const recipients = [...notif.notifyEmails]

        if (notif.priorityRouting && notif.priorityField && formData[notif.priorityField]) {
          const priorityVal = formData[notif.priorityField]
          const rule = (notif.priorityRules || []).find(r => r.value === priorityVal)
          if (rule?.emails) recipients.push(...rule.emails)
        }

        for (const email of recipients) {
          await resend.emails.send({
            from: 'aria@aria-app.com',
            to: email,
            subject: `New ${app.title} request — ${ticketId}`,
            text: `A new request has been submitted.\n\nTicket ID: ${ticketId}\n\n${fieldEntries}\n\nReview and update the status at: ${appUrl}`,
          }).catch(e => console.error('Notify email failed:', e))
        }
      }
    } catch (emailErr) {
      console.error('Notification email failed:', emailErr)
    }

    return res.json({ success: true, ticketId, submission })
  } catch (err) {
    console.error('Submit error:', err)
    return res.status(500).json({ error: err.message || 'Submission failed' })
  }
}

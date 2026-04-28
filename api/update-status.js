import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { submissionId, newStatus, appId } = req.body
  if (!submissionId || !newStatus || !appId) return res.status(400).json({ error: 'Missing required fields' })

  try {
    const { data: updated, error: updateErr } = await supabase
      .from('app_submissions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', submissionId)
      .select()
      .single()

    if (updateErr) throw new Error(updateErr.message)

    const { data: app } = await supabase
      .from('generated_apps')
      .select('*')
      .eq('id', appId)
      .single()

    if (app) {
      const notif = app.notification_config || {}
      const schema = app.schema || {}
      const appUrl = `${process.env.VITE_APP_URL || 'https://aria.vercel.app'}/app/${app.slug}`

      try {
        if (notif.submitterEmailField && updated.data?.[notif.submitterEmailField]) {
          await resend.emails.send({
            from: 'aria@aria-app.com',
            to: updated.data[notif.submitterEmailField],
            subject: `Your request ${updated.ticket_id} has been updated`,
            text: `Your ${app.title} request status has changed.\n\nTicket ID: ${updated.ticket_id}\nNew status: ${newStatus}\n\nView your request at: ${appUrl}`,
          })
        }
      } catch (emailErr) {
        console.error('Status update email failed:', emailErr)
      }
    }

    return res.json({ success: true, submission: updated })
  } catch (err) {
    console.error('Update-status error:', err)
    return res.status(500).json({ error: err.message || 'Update failed' })
  }
}

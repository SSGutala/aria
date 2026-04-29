/**
 * Check M365 connection status for a user
 * GET /api/m365/status?userId=xxx
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const { data } = await supabase
    .from('m365_connections')
    .select('email, display_name, connected_at, expires_at')
    .eq('user_id', userId)
    .single()

  if (!data) return res.json({ connected: false })

  const isExpired = new Date(data.expires_at) < new Date()
  return res.json({
    connected: true,
    email: data.email,
    displayName: data.display_name,
    connectedAt: data.connected_at,
    tokenExpired: isExpired,
  })
}

/**
 * Disconnect M365 account
 * POST /api/m365/disconnect
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  await supabase.from('m365_connections').delete().eq('user_id', userId)
  return res.json({ success: true })
}

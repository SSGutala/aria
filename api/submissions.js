/**
 * Load submissions for a generated app
 * GET /api/submissions?appId=xxx
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { appId } = req.query
  if (!appId) return res.status(400).json({ error: 'Missing appId' })

  const { data, error } = await supabase
    .from('app_submissions')
    .select('*')
    .eq('app_id', appId)
    .order('submitted_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ submissions: data || [] })
}

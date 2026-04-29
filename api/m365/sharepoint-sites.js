/**
 * List SharePoint sites the user has access to
 * GET /api/m365/sharepoint-sites?userId=xxx
 */
import { graphCall } from './graph.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  try {
    const data = await graphCall(userId, { path: '/sites?search=*&$select=id,displayName,webUrl&$top=20' })
    return res.json({ sites: data.value || [] })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

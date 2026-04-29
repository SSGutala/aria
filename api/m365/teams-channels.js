/**
 * List Teams and channels the user belongs to
 * GET /api/m365/teams-channels?userId=xxx
 */
import { graphCall } from './graph.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  try {
    const teamsData = await graphCall(userId, { path: '/me/joinedTeams?$select=id,displayName' })
    const teams = teamsData.value || []

    // For each team, get channels
    const results = await Promise.all(teams.slice(0, 10).map(async team => {
      try {
        const chanData = await graphCall(userId, { path: `/teams/${team.id}/channels?$select=id,displayName` })
        return { ...team, channels: chanData.value || [] }
      } catch {
        return { ...team, channels: [] }
      }
    }))

    return res.json({ teams: results })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

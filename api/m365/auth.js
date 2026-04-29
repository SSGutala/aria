/**
 * Initiate Microsoft OAuth2 flow
 * GET /api/m365/auth?userId=xxx
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const clientId = process.env.MICROSOFT_CLIENT_ID
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/m365/callback'

  if (!clientId) return res.status(500).json({ error: 'MICROSOFT_CLIENT_ID not configured' })

  const scopes = [
    'User.Read',
    'Mail.Send',
    'Sites.ReadWrite.All',
    'ChannelMessage.Send',
    'Files.ReadWrite.All',
    'offline_access',
  ].join(' ')

  const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64')

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    response_mode: 'query',
    prompt: 'select_account',
  })

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
  res.redirect(authUrl)
}

/**
 * Microsoft OAuth callback
 * GET /api/m365/callback?code=xxx&state=xxx
 */
import { createClient } from '@supabase/supabase-js'
import { getM365UserInfo } from './graph.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query

  if (error) {
    console.error('M365 OAuth error:', error, error_description)
    return res.redirect(`${process.env.VITE_APP_URL || 'http://localhost:5173'}/settings?m365=error&msg=${encodeURIComponent(error_description || error)}`)
  }

  if (!code || !state) return res.status(400).send('Missing code or state')

  let userId
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
    userId = decoded.userId
  } catch {
    return res.status(400).send('Invalid state')
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/m365/callback'

  // Exchange code for tokens
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    scope: 'User.Read Mail.Send Sites.ReadWrite.All ChannelMessage.Send Files.ReadWrite.All offline_access',
  })

  const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const tokens = await tokenRes.json()

  if (!tokenRes.ok) {
    console.error('Token exchange failed:', tokens)
    return res.redirect(`${process.env.VITE_APP_URL || 'http://localhost:5173'}/settings?m365=error&msg=${encodeURIComponent(tokens.error_description || 'Token exchange failed')}`)
  }

  // Get user info from Graph
  const userInfo = await getM365UserInfo(tokens.access_token)

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // Upsert connection record
  await supabase.from('m365_connections').upsert({
    user_id: userId,
    tenant_id: userInfo.id ? tokens.id_token?.split('.')[1] : 'common',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    email: userInfo.mail || userInfo.userPrincipalName,
    display_name: userInfo.displayName,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  // Redirect back to settings page with success
  res.redirect(`${process.env.VITE_APP_URL || 'http://localhost:5173'}/settings?m365=connected`)
}

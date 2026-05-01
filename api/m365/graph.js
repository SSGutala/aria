/**
 * Microsoft Graph API client
 * Handles token storage, refresh, and all Graph calls
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const TOKEN_URL = `https://login.microsoftonline.com/common/oauth2/v2.0/token`

// ─── Token management ────────────────────────────────────────────────────────

export async function getConnection(userId) {
  const { data } = await supabase
    .from('m365_connections')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export async function getValidAccessToken(userId) {
  const conn = await getConnection(userId)
  if (!conn) throw new Error('No M365 connection found. Please connect your Microsoft 365 account in Settings.')

  // If token expires in less than 5 minutes, refresh it
  const expiresAt = new Date(conn.expires_at)
  const needsRefresh = expiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (!needsRefresh) return conn.access_token

  // Refresh
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: conn.refresh_token,
    scope: 'User.Read Mail.Send Sites.ReadWrite.All ChannelMessage.Send Files.ReadWrite.All offline_access',
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Token refresh failed: ${data.error_description || data.error}`)

  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString()
  await supabase.from('m365_connections').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token || conn.refresh_token,
    expires_at: newExpiry,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)

  return data.access_token
}

// ─── Graph API call helper ───────────────────────────────────────────────────

export async function graphCall(userId, { method = 'GET', path, body, responseType = 'json' }) {
  const token = await getValidAccessToken(userId)
  const url = `https://graph.microsoft.com/v1.0${path}`

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(`Graph API error (${res.status}): ${err.error?.message || err.message}`)
  }

  if (responseType === 'buffer') return res.arrayBuffer()
  if (responseType === 'text') return res.text()
  if (res.status === 204) return null
  return res.json()
}

// ─── Outlook ─────────────────────────────────────────────────────────────────

export async function sendOutlookEmail(userId, { to, subject, body, attachments = [] }) {
  const message = {
    subject,
    body: { contentType: 'HTML', content: body },
    toRecipients: (Array.isArray(to) ? to : [to]).map(email => ({
      emailAddress: { address: email }
    })),
    attachments: attachments.map(a => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.name,
      contentType: a.contentType || 'application/octet-stream',
      contentBytes: a.contentBytes, // base64
    })),
  }

  await graphCall(userId, {
    method: 'POST',
    path: '/me/sendMail',
    body: { message, saveToSentItems: true },
  })

  return { success: true }
}

// ─── SharePoint ──────────────────────────────────────────────────────────────

export async function getSiteId(userId, siteUrl) {
  // siteUrl like "contoso.sharepoint.com:/sites/mysite"
  const data = await graphCall(userId, { path: `/sites/${siteUrl}` })
  return data.id
}

export async function ensureSharePointList(userId, siteId, listName, fields) {
  // Check if list exists
  try {
    const lists = await graphCall(userId, { path: `/sites/${siteId}/lists?$filter=displayName eq '${listName}'` })
    if (lists.value?.length > 0) return lists.value[0].id
  } catch {}

  // Create list
  const columnDefs = fields.map(f => ({
    name: f.name,
    text: f.type !== 'number' ? {} : undefined,
    number: f.type === 'number' ? {} : undefined,
  })).filter(Boolean)

  const list = await graphCall(userId, {
    method: 'POST',
    path: `/sites/${siteId}/lists`,
    body: {
      displayName: listName,
      columns: columnDefs,
      list: { template: 'genericList' },
    },
  })
  return list.id
}

export async function addSharePointListItem(userId, siteId, listId, fields) {
  const item = await graphCall(userId, {
    method: 'POST',
    path: `/sites/${siteId}/lists/${listId}/items`,
    body: { fields },
  })
  return item
}

// ─── Teams ───────────────────────────────────────────────────────────────────

export async function postTeamsMessage(userId, { teamId, channelId, message }) {
  return graphCall(userId, {
    method: 'POST',
    path: `/teams/${teamId}/channels/${channelId}/messages`,
    body: {
      body: { contentType: 'html', content: message },
    },
  })
}

// ─── User info ───────────────────────────────────────────────────────────────

export async function getM365UserInfo(accessToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res.json()
}

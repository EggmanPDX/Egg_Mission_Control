import type { GmailInboxData } from '../shared/ipc-types'
import { getGoogleAccessToken, getConnectedGoogleAccounts } from './google-auth.service'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>
}

interface GmailMessageMetadata {
  id: string
  payload: { headers: Array<{ name: string; value: string }> }
}

interface GmailLabel {
  id: string
  messagesUnread: number
}

async function gmailFetch(url: string, token: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status} ${response.statusText}`)
  }
  return response
}

function headerValue(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

/** Parses a "Display Name <email@x.com>" From header down to just the display name
 *  (or the bare address if there's no display name), matching Outlook's top-subjects shape. */
function parseFromDisplayName(from: string): string {
  const match = from.match(/^([^<]+)</)
  return match ? match[1].trim().replace(/^"|"$/g, '') : from.trim()
}

/** Fetches inbox data for a single connected Gmail account. Unread count comes from the
 *  INBOX system label's messagesUnread field, scoped to what actually shows as unread in
 *  Inbox — NOT the UNREAD label (which counts unread everywhere: Promotions, Updates,
 *  Social, archived-but-unread, etc., and reads far higher than what a user sees in Inbox),
 *  and NOT messages.list's resultSizeEstimate (Google documents this as an approximation). */
async function getGmailInboxDataForAccount(email: string): Promise<GmailInboxData> {
  const token = await getGoogleAccessToken(email)

  const [labelResponse, listResponse] = await Promise.all([
    gmailFetch(`${GMAIL_API_BASE}/labels/INBOX`, token),
    gmailFetch(`${GMAIL_API_BASE}/messages?q=${encodeURIComponent('in:inbox is:unread')}&maxResults=3`, token),
  ])

  const label = (await labelResponse.json()) as GmailLabel
  const listData = (await listResponse.json()) as GmailListResponse
  const topMessages = listData.messages ?? []

  const topSubjects = await Promise.all(
    topMessages.map(async (msg) => {
      const metaUrl = `${GMAIL_API_BASE}/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`
      const metaResponse = await gmailFetch(metaUrl, token)
      const meta = (await metaResponse.json()) as GmailMessageMetadata
      return {
        subject: headerValue(meta.payload.headers, 'Subject') || '(no subject)',
        from: parseFromDisplayName(headerValue(meta.payload.headers, 'From')),
      }
    })
  )

  return { email, unread: label.messagesUnread ?? 0, topSubjects }
}

/** Fetches inbox data for every connected Gmail account. Each account is isolated — one
 *  account's token expiring/failing doesn't drop the others from the result. */
export async function getGmailInboxData(): Promise<GmailInboxData[]> {
  const accounts = getConnectedGoogleAccounts()
  if (accounts.length === 0) return []

  const results = await Promise.allSettled(accounts.map((email) => getGmailInboxDataForAccount(email)))

  return results.flatMap((result, i) => {
    if (result.status === 'fulfilled') return [result.value]
    console.error(`[Gmail] fetch failed for ${accounts[i]}:`, result.reason)
    return []
  })
}

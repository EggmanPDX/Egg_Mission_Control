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

// ── Newsletter HTML fetching ─────────────────────────────────────────────────

// Keyed by the same names used in NewsletterEntry.name
const NEWSLETTER_SENDERS: Record<string, string> = {
  'The Rundown': 'news@daily.therundown.ai',
  'The Neuron': 'theneuron@newsletter.theneurondaily.com',
  'The Code': 'superhumancode@news.codenewsletter.ai',
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function findHtmlPart(payload: Record<string, unknown>): string | null {
  if ((payload.mimeType as string) === 'text/html') {
    const data = (payload.body as Record<string, string>)?.data
    return data ? decodeBase64Url(data) : null
  }
  const parts = payload.parts as Record<string, unknown>[] | undefined
  for (const part of parts ?? []) {
    const found = findHtmlPart(part)
    if (found) return found
  }
  return null
}

async function fetchNewsletterHtml(email: string, senderAddress: string): Promise<string | null> {
  const token = await getGoogleAccessToken(email)
  const q = `from:${senderAddress} newer_than:2d`
  const listResp = await gmailFetch(
    `${GMAIL_API_BASE}/messages?q=${encodeURIComponent(q)}&maxResults=1`,
    token
  )
  const listData = (await listResp.json()) as GmailListResponse
  const msgId = listData.messages?.[0]?.id
  if (!msgId) return null

  const msgResp = await gmailFetch(`${GMAIL_API_BASE}/messages/${msgId}?format=full`, token)
  const msg = (await msgResp.json()) as { payload: Record<string, unknown> }
  return findHtmlPart(msg.payload)
}

/** Fetch the most recent HTML body for each known newsletter sender.
 *  Uses the first connected Google account. Returns a map of name → HTML. */
export async function fetchNewsletterHtmlMap(): Promise<Record<string, string>> {
  const accounts = getConnectedGoogleAccounts()
  if (accounts.length === 0) return {}
  const email = accounts[0]
  const result: Record<string, string> = {}
  await Promise.allSettled(
    Object.entries(NEWSLETTER_SENDERS).map(async ([name, sender]) => {
      const html = await fetchNewsletterHtml(email, sender)
      if (html) result[name] = html
    })
  )
  return result
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

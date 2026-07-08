import type { CalendarEvent, InboxData, ChatMessage } from '../shared/ipc-types'
import { getAccessToken } from './auth.service'
import { MOCK_MODE, getMockPollResult } from './mock'

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'
const DEFAULT_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 32000
const MAX_RETRIES = 5

interface GraphCalendarEvent {
  id: string
  subject: string
  start: { dateTime: string }
  end: { dateTime: string }
  attendees: Array<{ emailAddress: { name: string } }>
  webLink?: string
  body?: { content: string; contentType: string }
  isOnlineMeeting?: boolean
  onlineMeeting?: { joinUrl: string }
  responseStatus?: { response: string }
}

interface GraphMessage {
  subject: string
  from: { emailAddress: { name: string; address: string } }
  isRead: boolean
}

interface GraphChat {
  id: string
  topic?: string
  unreadMessageCount?: number
  webUrl?: string
  lastMessagePreview?: {
    createdDateTime: string
    body: { content: string }
    from?: { user?: { displayName: string } }
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

async function fetchWithBackoff(
  url: string,
  token: string,
  method: string = 'GET',
  retryCount = 0
): Promise<Response> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    // Request UTC so dateTime values parse correctly as ISO 8601 without ambiguity
    'Prefer': 'outlook.timezone="UTC"',
  }

  const response = await fetch(url, { method, headers })

  if (response.status === 429) {
    if (retryCount >= MAX_RETRIES) {
      throw new Error(`Max retries exceeded (${MAX_RETRIES}) for ${url}`)
    }

    const retryAfter = response.headers.get('Retry-After')
    let backoffMs = DEFAULT_BACKOFF_MS * Math.pow(2, retryCount)
    backoffMs = Math.min(backoffMs, MAX_BACKOFF_MS)

    if (retryAfter) {
      const retryAfterSeconds = parseInt(retryAfter, 10)
      if (!isNaN(retryAfterSeconds)) backoffMs = retryAfterSeconds * 1000
    }

    await new Promise((resolve) => setTimeout(resolve, backoffMs))
    return fetchWithBackoff(url, token, method, retryCount + 1)
  }

  if (!response.ok) {
    throw new Error(`Graph API error: ${response.status} ${response.statusText}`)
  }

  return response
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  if (MOCK_MODE) return getMockPollResult().calendar

  const token = await getAccessToken()

  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0)
  const dateParams = `startDateTime=${encodeURIComponent(startOfDay.toISOString())}&endDateTime=${encodeURIComponent(endOfDay.toISOString())}`
  const selectFields = 'id,subject,start,end,attendees,webLink,body,isOnlineMeeting,onlineMeeting,responseStatus'

  // Enumerate all calendars so we don't miss events on secondary/shared calendars
  const calListResponse = await fetchWithBackoff(`${GRAPH_API_BASE}/me/calendars?$select=id`, token)
  const calListData = (await calListResponse.json()) as { value: Array<{ id: string }> }
  const calendarIds = calListData.value.map(c => c.id)

  // Query each calendar's view in parallel; ignore individual failures
  const settled = await Promise.allSettled(
    calendarIds.map(async (calId) => {
      const url = `${GRAPH_API_BASE}/me/calendars/${encodeURIComponent(calId)}/calendarView?${dateParams}&$select=${selectFields}&$top=100`
      const res = await fetchWithBackoff(url, token)
      return ((await res.json()) as { value: GraphCalendarEvent[] }).value
    })
  )

  const toUtc = (dt: string) => dt.endsWith('Z') ? dt : dt + 'Z'
  const seen = new Set<string>()
  const allEvents: CalendarEvent[] = []

  for (const result of settled) {
    if (result.status === 'rejected') continue
    for (const event of result.value) {
      if (seen.has(event.id)) continue
      seen.add(event.id)
      allEvents.push({
        id: event.id,
        subject: event.subject,
        start: toUtc(event.start.dateTime),
        end: toUtc(event.end.dateTime),
        attendees: event.attendees.map((a) => a.emailAddress.name),
        webLink: event.webLink,
        body: event.body ? stripHtml(event.body.content) : undefined,
        joinUrl: event.isOnlineMeeting ? event.onlineMeeting?.joinUrl : undefined,
        isPending: event.responseStatus?.response === 'none',
      })
    }
  }

  return allEvents.sort((a, b) => a.start.localeCompare(b.start))
}

export async function getInboxData(): Promise<InboxData> {
  if (MOCK_MODE) return getMockPollResult().inbox

  const token = await getAccessToken()

  // Fetch unread Outlook messages (top 3)
  const messagesUrl = `${GRAPH_API_BASE}/me/messages?$filter=isRead eq false&$top=3&$select=subject,from,isRead`
  const messagesResponse = await fetchWithBackoff(messagesUrl, token)
  const messagesData = (await messagesResponse.json()) as { value: GraphMessage[] }

  const outlookTopSubjects = messagesData.value.map((msg) => ({
    subject: msg.subject,
    from: msg.from.emailAddress.name || msg.from.emailAddress.address,
  }))

  // Count total unread
  const unreadCountUrl = `${GRAPH_API_BASE}/me/messages?$filter=isRead eq false&$select=id`
  const unreadCountResponse = await fetchWithBackoff(unreadCountUrl, token)
  const unreadCountData = (await unreadCountResponse.json()) as { value: unknown[] }
  const outlookUnread = unreadCountData.value.length

  // Fetch Teams chats with last message preview
  let teamsUnread: number | null = null
  let recentChats: ChatMessage[] = []

  try {
    const chatsUrl = `${GRAPH_API_BASE}/me/chats?$select=id,topic,unreadMessageCount,webUrl&$expand=lastMessagePreview&$top=5`
    const chatsResponse = await fetchWithBackoff(chatsUrl, token)
    const chatsData = (await chatsResponse.json()) as { value: GraphChat[] }

    teamsUnread = chatsData.value.reduce((sum, c) => sum + (c.unreadMessageCount || 0), 0)

    recentChats = chatsData.value
      .filter(c => c.lastMessagePreview)
      .map(c => ({
        chatId: c.id,
        from: c.lastMessagePreview?.from?.user?.displayName ?? 'Unknown',
        preview: stripHtml(c.lastMessagePreview?.body?.content ?? '').slice(0, 120),
        receivedAt: c.lastMessagePreview?.createdDateTime ?? '',
        webUrl: c.webUrl,
      }))
  } catch {
    // Teams Chat.Read scope may not be available
  }

  return { outlookUnread, outlookTopSubjects, teamsUnread, recentChats }
}

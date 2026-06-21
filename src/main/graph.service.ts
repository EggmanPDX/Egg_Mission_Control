import type { CalendarEvent, InboxData } from '../shared/ipc-types'
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
  organizer?: { emailAddress: { name: string } }
}

interface GraphMessage {
  subject: string
  from: {
    emailAddress: {
      name: string
      address: string
    }
  }
  isRead: boolean
}

interface GraphChat {
  id: string
  topic?: string
  unreadMessageCount?: number
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
  }

  const response = await fetch(url, { method, headers })

  // Handle throttling (429)
  if (response.status === 429) {
    if (retryCount >= MAX_RETRIES) {
      throw new Error(`Max retries exceeded (${MAX_RETRIES}) for ${url}`)
    }

    const retryAfter = response.headers.get('Retry-After')
    let backoffMs = DEFAULT_BACKOFF_MS * Math.pow(2, retryCount)
    backoffMs = Math.min(backoffMs, MAX_BACKOFF_MS)

    if (retryAfter) {
      const retryAfterSeconds = parseInt(retryAfter, 10)
      if (!isNaN(retryAfterSeconds)) {
        backoffMs = retryAfterSeconds * 1000
      }
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
  if (MOCK_MODE) {
    return getMockPollResult().calendar
  }

  const token = await getAccessToken()

  // Fetch events for today
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

  const startISO = startOfDay.toISOString()
  const endISO = endOfDay.toISOString()

  const url = `${GRAPH_API_BASE}/me/calendarView?startDateTime=${encodeURIComponent(startISO)}&endDateTime=${encodeURIComponent(endISO)}`

  const response = await fetchWithBackoff(url, token)
  const data = (await response.json()) as { value: GraphCalendarEvent[] }

  return data.value.map((event: GraphCalendarEvent) => ({
    id: event.id,
    subject: event.subject,
    start: event.start.dateTime,
    end: event.end.dateTime,
    attendees: event.attendees.map((a) => a.emailAddress.name),
    webLink: event.webLink,
  }))
}

export async function getInboxData(): Promise<InboxData> {
  if (MOCK_MODE) {
    return getMockPollResult().inbox
  }

  const token = await getAccessToken()

  // Fetch unread Outlook messages (top 3)
  const messagesUrl = `${GRAPH_API_BASE}/me/messages?$filter=isRead eq false&$top=3&$select=subject,from,isRead`
  const messagesResponse = await fetchWithBackoff(messagesUrl, token)
  const messagesData = (await messagesResponse.json()) as { value: GraphMessage[] }

  const outlookTopSubjects = messagesData.value.map((msg: GraphMessage) => ({
    subject: msg.subject,
    from: msg.from.emailAddress.name || msg.from.emailAddress.address,
  }))

  // Count total unread
  const unreadCountUrl = `${GRAPH_API_BASE}/me/messages?$filter=isRead eq false&$select=id`
  const unreadCountResponse = await fetchWithBackoff(unreadCountUrl, token)
  const unreadCountData = (await unreadCountResponse.json()) as { value: unknown[] }
  const outlookUnread = unreadCountData.value.length

  // Fetch Teams unread count (if available)
  let teamsUnread: number | null = null
  try {
    const chatsUrl = `${GRAPH_API_BASE}/me/chats?$select=id,topic,unreadMessageCount`
    const chatsResponse = await fetchWithBackoff(chatsUrl, token)
    const chatsData = (await chatsResponse.json()) as { value: GraphChat[] }
    teamsUnread = chatsData.value.reduce((sum, chat: GraphChat) => {
      return sum + (chat.unreadMessageCount || 0)
    }, 0)
  } catch {
    // Teams Chat.Read scope may not be available
    teamsUnread = null
  }

  return {
    outlookUnread,
    outlookTopSubjects,
    teamsUnread,
  }
}

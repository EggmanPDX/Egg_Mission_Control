export interface CalendarEvent {
  id: string
  subject: string
  start: string        // ISO 8601
  end: string          // ISO 8601
  attendees: string[]  // display names
  webLink?: string
  body?: string        // plain-text agenda/description
  joinUrl?: string      // direct Teams/Zoom join link, when the event is an online meeting
  isPending?: boolean  // true when responseStatus.response is "none" (no response yet)
}

export interface JobRadarEntry {
  id: string           // stable synthetic id (derived from apply_url) — Job Radar has no page-level Notion id
  title: string
  company: string
  location: string
  postedAgo: string
  applicants: string
  score: number
  reason: string
  applyUrl: string
}

export interface NewsletterArticle {
  headline: string
  headlineUrl?: string
  gist: string
  gistSegments?: Array<{ text: string; url?: string }>
}

export interface NewsletterEntry {
  name: string             // "The Rundown", "The Neuron", etc.
  found: boolean           // false when no issue was found in the last 24h
  subject?: string
  sender?: string
  summary?: string         // kept for backwards compat
  articles?: NewsletterArticle[]
  html?: string            // full HTML body fetched directly from Gmail
}

export interface NotionTask {
  id: string
  title: string
  priority: 'P1' | 'P2' | 'P3' | null
  status: string
  url: string
}

export interface ChatMessage {
  chatId: string
  from: string
  preview: string
  receivedAt: string   // ISO 8601
  webUrl?: string
}

export interface InboxData {
  outlookUnread: number
  outlookTopSubjects: Array<{ subject: string; from: string }>
  teamsUnread: number | null  // null = scope unavailable
  recentChats: ChatMessage[]
}

export interface GmailInboxData {
  email: string        // which connected Gmail account this is
  unread: number
  topSubjects: Array<{ subject: string; from: string }>
}

export interface PollResult {
  calendar: CalendarEvent[]
  inbox: InboxData
  d8Tasks: NotionTask[]
  eggTasks: NotionTask[]
  bgcTasks: NotionTask[]
  jobRadar: JobRadarEntry[]
  jobRadarUpdatedAt: string | null  // ISO 8601, parsed from the "Last updated: ..." callout
  newsletters: NewsletterEntry[]
  newslettersUpdatedAt: string | null  // ISO 8601, parsed from the "Last updated: ..." callout
  gmail: GmailInboxData[]  // one entry per connected Gmail account
}

export type TaskWorkspace = 'D8' | 'EGG' | 'BGC'

export interface IpcChannels {
  // renderer → main
  'get-poll-result': () => Promise<PollResult>
  'save-notion-token': (token: string) => Promise<{ ok: boolean; error?: string }>
  'validate-notion-token': (token: string) => Promise<{ ok: boolean; error?: string }>
  'is-notion-configured': () => Promise<boolean>
  'trigger-reauth': () => Promise<void>
  'is-google-configured': () => Promise<boolean>
  'get-connected-google-accounts': () => Promise<string[]>
  'trigger-google-reauth': () => Promise<{ ok: boolean; email?: string; error?: string }>
  'archive-notion-task': (taskId: string) => Promise<{ ok: boolean; error?: string }>
  'complete-notion-task': (taskId: string, workspace: TaskWorkspace) => Promise<{ ok: boolean; error?: string }>
  'move-notion-task': (taskId: string, from: TaskWorkspace, to: TaskWorkspace) => Promise<{ ok: boolean; error?: string }>
  // main → renderer (push events)
  'poll-update': PollResult
  'auth-state-change': { msGraphAuthed: boolean; notionConfigured: boolean; googleAuthed: boolean }
}

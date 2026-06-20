export interface CalendarEvent {
  id: string
  subject: string
  start: string        // ISO 8601
  end: string          // ISO 8601
  attendees: string[]  // display names
  webLink?: string
}

export interface NotionTask {
  id: string
  title: string
  priority: 'P1' | 'P2' | 'P3' | null
  status: string
  url: string
}

export interface InboxData {
  outlookUnread: number
  outlookTopSubjects: Array<{ subject: string; from: string }>
  teamsUnread: number | null  // null = scope unavailable
}

export interface PollResult {
  calendar: CalendarEvent[]
  inbox: InboxData
  d8Tasks: NotionTask[]
  eggTasks: NotionTask[]
}

export interface IpcChannels {
  // renderer → main
  'get-poll-result': () => Promise<PollResult>
  'save-notion-token': (token: string) => Promise<{ ok: boolean; error?: string }>
  'validate-notion-token': (token: string) => Promise<{ ok: boolean; error?: string }>
  'is-notion-configured': () => Promise<boolean>
  'trigger-reauth': () => Promise<void>
  // main → renderer (push events)
  'poll-update': PollResult
  'auth-state-change': { msGraphAuthed: boolean; notionConfigured: boolean }
}

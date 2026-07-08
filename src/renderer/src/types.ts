export type PanelStatus =
  | { state: 'loading' }
  | { state: 'ok' }
  | { state: 'empty' }
  | { state: 'error'; message: string; lastUpdated: Date | null }
  | { state: 'stale'; lastUpdated: Date }
  | { state: 'not-configured' }

export interface PanelState<T> {
  status: PanelStatus
  data: T | null
}

export type { CalendarEvent, NotionTask, InboxData, GmailInboxData, PollResult, TaskWorkspace, JobRadarEntry, ChatMessage, NewsletterEntry, NewsletterArticle } from '../../shared/ipc-types'

import type { CalendarEvent, NotionTask, ChatMessage, TaskWorkspace, JobRadarEntry, NewsletterEntry, NewsletterArticle } from '../../shared/ipc-types'

export type SelectedItem =
  | { type: 'calendar'; data: CalendarEvent }
  | { type: 'task'; data: NotionTask; workspace: TaskWorkspace }
  | { type: 'inbox'; data: { from: string; subject: string } }
  | { type: 'chat'; data: ChatMessage }
  | { type: 'job'; data: JobRadarEntry }
  | { type: 'newsletter'; data: NewsletterEntry }
  | { type: 'newsletter-story'; data: { newsletter: NewsletterEntry; article: NewsletterArticle } }

export type NavPanelId = 'meeting' | 'inbox' | 'd8' | 'bgc' | 'egg' | 'jobRadar' | 'newsletters'

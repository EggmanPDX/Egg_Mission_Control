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

export type { CalendarEvent, NotionTask, InboxData, PollResult, TaskWorkspace } from '../../shared/ipc-types'

import type { CalendarEvent, NotionTask, ChatMessage, TaskWorkspace } from '../../shared/ipc-types'

export type SelectedItem =
  | { type: 'calendar'; data: CalendarEvent }
  | { type: 'task'; data: NotionTask; workspace: TaskWorkspace }
  | { type: 'inbox'; data: { from: string; subject: string } }
  | { type: 'chat'; data: ChatMessage }

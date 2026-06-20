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

export type { CalendarEvent, NotionTask, InboxData, PollResult } from '../../shared/ipc-types'

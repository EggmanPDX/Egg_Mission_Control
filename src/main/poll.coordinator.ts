import { BrowserWindow, powerMonitor } from 'electron'
import { getCalendarEvents, getInboxData } from './graph.service'
import { getGmailInboxData } from './gmail.service'
import { fetchD8Tasks, fetchEggTasks, fetchBgcTasks, fetchJobRadar, fetchNewsletters } from './notion.service'
import { checkAndFire, scheduleMidnightClear } from './notification.scheduler'
import { getConfig } from './config'
import { isAuthed, getStoredNotionToken } from './auth.service'
import { isGoogleConfigured } from './google-auth.service'
import type { PollResult } from '../shared/ipc-types'

/**
 * PollCoordinator — orchestrates all data-fetching services
 *
 * Responsibilities:
 * - Poll Graph (calendar + inbox) at configured interval
 * - Poll Notion (D8 + Egg tasks) at configured interval
 * - Check and fire notifications every 60 seconds
 * - Run eager poll on startup
 * - Resume polling when system wakes from sleep
 * - Track last result and send updates to renderer via IPC
 */

let _lastResult: PollResult | null = null
let _graphTimerId: NodeJS.Timeout | null = null
let _notionTimerId: NodeJS.Timeout | null = null
let _notificationTimerId: NodeJS.Timeout | null = null
let _mainWindow: BrowserWindow | null = null

/**
 * Default merge template for poll results
 */
const DEFAULT_POLL_RESULT: PollResult = {
  calendar: [],
  inbox: { outlookUnread: 0, outlookTopSubjects: [], teamsUnread: null, recentChats: [] },
  d8Tasks: [],
  eggTasks: [],
  bgcTasks: [],
  jobRadar: [],
  jobRadarUpdatedAt: null,
  newsletters: [],
  newslettersUpdatedAt: null,
  gmail: [],
}

/**
 * Get the last poll result (cached)
 */
export function getLastResult(): PollResult | null {
  return _lastResult
}

/**
 * Poll Graph (calendar + inbox) and Gmail, and update _lastResult.
 * Each source is fetched independently (allSettled, not all) — Gmail commonly starts
 * unauthenticated (it's opt-in, separate from the Microsoft sign-in), and that must not
 * block Outlook calendar/inbox from updating.
 */
export async function pollGraph(): Promise<void> {
  const base = _lastResult ?? DEFAULT_POLL_RESULT
  const [calendarResult, inboxResult, gmailResult] = await Promise.allSettled([
    getCalendarEvents(),
    getInboxData(),
    getGmailInboxData(),
  ])

  const calendar = calendarResult.status === 'fulfilled' ? calendarResult.value : base.calendar
  const inbox = inboxResult.status === 'fulfilled' ? inboxResult.value : base.inbox
  const gmail = gmailResult.status === 'fulfilled' ? gmailResult.value : base.gmail

  if (calendarResult.status === 'rejected') console.error('[PollCoordinator] getCalendarEvents failed:', calendarResult.reason)
  if (inboxResult.status === 'rejected') console.error('[PollCoordinator] getInboxData failed:', inboxResult.reason)
  if (gmailResult.status === 'rejected') console.error('[PollCoordinator] getGmailInboxData failed:', gmailResult.reason)

  _lastResult = { ...base, calendar, inbox, gmail }

  if (_mainWindow && !_mainWindow.isDestroyed()) {
    // Send auth state BEFORE poll-update so the renderer knows auth state when applying calendar data
    _mainWindow.webContents.send('auth-state-change', {
      msGraphAuthed: isAuthed(),
      notionConfigured: getStoredNotionToken() !== null,
      googleAuthed: isGoogleConfigured(),
    })
    _mainWindow.webContents.send('poll-update', _lastResult)
  }
}

/**
 * Poll Notion API (D8 + Egg + BGC tasks) and update _lastResult.
 * Each database is fetched independently (allSettled, not all) — one broken/unshared
 * database must not prevent the other two from updating. Failures are logged per-database
 * and that database's previous data is preserved rather than cleared.
 */
export async function pollNotion(): Promise<void> {
  const base = _lastResult ?? DEFAULT_POLL_RESULT
  const [d8Result, eggResult, bgcResult, jobRadarResult, newslettersResult] = await Promise.allSettled([
    fetchD8Tasks(),
    fetchEggTasks(),
    fetchBgcTasks(),
    fetchJobRadar(),
    fetchNewsletters(),
  ])

  const d8Tasks = d8Result.status === 'fulfilled' ? d8Result.value : base.d8Tasks
  const eggTasks = eggResult.status === 'fulfilled' ? eggResult.value : base.eggTasks
  const bgcTasks = bgcResult.status === 'fulfilled' ? bgcResult.value : base.bgcTasks
  const jobRadar = jobRadarResult.status === 'fulfilled' ? jobRadarResult.value.jobs : base.jobRadar
  const jobRadarUpdatedAt = jobRadarResult.status === 'fulfilled' ? jobRadarResult.value.updatedAt : base.jobRadarUpdatedAt
  const newsletters = newslettersResult.status === 'fulfilled' ? newslettersResult.value.newsletters : base.newsletters
  const newslettersUpdatedAt = newslettersResult.status === 'fulfilled' ? newslettersResult.value.updatedAt : base.newslettersUpdatedAt

  if (d8Result.status === 'rejected') console.error('[PollCoordinator] fetchD8Tasks failed:', d8Result.reason)
  if (eggResult.status === 'rejected') console.error('[PollCoordinator] fetchEggTasks failed:', eggResult.reason)
  if (bgcResult.status === 'rejected') console.error('[PollCoordinator] fetchBgcTasks failed:', bgcResult.reason)
  if (jobRadarResult.status === 'rejected') console.error('[PollCoordinator] fetchJobRadar failed:', jobRadarResult.reason)
  if (newslettersResult.status === 'rejected') console.error('[PollCoordinator] fetchNewsletters failed:', newslettersResult.reason)

  _lastResult = { ...base, d8Tasks, eggTasks, bgcTasks, jobRadar, jobRadarUpdatedAt, newsletters, newslettersUpdatedAt }

  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send('poll-update', _lastResult)
  }
}

/**
 * Check and fire notifications for upcoming calendar events
 */
async function checkNotifications(): Promise<void> {
  try {
    if (_lastResult && _lastResult.calendar) {
      await checkAndFire(_lastResult.calendar, _mainWindow)
    }
  } catch (err) {
    console.error('[PollCoordinator] checkNotifications failed:', err)
  }
}

/**
 * Run both pollGraph and pollNotion in parallel
 */
async function runAllPolls(): Promise<void> {
  await Promise.all([pollGraph(), pollNotion()])
}

/**
 * Handle system resume event
 */
function handleResume(): void {
  console.log('[PollCoordinator] System resumed — running eager poll')
  runAllPolls().catch((err) => console.error('[PollCoordinator] Uncaught runAllPolls error on resume:', err))
}

/**
 * Start polling with configured intervals
 * Runs eager poll immediately, then sets up recurring intervals
 */
export async function startPolling(mainWindow: BrowserWindow): Promise<void> {
  // Clear old timers if re-called (fixes timer leak issue)
  stopPolling()

  _mainWindow = mainWindow

  // Run eager poll immediately (don't wait for first interval tick)
  await runAllPolls()

  // Set up recurring intervals
  const config = getConfig()

  // Graph polling interval
  _graphTimerId = setInterval(() => {
    pollGraph().catch((err) => console.error('[PollCoordinator] Uncaught pollGraph error:', err))
  }, config.refresh.graph_interval_ms)

  // Notion polling interval
  _notionTimerId = setInterval(() => {
    pollNotion().catch((err) => console.error('[PollCoordinator] Uncaught pollNotion error:', err))
  }, config.refresh.notion_interval_ms)

  // Notification check every 60 seconds (hardcoded)
  _notificationTimerId = setInterval(() => {
    checkNotifications().catch((err) => console.error('[PollCoordinator] Uncaught checkNotifications error:', err))
  }, 60 * 1000)

  // Schedule midnight clear for notification deduplication
  scheduleMidnightClear()

  // Listen for system wake and resume polling
  // Remove old listener first to prevent duplicates on re-call
  powerMonitor.off('resume', handleResume)
  powerMonitor.on('resume', handleResume)

  console.log('[PollCoordinator] Polling started')
}

/**
 * Stop all polling timers
 */
export function stopPolling(): void {
  if (_graphTimerId !== null) {
    clearInterval(_graphTimerId)
    _graphTimerId = null
  }
  if (_notionTimerId !== null) {
    clearInterval(_notionTimerId)
    _notionTimerId = null
  }
  if (_notificationTimerId !== null) {
    clearInterval(_notificationTimerId)
    _notificationTimerId = null
  }
  console.log('[PollCoordinator] Polling stopped')
}

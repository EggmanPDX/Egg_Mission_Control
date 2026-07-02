import { BrowserWindow, powerMonitor } from 'electron'
import { getCalendarEvents, getInboxData } from './graph.service'
import { fetchD8Tasks, fetchEggTasks, fetchBgcTasks } from './notion.service'
import { checkAndFire, scheduleMidnightClear } from './notification.scheduler'
import { getConfig } from './config'
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
  inbox: { outlookUnread: 0, outlookTopSubjects: [], teamsUnread: null },
  d8Tasks: [],
  eggTasks: [],
  bgcTasks: [],
}

/**
 * Get the last poll result (cached)
 */
export function getLastResult(): PollResult | null {
  return _lastResult
}

/**
 * Poll Graph API (calendar + inbox) and update _lastResult
 * Sends update to renderer via IPC
 */
async function pollGraph(): Promise<void> {
  try {
    const [calendar, inbox] = await Promise.all([
      getCalendarEvents(),
      getInboxData(),
    ])

    // Merge into last result, preserving other data
    _lastResult = {
      ...(_lastResult ?? DEFAULT_POLL_RESULT),
      calendar,
      inbox,
    }

    // Send update to renderer
    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send('poll-update', _lastResult)
    }
  } catch (err) {
    console.error('[PollCoordinator] pollGraph failed:', err)
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
  const [d8Result, eggResult, bgcResult] = await Promise.allSettled([
    fetchD8Tasks(),
    fetchEggTasks(),
    fetchBgcTasks(),
  ])

  const d8Tasks = d8Result.status === 'fulfilled' ? d8Result.value : base.d8Tasks
  const eggTasks = eggResult.status === 'fulfilled' ? eggResult.value : base.eggTasks
  const bgcTasks = bgcResult.status === 'fulfilled' ? bgcResult.value : base.bgcTasks

  if (d8Result.status === 'rejected') console.error('[PollCoordinator] fetchD8Tasks failed:', d8Result.reason)
  if (eggResult.status === 'rejected') console.error('[PollCoordinator] fetchEggTasks failed:', eggResult.reason)
  if (bgcResult.status === 'rejected') console.error('[PollCoordinator] fetchBgcTasks failed:', bgcResult.reason)

  _lastResult = { ...base, d8Tasks, eggTasks, bgcTasks }

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

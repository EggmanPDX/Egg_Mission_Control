import type { BrowserWindow } from 'electron'
import type { CalendarEvent } from '../shared/ipc-types'

/**
 * NotificationScheduler — fires Electron notifications 15 minutes before calendar events.
 *
 * Features:
 * - Deduplication by event_id + date (prevents duplicate notifications on app restarts)
 * - Midnight clear: resets the fired Set at 00:00:05 each day so tomorrow's events fire fresh
 * - Click handler: focuses mainWindow or shows app
 * - Test support: exported clearFiredSet() for test resets
 */

const LEAD_TIME_MS = 15 * 60 * 1000 // 15 minutes
const MIDNIGHT_OFFSET_MS = 5000 // 5 seconds after midnight

// Track fired notifications by "eventId:YYYY-MM-DD"
let _fired = new Set<string>()
let _midnightTimeout: NodeJS.Timeout | null = null

/**
 * Get today's date as YYYY-MM-DD string (local timezone)
 */
function getTodayString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculate milliseconds until next midnight (00:00:00)
 */
function getMillisUntilMidnight(): number {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.getTime() - now.getTime()
}

/**
 * Schedule the midnight clear. Clears _fired at 00:00:05 each day.
 */
export function scheduleMidnightClear(): void {
  if (_midnightTimeout) {
    clearTimeout(_midnightTimeout)
  }

  const delayMs = getMillisUntilMidnight() + MIDNIGHT_OFFSET_MS

  _midnightTimeout = setTimeout(() => {
    _fired.clear()
    // Reschedule for tomorrow
    scheduleMidnightClear()
  }, delayMs)
}

/**
 * Build a dedup key for an event notification
 * Format: "eventId:YYYY-MM-DD"
 */
function buildFiredKey(eventId: string, dateStr: string): string {
  return `${eventId}:${dateStr}`
}

/**
 * Format attendee list: top 3 names, comma-separated
 */
function formatAttendees(attendees: string[]): string {
  if (attendees.length === 0) return ''
  const top3 = attendees.slice(0, 3).join(', ')
  return top3
}

/**
 * Fire a notification for a calendar event.
 * (Separated from checkAndFire for testability)
 */
async function fireNotification(
  event: CalendarEvent,
  mainWindow: BrowserWindow | null
): Promise<void> {
  // Dynamic import: Notification only available in main process
  const { Notification, app } = await import('electron')

  const attendeeStr = formatAttendees(event.attendees)
  const body =
    attendeeStr.length > 0 ? `Starting in 15 min · ${attendeeStr}` : 'Starting in 15 min'

  const notification = new Notification({
    title: event.subject,
    body,
    icon: undefined // Use app's default icon
  })

  // Click handler: focus mainWindow or show app
  notification.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus()
    } else {
      app.show?.()
    }
  })

  notification.show()
}

/**
 * Check if an event's start time is within 15 minutes and hasn't already fired today.
 * If so, fire the notification.
 *
 * @param events Calendar events to check
 * @param mainWindow BrowserWindow reference (optional; used for click handler)
 */
export async function checkAndFire(
  events: CalendarEvent[],
  mainWindow: BrowserWindow | null
): Promise<void> {
  const now = new Date()
  const todayStr = getTodayString()

  for (const event of events) {
    const eventStart = new Date(event.start)
    const msUntilStart = eventStart.getTime() - now.getTime()

    // Fire if: within next 15 minutes AND in the future AND not already fired today
    const shouldFire = msUntilStart > 0 && msUntilStart <= LEAD_TIME_MS
    const firedKey = buildFiredKey(event.id, todayStr)
    const alreadyFired = _fired.has(firedKey)

    if (shouldFire && !alreadyFired) {
      _fired.add(firedKey)
      await fireNotification(event, mainWindow)
    }
  }
}

/**
 * Clear the fired Set. Used for testing.
 */
export function clearFiredSet(): void {
  _fired.clear()
}

/**
 * Stop the midnight timeout. Used for testing cleanup.
 */
export function stopMidnightClear(): void {
  if (_midnightTimeout) {
    clearTimeout(_midnightTimeout)
    _midnightTimeout = null
  }
}

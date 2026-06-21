import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../src/main/auth.service', () => ({
  getAccessToken: vi.fn(async () => 'mock-token-123'),
}))

vi.mock('../src/main/mock', () => ({
  MOCK_MODE: false,
  getMockPollResult: vi.fn(() => ({
    calendar: [],
    inbox: { outlookUnread: 0, outlookTopSubjects: [], teamsUnread: null },
    d8Tasks: [],
    eggTasks: [],
  })),
}))

// Mock setup for fetch after other mocks
const mockFetch = vi.fn()
global.fetch = mockFetch as any

import { getCalendarEvents, getInboxData } from '../src/main/graph.service'

describe('Graph Service', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('429 throttling with exponential backoff', () => {
    it('retries on 429 and respects Retry-After header', async () => {
      // First call returns 429 with Retry-After
      mockFetch.mockResolvedValueOnce({
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['Retry-After', '2']]),
        json: async () => ({}),
      })

      // Second call (after backoff) succeeds
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          value: [
            {
              id: 'evt-001',
              subject: 'Test Event',
              start: { dateTime: '2026-06-20T10:00:00Z' },
              end: { dateTime: '2026-06-20T11:00:00Z' },
              attendees: [{ emailAddress: { name: 'Alice' } }],
            },
          ],
        }),
      })

      const startTime = Date.now()
      const events = await getCalendarEvents()
      const elapsed = Date.now() - startTime

      // Should have retried (with at least 2 seconds backoff from Retry-After)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(elapsed).toBeGreaterThanOrEqual(2000)
      expect(events).toHaveLength(1)
      expect(events[0].subject).toBe('Test Event')
    })

    it('uses exponential backoff when no Retry-After header', async () => {
      // First call returns 429
      mockFetch.mockResolvedValueOnce({
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([]),
        json: async () => ({}),
      })

      // Second call (after backoff) succeeds
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          value: [],
        }),
      })

      const startTime = Date.now()
      await getCalendarEvents()
      const elapsed = Date.now() - startTime

      // Should have retried with at least 1 second (default backoff)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(elapsed).toBeGreaterThanOrEqual(1000)
    })

    it('respects maximum retry attempts', async () => {
      // Return 429 multiple times
      for (let i = 0; i < 10; i++) {
        mockFetch.mockResolvedValueOnce({
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Map([['Retry-After', '0']]), // Instant retry for testing
          json: async () => ({}),
        })
      }

      await expect(getCalendarEvents()).rejects.toThrow('Max retries exceeded')
      // Should stop after initial + 5 retries = 6 total attempts
      expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(6)
    })
  })

  describe('calendar event mapping', () => {
    it('maps Graph API response to CalendarEvent shape', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          value: [
            {
              id: 'evt-123',
              subject: 'Team Standup',
              start: { dateTime: '2026-06-20T09:00:00Z' },
              end: { dateTime: '2026-06-20T09:30:00Z' },
              attendees: [
                { emailAddress: { name: 'Alice' } },
                { emailAddress: { name: 'Bob' } },
              ],
              webLink: 'https://teams.microsoft.com/l/meetup-join/abc',
            },
            {
              id: 'evt-456',
              subject: 'Sprint Planning',
              start: { dateTime: '2026-06-20T14:00:00Z' },
              end: { dateTime: '2026-06-20T15:00:00Z' },
              attendees: [{ emailAddress: { name: 'Charlie' } }],
              webLink: 'https://teams.microsoft.com/l/meetup-join/def',
            },
          ],
        }),
      })

      const events = await getCalendarEvents()

      expect(events).toHaveLength(2)
      expect(events[0]).toEqual({
        id: 'evt-123',
        subject: 'Team Standup',
        start: '2026-06-20T09:00:00Z',
        end: '2026-06-20T09:30:00Z',
        attendees: ['Alice', 'Bob'],
        webLink: 'https://teams.microsoft.com/l/meetup-join/abc',
      })
      expect(events[1]).toEqual({
        id: 'evt-456',
        subject: 'Sprint Planning',
        start: '2026-06-20T14:00:00Z',
        end: '2026-06-20T15:00:00Z',
        attendees: ['Charlie'],
        webLink: 'https://teams.microsoft.com/l/meetup-join/def',
      })
    })

    it('handles missing webLink gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          value: [
            {
              id: 'evt-789',
              subject: 'No Link Event',
              start: { dateTime: '2026-06-20T10:00:00Z' },
              end: { dateTime: '2026-06-20T10:30:00Z' },
              attendees: [],
              // webLink intentionally omitted
            },
          ],
        }),
      })

      const events = await getCalendarEvents()

      expect(events).toHaveLength(1)
      expect(events[0].webLink).toBeUndefined()
    })
  })

  describe('inbox data fetching', () => {
    it('fetches unread message count and top subjects', async () => {
      // First fetch: top 3 unread messages
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          value: [
            {
              subject: 'Q3 Review',
              from: { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
              isRead: false,
            },
            {
              subject: 'Sprint Update',
              from: { emailAddress: { name: 'Bob', address: 'bob@example.com' } },
              isRead: false,
            },
          ],
        }),
      })

      // Second fetch: count of all unread
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          value: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }],
        }),
      })

      // Third fetch: Teams chats unread
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          value: [
            { id: 'chat-1', topic: 'Team', unreadMessageCount: 3 },
            { id: 'chat-2', topic: 'Project', unreadMessageCount: 2 },
          ],
        }),
      })

      const inbox = await getInboxData()

      expect(inbox.outlookUnread).toBe(5)
      expect(inbox.outlookTopSubjects).toEqual([
        { subject: 'Q3 Review', from: 'Alice' },
        { subject: 'Sprint Update', from: 'Bob' },
      ])
      expect(inbox.teamsUnread).toBe(5) // 3 + 2
    })

    it('handles missing Teams Chat scope gracefully', async () => {
      // First fetch: top 3 unread messages
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          value: [
            {
              subject: 'Test',
              from: { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
              isRead: false,
            },
          ],
        }),
      })

      // Second fetch: unread count
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          value: [{ id: '1' }],
        }),
      })

      // Third fetch: Teams fails
      mockFetch.mockResolvedValueOnce({
        status: 403,
        ok: false,
        statusText: 'Forbidden',
        json: async () => ({ error: 'scope not available' }),
      })

      const inbox = await getInboxData()

      expect(inbox.outlookUnread).toBe(1)
      expect(inbox.outlookTopSubjects).toHaveLength(1)
      expect(inbox.teamsUnread).toBeNull()
    })

    it('uses sender name when available, falls back to address', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          value: [
            {
              subject: 'With Name',
              from: { emailAddress: { name: 'Alice Smith', address: 'alice@example.com' } },
              isRead: false,
            },
            {
              subject: 'No Name',
              from: { emailAddress: { name: '', address: 'bob@example.com' } },
              isRead: false,
            },
          ],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          value: [{ id: '1' }, { id: '2' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          value: [],
        }),
      })

      const inbox = await getInboxData()

      expect(inbox.outlookTopSubjects[0].from).toBe('Alice Smith')
      expect(inbox.outlookTopSubjects[1].from).toBe('bob@example.com')
    })
  })
})

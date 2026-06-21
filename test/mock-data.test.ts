import { describe, it, expect } from 'vitest'
import { getMockPollResult } from '../src/main/mock'

describe('mock data', () => {
  it('returns all four data types', () => {
    const result = getMockPollResult()
    expect(result.calendar.length).toBeGreaterThan(0)
    expect(result.inbox.outlookUnread).toBeGreaterThan(0)
    expect(result.d8Tasks.length).toBeGreaterThan(0)
    expect(result.eggTasks.length).toBeGreaterThan(0)
  })

  it('calendar events have required fields', () => {
    const { calendar } = getMockPollResult()
    for (const event of calendar) {
      expect(event.id).toBeTruthy()
      expect(event.subject).toBeTruthy()
      expect(event.start).toBeTruthy()
      expect(event.attendees).toBeInstanceOf(Array)
    }
  })

  it('tasks have valid priority values', () => {
    const { d8Tasks, eggTasks } = getMockPollResult()
    const all = [...d8Tasks, ...eggTasks]
    for (const task of all) {
      expect(['P1', 'P2', 'P3', null]).toContain(task.priority)
    }
  })

  it('inbox has outlook subjects matching unread count', () => {
    const { inbox } = getMockPollResult()
    expect(inbox.outlookTopSubjects.length).toBeLessThanOrEqual(3)
    for (const s of inbox.outlookTopSubjects) {
      expect(s.subject).toBeTruthy()
      expect(s.from).toBeTruthy()
    }
  })
})

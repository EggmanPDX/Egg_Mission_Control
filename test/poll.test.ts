import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getLastResult, startPolling, stopPolling } from '../src/main/poll.coordinator'

// Mock Electron modules
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  powerMonitor: {
    on: vi.fn(),
    off: vi.fn(),
  },
}))

// Mock services
vi.mock('../src/main/graph.service', () => ({
  getCalendarEvents: vi.fn(async () => []),
  getInboxData: vi.fn(async () => ({
    outlookUnread: 0,
    outlookTopSubjects: [],
    teamsUnread: null,
  })),
}))

vi.mock('../src/main/notion.service', () => ({
  fetchD8Tasks: vi.fn(async () => []),
  fetchEggTasks: vi.fn(async () => []),
  fetchBgcTasks: vi.fn(async () => []),
  fetchD8Projects: vi.fn(async () => []),
  fetchLightProjects: vi.fn(async () => []),
}))

vi.mock('../src/main/notification.scheduler', () => ({
  checkAndFire: vi.fn(async () => {}),
  scheduleMidnightClear: vi.fn(),
}))

vi.mock('../src/main/config', () => ({
  getConfig: vi.fn(() => ({
    refresh: {
      graph_interval_ms: 300000,
      notion_interval_ms: 600000,
    },
  })),
}))

describe('PollCoordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    stopPolling()
  })

  it('returns null before first poll', () => {
    const result = getLastResult()
    expect(result).toBeNull()
  })

  it('caches poll result after call', async () => {
    const { BrowserWindow } = await import('electron')
    const mockWebContents = {
      send: vi.fn(),
    }
    const mockMainWindow = {
      webContents: mockWebContents,
      isDestroyed: vi.fn(() => false),
    }

    ;(BrowserWindow as any).mockReturnValue(mockMainWindow)

    // Start polling (this runs eager poll)
    await startPolling(mockMainWindow as any)

    // Verify result is cached
    const result = getLastResult()
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('calendar')
    expect(result).toHaveProperty('inbox')
    expect(result).toHaveProperty('d8Tasks')
    expect(result).toHaveProperty('eggTasks')
  })
})

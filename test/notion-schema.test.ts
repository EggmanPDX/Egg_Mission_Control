import { describe, it, expect, beforeEach, vi } from 'vitest'

// Real-world discovery (2026-07-02): Gregg's three task databases don't share one schema.
// "D8 Tasks & Projects" uses a plain Select for Status; "Egg's Command Center" names its
// title column "Task" instead of "Name"/"Title". These tests lock in the four schema shapes
// that actually exist (or are one property-name/type away from existing) so a future change
// can't silently reintroduce the bugs this session found the hard way.

const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    databases: { retrieve: vi.fn(), query: vi.fn() },
    pages: { update: vi.fn(), create: vi.fn(), retrieve: vi.fn() },
    users: { me: vi.fn() },
  },
}))

vi.mock('@notionhq/client', () => ({
  Client: vi.fn(function Client() {
    return mockClient
  }),
}))

vi.mock('../src/main/auth.service', () => ({
  getStoredNotionToken: vi.fn(() => 'fake-token'),
}))

vi.mock('../src/main/config', () => ({
  getConfig: vi.fn(() => ({
    notion: {
      d8_tasks_db: 'd8-db-id',
      egg_tasks_db: 'egg-db-id',
      bgc_tasks_db: 'bgc-db-id',
    },
  })),
}))

vi.mock('../src/main/mock', () => ({
  MOCK_MODE: false,
  getMockPollResult: vi.fn(),
}))

import { fetchD8Tasks, archiveTask, completeTask, moveTask } from '../src/main/notion.service'
import { getConfig } from '../src/main/config'

type StatusType = 'status' | 'select'

function schema(titleKey: string, statusType: StatusType | null) {
  return {
    properties: {
      [titleKey]: { type: 'title' },
      Priority: { type: 'select' },
      ...(statusType ? { Status: { type: statusType } } : {}),
    },
  }
}

function page(titleKey: string, statusType: StatusType, titleText: string, statusName: string, priorityName: string) {
  return {
    id: 'page-1',
    properties: {
      [titleKey]: { type: 'title', title: [{ plain_text: titleText }] },
      Priority: { type: 'select', select: { name: priorityName } },
      Status:
        statusType === 'status'
          ? { type: 'status', status: { name: statusName } }
          : { type: 'select', select: { name: statusName } },
    },
  }
}

const SCHEMAS: Array<{ label: string; titleKey: string; statusType: StatusType }> = [
  { label: 'Name / built-in status (spec default)', titleKey: 'Name', statusType: 'status' },
  { label: 'Title / built-in status', titleKey: 'Title', statusType: 'status' },
  { label: 'Task / select (Egg\'s Command Center, real)', titleKey: 'Task', statusType: 'select' },
  { label: 'Name / select (D8 Tasks & Projects, real)', titleKey: 'Name', statusType: 'select' },
]

describe('notion.service — schema detection across real-world DB shapes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  for (const { label, titleKey, statusType } of SCHEMAS) {
    it(`extracts title/status/priority correctly for schema: ${label}`, async () => {
      mockClient.databases.retrieve.mockResolvedValue(schema(titleKey, statusType))
      mockClient.databases.query.mockResolvedValue({
        results: [page(titleKey, statusType, 'Ship the thing', 'In Progress', 'P1')],
      })

      const tasks = await fetchD8Tasks()

      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Ship the thing')
      expect(tasks[0].status).toBe('In Progress')
      expect(tasks[0].priority).toBe('P1')

      // The filter sent to Notion must match the property's real type, or the API 404s/400s
      const queryArg = mockClient.databases.query.mock.calls[0][0]
      expect(queryArg.filter.property).toBe('Status')
      expect(queryArg.filter[statusType]).toEqual({ does_not_equal: 'Done' })
    })
  }

  it('skips the Status filter entirely when no recognizable Status property exists (no error, no crash)', async () => {
    mockClient.databases.retrieve.mockResolvedValue(schema('Name', null))
    mockClient.databases.query.mockResolvedValue({
      results: [page('Name', 'select', 'Untracked task', 'N/A', 'P2')],
    })

    const tasks = await fetchD8Tasks()

    expect(tasks).toHaveLength(1)
    const queryArg = mockClient.databases.query.mock.calls[0][0]
    expect(queryArg.filter).toBeUndefined()
  })
})

describe('notion.service — task mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('archiveTask archives the page without touching properties', async () => {
    mockClient.pages.update.mockResolvedValue({})
    await archiveTask('page-1')
    expect(mockClient.pages.update).toHaveBeenCalledWith({ page_id: 'page-1', archived: true })
  })

  it('completeTask sends a "status"-shaped update when the DB uses the built-in Status type', async () => {
    mockClient.databases.retrieve.mockResolvedValue(schema('Name', 'status'))
    mockClient.pages.update.mockResolvedValue({})

    await completeTask('page-1', 'D8')

    expect(mockClient.pages.update).toHaveBeenCalledWith({
      page_id: 'page-1',
      properties: { Status: { status: { name: 'Done' } } },
    })
  })

  it('completeTask sends a "select"-shaped update when the DB uses a plain Select property', async () => {
    mockClient.databases.retrieve.mockResolvedValue(schema('Task', 'select'))
    mockClient.pages.update.mockResolvedValue({})

    await completeTask('page-1', 'EGG')

    expect(mockClient.pages.update).toHaveBeenCalledWith({
      page_id: 'page-1',
      properties: { Status: { select: { name: 'Done' } } },
    })
  })

  it('completeTask throws instead of silently no-op-ing when Status property is unrecognizable', async () => {
    mockClient.databases.retrieve.mockResolvedValue(schema('Name', null))
    await expect(completeTask('page-1', 'D8')).rejects.toThrow(/no recognizable Status/i)
  })

  it('moveTask maps the title into whatever the target database calls its title property', async () => {
    // Source: Egg's Command Center shape (title key "Task"). Target: D8 shape (title key "Name").
    mockClient.pages.retrieve.mockResolvedValue(page('Task', 'select', 'Cross-workspace task', 'To Do', 'P2'))
    mockClient.databases.retrieve.mockResolvedValue(schema('Name', 'status'))
    mockClient.pages.create.mockResolvedValue({})
    mockClient.pages.update.mockResolvedValue({})

    await moveTask('page-1', 'EGG', 'D8')

    expect(mockClient.pages.create).toHaveBeenCalledWith({
      parent: { database_id: 'd8-db-id' },
      properties: {
        Name: { title: [{ text: { content: 'Cross-workspace task' } }] },
        Priority: { select: { name: 'P2' } },
      },
    })
    expect(mockClient.pages.update).toHaveBeenCalledWith({ page_id: 'page-1', archived: true })
  })

  it('moveTask throws rather than silently failing when the target workspace has no database configured', async () => {
    // moveTask calls getDatabaseIdForWorkspace (and therefore getConfig) once for "from" and
    // once for "to" — override both calls so the empty bgc_tasks_db is seen both times.
    const emptyBgcConfig = {
      notion: { d8_tasks_db: 'd8-db-id', egg_tasks_db: 'egg-db-id', bgc_tasks_db: '' },
    } as ReturnType<typeof getConfig>
    vi.mocked(getConfig).mockReturnValueOnce(emptyBgcConfig).mockReturnValueOnce(emptyBgcConfig)

    await expect(moveTask('page-1', 'D8', 'BGC')).rejects.toThrow(/no database configured/i)
  })
})

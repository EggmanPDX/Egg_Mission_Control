import { Client as NotionClient } from '@notionhq/client'
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { NotionTask, TaskWorkspace, JobRadarEntry, NewsletterEntry } from '../shared/ipc-types'
import { getStoredNotionToken } from './auth.service'
import { getConfig } from './config'
import { getMockPollResult, MOCK_MODE } from './mock'

function getDatabaseIdForWorkspace(workspace: TaskWorkspace): string {
  const config = getConfig()
  if (workspace === 'D8') return config.notion.d8_tasks_db
  if (workspace === 'EGG') return config.notion.egg_tasks_db
  return config.notion.bgc_tasks_db
}

const RETRY_DELAY_MS = 60000 // Notion doesn't send Retry-After, use 60s default

export function getClient(token?: string): NotionClient {
  const notionToken = token || getStoredNotionToken()
  if (!notionToken) {
    throw new Error('Notion token not configured')
  }
  return new NotionClient({ auth: notionToken })
}

export async function validateToken(token: string): Promise<boolean> {
  try {
    const client = new NotionClient({ auth: token })
    await client.users.me({})
    return true
  } catch {
    return false
  }
}

async function queryWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      // Check for 429 (rate limit)
      if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: unknown }).status === 429) {
        lastError = error
        if (attempt < maxAttempts - 1) {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }
      }

      // Non-429 errors fail immediately
      throw error
    }
  }

  throw lastError || new Error('queryWithRetry failed after max attempts')
}

function mapPriority(priorityValue: unknown): 'P1' | 'P2' | 'P3' | null {
  if (typeof priorityValue === 'string') {
    if (priorityValue === 'P1' || priorityValue === 'P2' || priorityValue === 'P3') {
      return priorityValue
    }
  }
  return null
}

async function getStatusPropertyType(
  client: NotionClient,
  databaseId: string
): Promise<'status' | 'select' | null> {
  const db = await client.databases.retrieve({ database_id: databaseId })
  const statusProp = (db as { properties: Record<string, { type: string }> }).properties?.Status
  if (statusProp?.type === 'status' || statusProp?.type === 'select') {
    return statusProp.type
  }
  return null
}

async function queryDatabase(databaseId: string): Promise<NotionTask[]> {
  const client = getClient()

  const tasks: NotionTask[] = await queryWithRetry(async () => {
    // Notion databases created independently can use either the built-in "Status" property
    // type or a plain "Select" property for the same purpose — detect which before filtering,
    // since Notion's query API rejects a filter whose type doesn't match the actual property.
    const statusType = await getStatusPropertyType(client, databaseId)

    const response = await client.databases.query({
      database_id: databaseId,
      ...(statusType
        ? {
            filter: {
              property: 'Status',
              [statusType]: { does_not_equal: 'Done' },
            } as Parameters<typeof client.databases.query>[0]['filter'],
          }
        : {}),
      sorts: [
        {
          property: 'Priority',
          direction: 'ascending',
        },
      ],
    })

    return response.results
      .map((page) => {
        const pageData = page as PageObjectResponse
        const properties = pageData.properties as Record<string, unknown>

        // Extract title — every Notion database has exactly one property of type "title",
        // but its display name is arbitrary (Name, Title, Task, etc.), so find it by type
        // rather than assuming a specific key exists.
        const titleProperty = Object.values(properties).find(
          (prop): prop is Record<string, unknown> =>
            typeof prop === 'object' && prop !== null && (prop as Record<string, unknown>).type === 'title'
        )
        let title = ''
        if (titleProperty && Array.isArray(titleProperty.title)) {
          title = (titleProperty.title as Array<{ plain_text: string }>).map((t) => t.plain_text).join('')
        }

        // Extract priority from Priority property
        let priority: 'P1' | 'P2' | 'P3' | null = null
        const priorityProperty = properties.Priority as
          | { type: 'select'; select: { name: string } | null }
          | undefined
        if (priorityProperty?.type === 'select' && priorityProperty.select?.name) {
          priority = mapPriority(priorityProperty.select.name)
        }

        // Extract status from Status property — may be Notion's built-in "status" type
        // or a plain "select" property, depending on how the database was created
        let status = 'Unknown'
        const statusProperty = properties.Status as
          | { type: 'status'; status: { name: string } | null }
          | { type: 'select'; select: { name: string } | null }
          | undefined
        if (statusProperty?.type === 'status' && statusProperty.status?.name) {
          status = statusProperty.status.name
        } else if (statusProperty?.type === 'select' && statusProperty.select?.name) {
          status = statusProperty.select.name
        }

        // Build Notion URL
        const notionUrl = `https://notion.so/${pageData.id.replace(/-/g, '')}`

        return {
          id: pageData.id,
          title,
          priority,
          status,
          url: notionUrl,
        }
      })
  })

  return tasks
}

export async function fetchD8Tasks(): Promise<NotionTask[]> {
  if (MOCK_MODE) {
    return getMockPollResult().d8Tasks
  }

  const config = getConfig()
  return queryDatabase(config.notion.d8_tasks_db)
}

export async function fetchEggTasks(): Promise<NotionTask[]> {
  if (MOCK_MODE) {
    return getMockPollResult().eggTasks
  }

  const config = getConfig()
  return queryDatabase(config.notion.egg_tasks_db)
}

export async function fetchBgcTasks(): Promise<NotionTask[]> {
  if (MOCK_MODE) {
    return []
  }

  const config = getConfig()
  if (!config.notion.bgc_tasks_db) return []
  return queryDatabase(config.notion.bgc_tasks_db)
}

export async function archiveTask(pageId: string): Promise<void> {
  const client = getClient()
  await client.pages.update({ page_id: pageId, archived: true })
}

/**
 * Marks a task complete by setting its Status property to "Done" — the same value name
 * the read-side filter (queryDatabase) already assumes exists across these databases.
 */
export async function completeTask(pageId: string, workspace: TaskWorkspace): Promise<void> {
  const client = getClient()
  const databaseId = getDatabaseIdForWorkspace(workspace)
  const statusType = await getStatusPropertyType(client, databaseId)
  if (!statusType) {
    throw new Error(`No recognizable Status property on the ${workspace} database`)
  }
  await client.pages.update({
    page_id: pageId,
    properties: {
      Status:
        statusType === 'status'
          ? { status: { name: 'Done' } }
          : { select: { name: 'Done' } },
    },
  })
}

async function getTitlePropertyName(client: NotionClient, databaseId: string): Promise<string> {
  const db = await client.databases.retrieve({ database_id: databaseId })
  const properties = (db as { properties: Record<string, { type: string }> }).properties
  const entry = Object.entries(properties).find(([, v]) => v.type === 'title')
  if (!entry) throw new Error(`Database ${databaseId} has no title property`)
  return entry[0]
}

/**
 * Moves a task between workspace databases. Notion has no native "move between databases"
 * operation, so this creates an equivalent page in the target database (carrying over title
 * and Priority, if the target has a compatible Priority select property) and archives the
 * original. Other properties (notes, due dates, etc.) are intentionally not migrated in v1 —
 * schemas differ enough across these three databases that blind property copying is riskier
 * than just carrying the essentials.
 */
export async function moveTask(pageId: string, from: TaskWorkspace, to: TaskWorkspace): Promise<void> {
  const client = getClient()
  const fromDb = getDatabaseIdForWorkspace(from)
  const toDb = getDatabaseIdForWorkspace(to)
  if (!toDb) throw new Error(`No database configured for ${to}`)
  if (!fromDb) throw new Error(`No database configured for ${from}`)

  const page = (await client.pages.retrieve({ page_id: pageId })) as PageObjectResponse
  const properties = page.properties as Record<string, unknown>

  const titleProperty = Object.values(properties).find(
    (prop): prop is Record<string, unknown> =>
      typeof prop === 'object' && prop !== null && (prop as Record<string, unknown>).type === 'title'
  )
  const titleText =
    titleProperty && Array.isArray(titleProperty.title)
      ? (titleProperty.title as Array<{ plain_text: string }>).map((t) => t.plain_text).join('')
      : ''

  let priorityValue: string | null = null
  const priorityProperty = properties.Priority as Record<string, unknown> | undefined
  if (priorityProperty?.type === 'select') {
    const select = priorityProperty.select as { name: string } | null
    if (select?.name) priorityValue = select.name
  }

  const targetTitleKey = await getTitlePropertyName(client, toDb)
  const newProperties: Record<string, unknown> = {
    [targetTitleKey]: { title: [{ text: { content: titleText } }] },
  }

  if (priorityValue) {
    const targetDb = await client.databases.retrieve({ database_id: toDb })
    const targetProperties = (targetDb as { properties: Record<string, { type: string }> }).properties
    if (targetProperties.Priority?.type === 'select') {
      newProperties.Priority = { select: { name: priorityValue } }
    }
  }

  await client.pages.create({
    parent: { database_id: toDb },
    properties: newProperties as Parameters<typeof client.pages.create>[0]['properties'],
  })

  await client.pages.update({ page_id: pageId, archived: true })
}

// ── Job Radar ────────────────────────────────────────────────────────────────
// Job Radar has no Notion database of its own — Egg_Morning_Brief writes it as a block
// section (heading_2 "💼 Job Radar" + a callout timestamp + one bulleted_list_item per job)
// directly on the shared Morning Briefing page. There's no typed API for this, so we walk
// the page's blocks and parse the exact rich_text shape that notion_writer.py's
// build_job_radar_blocks() produces. If that shape ever changes on the Python side, this
// parser needs to change too — the two are coupled by convention, not by a shared schema.

const JOB_RADAR_HEADING = 'Job Radar'
const SECTION_STOP_TYPES = new Set(['heading_1', 'heading_2', 'divider'])

interface NotionRichText {
  type: string
  plain_text: string
  text?: { link?: { url: string } | null }
  annotations?: { color?: string }
}

interface NotionBlock {
  id: string
  type: string
  [key: string]: unknown
}

function richTextOf(block: NotionBlock): NotionRichText[] {
  const body = block[block.type] as { rich_text?: NotionRichText[] } | undefined
  return body?.rich_text ?? []
}

function plainTextOf(block: NotionBlock): string {
  return richTextOf(block).map((rt) => rt.plain_text).join('')
}

/** Parses one job's bulleted_list_item into a JobRadarEntry. Returns null on any shape mismatch
 *  rather than throwing — one malformed entry shouldn't take down the whole Job Radar panel. */
function parseJobEntry(block: NotionBlock): JobRadarEntry | null {
  const rich = richTextOf(block)
  if (rich.length < 3) return null

  const [titleCompanyRun, metaRun, applyRun] = rich
  const applyUrl = applyRun.text?.link?.url
  if (!applyUrl) return null

  const sepIndex = titleCompanyRun.plain_text.lastIndexOf(' — ')
  if (sepIndex === -1) return null
  const title = titleCompanyRun.plain_text.slice(0, sepIndex).trim()
  const company = titleCompanyRun.plain_text.slice(sepIndex + 3).trim()

  // meta shape: "  ·  {location}  ·  {posted}  ·  {applicants} applicants  ·  {score}/100 — {reason}  ·  "
  const parts = metaRun.plain_text.split('·').map((s) => s.trim()).filter(Boolean)
  if (parts.length < 4) return null
  const [location, postedAgo, applicants, scoreAndReason] = parts

  const scoreSepIndex = scoreAndReason.indexOf('/100 — ')
  if (scoreSepIndex === -1) return null
  const score = parseInt(scoreAndReason.slice(0, scoreSepIndex), 10)
  const reason = scoreAndReason.slice(scoreSepIndex + 7).trim()
  if (isNaN(score)) return null

  return { id: applyUrl, title, company, location, postedAgo, applicants, score, reason, applyUrl }
}

/** Best-effort parse of Egg_Morning_Brief's human-readable "Last updated: <text>" timestamp
 *  (e.g. "July 02, 2026 at 12:45 PM") into ISO 8601. Falls back to the raw text if the format
 *  doesn't parse cleanly — the renderer can still display it even if it can't compute staleness. */
function parseUpdatedTimestamp(calloutText: string): string | null {
  const match = calloutText.match(/Last updated:\s*(.+)/)
  if (!match) return null
  const raw = match[1].trim()
  const parsed = new Date(raw.replace(' at ', ', '))
  return isNaN(parsed.getTime()) ? raw : parsed.toISOString()
}

export async function fetchJobRadar(): Promise<{ jobs: JobRadarEntry[]; updatedAt: string | null }> {
  if (MOCK_MODE) {
    const mock = getMockPollResult()
    return { jobs: mock.jobRadar, updatedAt: mock.jobRadarUpdatedAt }
  }

  const config = getConfig()
  const pageId = config.notion.morning_briefing_page_id
  if (!pageId) return { jobs: [], updatedAt: null }

  const client = getClient()
  const response = await queryWithRetry(() =>
    client.blocks.children.list({ block_id: pageId, page_size: 100 })
  )
  const blocks = response.results as unknown as NotionBlock[]

  let inSection = false
  let updatedAt: string | null = null
  const jobs: JobRadarEntry[] = []

  for (const block of blocks) {
    if (!inSection) {
      if (block.type === 'heading_2' && plainTextOf(block).includes(JOB_RADAR_HEADING)) {
        inSection = true
      }
      continue
    }

    if (SECTION_STOP_TYPES.has(block.type)) break

    if (block.type === 'callout' && updatedAt === null) {
      updatedAt = parseUpdatedTimestamp(plainTextOf(block))
    } else if (block.type === 'bulleted_list_item') {
      const job = parseJobEntry(block)
      if (job) jobs.push(job)
    }
  }

  return { jobs, updatedAt }
}

// ── Newsletter Digest ────────────────────────────────────────────────────────
// Same situation as Job Radar: no Notion database, just a block section on the shared
// Morning Briefing page. Egg_Morning_Brief's build_newsletter_digest_blocks() writes one
// heading_3 per newsletter, followed by either a plain "No issue found" paragraph, or a
// gray-colored subject-line paragraph + a plain summary paragraph.

const NEWSLETTER_DIGEST_HEADING = 'Newsletter Digest'

function isGraySubjectLine(block: NotionBlock): boolean {
  const rich = richTextOf(block)
  return rich.length > 0 && rich[0].annotations?.color === 'gray'
}

export async function fetchNewsletters(): Promise<{ newsletters: NewsletterEntry[]; updatedAt: string | null }> {
  if (MOCK_MODE) {
    const mock = getMockPollResult()
    return { newsletters: mock.newsletters, updatedAt: mock.newslettersUpdatedAt }
  }

  const config = getConfig()
  const pageId = config.notion.morning_briefing_page_id
  if (!pageId) return { newsletters: [], updatedAt: null }

  const client = getClient()
  const response = await queryWithRetry(() =>
    client.blocks.children.list({ block_id: pageId, page_size: 100 })
  )
  const blocks = response.results as unknown as NotionBlock[]

  let inSection = false
  let updatedAt: string | null = null
  const newsletters: NewsletterEntry[] = []
  let current: NewsletterEntry | null = null
  const summaryParts: string[] = []

  function flushCurrent() {
    if (current) {
      if (summaryParts.length > 0) current.summary = summaryParts.join('\n\n')
      newsletters.push(current)
    }
    current = null
    summaryParts.length = 0
  }

  for (const block of blocks) {
    if (!inSection) {
      if (block.type === 'heading_2' && plainTextOf(block).includes(NEWSLETTER_DIGEST_HEADING)) {
        inSection = true
      }
      continue
    }

    if (SECTION_STOP_TYPES.has(block.type)) break

    if (block.type === 'callout' && updatedAt === null) {
      updatedAt = parseUpdatedTimestamp(plainTextOf(block))
    } else if (block.type === 'heading_3') {
      flushCurrent()
      current = { name: plainTextOf(block), found: false }
    } else if (block.type === 'paragraph' && current) {
      if (isGraySubjectLine(block)) {
        const [subject, sender] = plainTextOf(block).split('·').map((s) => s.trim())
        current.found = true
        current.subject = subject
        current.sender = sender
      } else {
        const text = plainTextOf(block).trim()
        if (text) summaryParts.push(text)
      }
    }
  }
  flushCurrent()

  return { newsletters, updatedAt }
}

import { Client as NotionClient } from '@notionhq/client'
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { NotionTask, TaskWorkspace } from '../shared/ipc-types'
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
      if ('status' in err && err.status === 429) {
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
        const priorityProperty = properties.Priority
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
    properties: newProperties,
  })

  await client.pages.update({ page_id: pageId, archived: true })
}

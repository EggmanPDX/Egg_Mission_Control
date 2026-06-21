import { Client as NotionClient } from '@notionhq/client'
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { NotionTask } from '../shared/ipc-types'
import { getStoredNotionToken } from './auth.service'
import { getConfig } from './config'
import { getMockPollResult, MOCK_MODE } from './mock'

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

async function queryDatabase(databaseId: string): Promise<NotionTask[]> {
  const client = getClient()

  const tasks: NotionTask[] = await queryWithRetry(async () => {
    const response = await client.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Status',
        status: {
          does_not_equal: 'Done',
        },
      },
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

        // Extract title from Name property
        const nameProperty = (properties.Name || properties.Title) as Record<string, unknown> | undefined
        let title = ''
        if (nameProperty?.type === 'title' && Array.isArray(nameProperty.title)) {
          title = (nameProperty.title as Array<{ plain_text: string }>).map((t) => t.plain_text).join('')
        }

        // Extract priority from Priority property
        let priority: 'P1' | 'P2' | 'P3' | null = null
        const priorityProperty = properties.Priority
        if (priorityProperty?.type === 'select' && priorityProperty.select?.name) {
          priority = mapPriority(priorityProperty.select.name)
        }

        // Extract status from Status property
        let status = 'Unknown'
        const statusProperty = properties.Status
        if (statusProperty?.type === 'status' && statusProperty.status?.name) {
          status = statusProperty.status.name
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

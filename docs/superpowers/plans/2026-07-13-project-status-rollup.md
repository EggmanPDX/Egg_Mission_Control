# Project-Level Status Rollup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Project Rollup panel to Mission Control showing every real project across D8, BGC, and Egg — rich detail (health, risks, gates, dependencies, history) for D8, lightweight tracking (status, next action, last touched) for BGC and Egg.

**Architecture:** All three workspaces' existing Notion task databases get an additive-only schema change (new properties, nothing removed or renamed), so "project" rows are just `Type: Project` rows in the same DB Mission Control already polls. `notion.service.ts` gains two read functions (`fetchD8Projects`, `fetchLightProjects`) plus a pure, independently-testable `deriveHealthStatus` function. The rollup list flows through the existing poll cycle exactly like tasks; each project's free-text page-body history is fetched lazily, on-demand, only when a card is expanded in the UI.

**Tech Stack:** Electron + electron-vite, React 18 + TypeScript, `@notionhq/client`, Tailwind, Vitest.

## Global Constraints

- **Additive only.** Every Notion schema change in this plan is `ADD COLUMN` — never `DROP COLUMN`, `RENAME COLUMN`, or `ALTER COLUMN`. No existing property, value, or row is changed or removed, in Notion or in code.
- **D8 vs BGC/Egg depth is asymmetric by design** (see spec) — do not add Health Status, Risks, Next Gate, Gate Date, or dependency display to BGC/Egg. They only get `Type`, `Next Action` (and BGC already has `Type`).
- Follow the existing `allSettled`-per-source pattern in `poll.coordinator.ts` — one workspace's fetch failing must never block or clear the other workspaces' data.
- Match existing code style: no comments explaining *what* code does, only *why* (see existing `ponytail:` and rationale comments in `notion.service.ts` as the house style).
- All new Vitest tests go in `test/`, matching the existing flat-file convention (no subfolders).

---

### Task 1: Notion schema migration (additive-only, live workspace)

**Files:** none (Notion API only, via the connected Notion MCP tool)

**Interfaces:**
- Produces: three new/extended Notion data sources that Task 4's queries depend on.

- [ ] **Step 1: Add new properties to D8 Tasks & Projects**

Call the Notion MCP tool `notion-update-data-source` with:
```json
{
  "data_source_id": "d0651a9f-1141-41fb-a01c-0ca9bab48450",
  "statements": "ADD COLUMN \"Health Status\" SELECT('On Track':green, 'At Risk':yellow, 'Off Track':red); ADD COLUMN \"Risks\" RICH_TEXT; ADD COLUMN \"Next Gate\" RICH_TEXT; ADD COLUMN \"Gate Date\" DATE; ADD COLUMN \"Next Action\" RICH_TEXT"
}
```

- [ ] **Step 2: Add new property to BGC Tasks & Projects**

```json
{
  "data_source_id": "7588afda-4a0b-4cf5-8321-379aee80037a",
  "statements": "ADD COLUMN \"Next Action\" RICH_TEXT"
}
```

- [ ] **Step 3: Add new properties to Egg's Command Center**

```json
{
  "data_source_id": "2e4b9e0a-d5d3-4f93-925a-0080180bfeec",
  "statements": "ADD COLUMN \"Type\" SELECT('Task':blue, 'Project':purple); ADD COLUMN \"Next Action\" RICH_TEXT"
}
```

- [ ] **Step 4: Verify all three schemas**

Call `notion-fetch` on each of the three IDs below and confirm the new properties appear in the returned schema, with no existing property missing:
- `ff6a202b-2ee2-4756-857e-f002bb15a953` (D8 Tasks & Projects)
- `06f9c757-8fab-4db5-a8f3-7f460599ee1e` (BGC Tasks & Projects)
- `814d208b-fc6b-4515-9d8f-29da8bd459f7` (Egg's Command Center)

Expected: D8 shows `Health Status`, `Risks`, `Next Gate`, `Gate Date`, `Next Action` alongside all pre-existing properties (`Status`, `Type`, `Priority`, `Depends On`, `Blocks`, `Due Date`, `Owner`, `Project Area`, `Source / Context`, `Task / Project`). BGC shows `Next Action` alongside its pre-existing properties. Egg shows `Type` and `Next Action` alongside its pre-existing properties (`Task`, `Workspace`, `Status`, `Priority`, `Context`, `Due Date`, `Owner`, `Notes`).

- [ ] **Step 5: Add at least one Project row per workspace for real testing**

In Notion, manually set `Type = Project` on at least one existing row (or create a new one) in each of the three databases — this plan's later manual verification step needs at least one real row per workspace to confirm against.

No commit for this task (no files changed).

---

### Task 2: Shared IPC types

**Files:**
- Modify: `src/shared/ipc-types.ts`

**Interfaces:**
- Produces: `ProjectHealth`, `ProjectDependency`, `ProjectRollupEntry` types; `PollResult.projectRollup: ProjectRollupEntry[]`; new IPC channel `'get-project-context'`.

- [ ] **Step 1: Add the new types**

Add to `src/shared/ipc-types.ts`, after the existing `NotionTask` interface:

```typescript
export type ProjectHealth = 'On Track' | 'At Risk' | 'Off Track'

export interface ProjectDependency {
  id: string
  title: string
  status: string
}

export interface ProjectRollupEntry {
  tier: 'rich' | 'light'
  id: string
  workspace: TaskWorkspace
  title: string
  status: string
  nextAction: string | null
  url: string
  lastEditedTime: string
  // rich (D8) fields only — undefined when tier === 'light'
  healthStatus?: ProjectHealth
  healthOverride?: ProjectHealth | null
  risks?: string | null
  nextGate?: string | null
  gateDate?: string | null
  dependsOn?: ProjectDependency[]
  blocks?: ProjectDependency[]
}
```

- [ ] **Step 2: Extend PollResult**

In `PollResult`, add one field after `bgcTasks: NotionTask[]`:

```typescript
  projectRollup: ProjectRollupEntry[]
```

- [ ] **Step 3: Add the on-demand IPC channel**

In `IpcChannels`, add after `'move-notion-task'`:

```typescript
  'get-project-context': (pageId: string) => Promise<{ ok: boolean; context?: string; error?: string }>
```

- [ ] **Step 4: Typecheck**

`src/main/**` is checked by a separate tsconfig from the renderer/shared code — run both:

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (this config doesn't cover `src/main/**`).

Run: `npx tsc --noEmit -p tsconfig.node.json`
Expected: fails, referencing `poll.coordinator.ts` and `mock/index.ts` missing `projectRollup` on `PollResult` object literals — this is expected until Task 5. Confirm there are no *other* errors (e.g. no typo in the new types themselves).

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc-types.ts
git commit -m "feat: add ProjectRollupEntry shared types"
```

---

### Task 3: Health status derivation (pure function + unit test)

**Files:**
- Modify: `src/main/notion.service.ts`
- Test: `test/project-rollup.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `deriveHealthStatus(input: DeriveHealthInput): ProjectHealth`, exported from `notion.service.ts` — Task 4's `fetchD8Projects` calls this directly.

- [ ] **Step 1: Write the failing test**

Create `test/project-rollup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { deriveHealthStatus } from '../src/main/notion.service'

describe('deriveHealthStatus', () => {
  it('manual override always wins, even over a past gate date', () => {
    expect(
      deriveHealthStatus({
        status: 'Blocked',
        gateDate: '2020-01-01',
        healthOverride: 'On Track',
        blockingDeps: [{ status: 'To-do' }],
      })
    ).toBe('On Track')
  })

  it('Blocked status derives to At Risk with no override', () => {
    expect(
      deriveHealthStatus({ status: 'Blocked', gateDate: null, healthOverride: null, blockingDeps: [] })
    ).toBe('At Risk')
  })

  it('a past gate date on a non-Done project derives to Off Track', () => {
    expect(
      deriveHealthStatus({
        status: 'In Progress',
        gateDate: '2020-01-01',
        healthOverride: null,
        blockingDeps: [],
      })
    ).toBe('Off Track')
  })

  it('a past gate date on a Done project does not derive to Off Track', () => {
    expect(
      deriveHealthStatus({ status: 'Done', gateDate: '2020-01-01', healthOverride: null, blockingDeps: [] })
    ).toBe('On Track')
  })

  it('an incomplete blocking dependency derives to At Risk', () => {
    expect(
      deriveHealthStatus({
        status: 'In Progress',
        gateDate: null,
        healthOverride: null,
        blockingDeps: [{ status: 'In Progress' }],
      })
    ).toBe('At Risk')
  })

  it('defaults to On Track with nothing else in play', () => {
    expect(
      deriveHealthStatus({ status: 'To-do', gateDate: null, healthOverride: null, blockingDeps: [] })
    ).toBe('On Track')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/project-rollup.test.ts`
Expected: FAIL — `deriveHealthStatus` is not exported from `notion.service.ts`.

- [ ] **Step 3: Implement `deriveHealthStatus`**

Add to `src/main/notion.service.ts`, near the top (after the existing `mapPriority` function):

```typescript
export interface DeriveHealthInput {
  status: string
  gateDate: string | null
  healthOverride: string | null
  blockingDeps: Array<{ status: string }>
}

/**
 * Manual override always wins. Otherwise derives from Status, Gate Date, and whether any
 * dependency this project relies on is itself not Done — in that priority order.
 */
export function deriveHealthStatus(input: DeriveHealthInput): 'On Track' | 'At Risk' | 'Off Track' {
  if (input.healthOverride === 'On Track' || input.healthOverride === 'At Risk' || input.healthOverride === 'Off Track') {
    return input.healthOverride
  }

  if (input.status === 'Blocked') return 'At Risk'

  if (input.gateDate) {
    const gate = new Date(input.gateDate)
    if (!isNaN(gate.getTime()) && gate.getTime() < Date.now() && input.status !== 'Done') {
      return 'Off Track'
    }
  }

  if (input.blockingDeps.some((d) => d.status !== 'Done')) return 'At Risk'

  return 'On Track'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/project-rollup.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/notion.service.ts test/project-rollup.test.ts
git commit -m "feat: add deriveHealthStatus for D8 project rollup"
```

---

### Task 4: Fetch functions for project rollup

**Files:**
- Modify: `src/main/notion.service.ts`

**Interfaces:**
- Consumes: `deriveHealthStatus` (Task 3), `getClient`, `queryWithRetry`, `getConfig`, `MOCK_MODE`, `getMockPollResult` (all already in this file).
- Produces: `fetchD8Projects(): Promise<ProjectRollupEntry[]>`, `fetchLightProjects(workspace: 'BGC' | 'EGG'): Promise<ProjectRollupEntry[]>` — Task 5's `poll.coordinator.ts` calls both directly. `fetchProjectContext(pageId: string): Promise<string>` — Task 6's IPC handler calls this directly.

- [ ] **Step 1: Add a shared row-mapping helper and the two list-fetch functions**

Add to `src/main/notion.service.ts`, after `moveTask`:

```typescript
// ── Project Rollup ──────────────────────────────────────────────────────────
// "Project" rows share the same database as tasks in all three workspaces — a Type
// property (Task/Project) distinguishes them. Unlike queryDatabase (tasks), this does NOT
// filter out Done projects: a finished project is still meaningful rollup history, not noise
// to hide.

function extractTitle(properties: Record<string, unknown>): string {
  const titleProperty = Object.values(properties).find(
    (prop): prop is Record<string, unknown> =>
      typeof prop === 'object' && prop !== null && (prop as Record<string, unknown>).type === 'title'
  )
  if (titleProperty && Array.isArray(titleProperty.title)) {
    return (titleProperty.title as Array<{ plain_text: string }>).map((t) => t.plain_text).join('')
  }
  return ''
}

function extractSelectOrStatus(prop: unknown): string {
  const p = prop as { type?: string; select?: { name: string } | null; status?: { name: string } | null } | undefined
  if (p?.type === 'select' && p.select?.name) return p.select.name
  if (p?.type === 'status' && p.status?.name) return p.status.name
  return 'Unknown'
}

function extractText(prop: unknown): string | null {
  const p = prop as { type?: string; rich_text?: Array<{ plain_text: string }> } | undefined
  if (p?.type === 'rich_text' && Array.isArray(p.rich_text)) {
    const text = p.rich_text.map((t) => t.plain_text).join('')
    return text || null
  }
  return null
}

function extractDate(prop: unknown): string | null {
  const p = prop as { type?: string; date?: { start: string } | null } | undefined
  return p?.type === 'date' && p.date?.start ? p.date.start : null
}

function extractRelationIds(prop: unknown): string[] {
  const p = prop as { type?: string; relation?: Array<{ id: string }> } | undefined
  return p?.type === 'relation' && Array.isArray(p.relation) ? p.relation.map((r) => r.id) : []
}

async function queryProjectRows(
  databaseId: string,
  workspace: TaskWorkspace,
  rich: boolean
): Promise<ProjectRollupEntry[]> {
  const client = getClient()

  return queryWithRetry(async () => {
    const response = await client.databases.query({
      database_id: databaseId,
      filter: { property: 'Type', select: { equals: 'Project' } },
    })

    const rows = response.results as PageObjectResponse[]

    // Build id → {title, status} once, up front, so dependency relations (which point at
    // other rows in this same query result) can be resolved without a second API round trip.
    const byId = new Map<string, { title: string; status: string }>()
    for (const row of rows) {
      const properties = row.properties as Record<string, unknown>
      byId.set(row.id, { title: extractTitle(properties), status: extractSelectOrStatus(properties.Status) })
    }

    function resolveDeps(ids: string[]): ProjectDependency[] {
      return ids
        .map((id) => {
          const found = byId.get(id)
          return found ? { id, title: found.title, status: found.status } : null
        })
        .filter((d): d is ProjectDependency => d !== null)
    }

    return rows.map((row): ProjectRollupEntry => {
      const properties = row.properties as Record<string, unknown>
      const title = extractTitle(properties)
      const status = extractSelectOrStatus(properties.Status)
      const nextAction = extractText(properties['Next Action'])
      const url = `https://notion.so/${row.id.replace(/-/g, '')}`
      const lastEditedTime = row.last_edited_time

      if (!rich) {
        return { tier: 'light', id: row.id, workspace, title, status, nextAction, url, lastEditedTime }
      }

      const healthOverrideRaw = extractSelectOrStatus(properties['Health Status'])
      const healthOverride: ProjectHealth | null =
        healthOverrideRaw === 'On Track' || healthOverrideRaw === 'At Risk' || healthOverrideRaw === 'Off Track'
          ? healthOverrideRaw
          : null
      const risks = extractText(properties.Risks)
      const nextGate = extractText(properties['Next Gate'])
      const gateDate = extractDate(properties['Gate Date'])
      const dependsOn = resolveDeps(extractRelationIds(properties['Depends On']))
      const blocks = resolveDeps(extractRelationIds(properties.Blocks))

      const healthStatus = deriveHealthStatus({
        status,
        gateDate,
        healthOverride,
        blockingDeps: dependsOn.map((d) => ({ status: d.status })),
      })

      return {
        tier: 'rich',
        id: row.id,
        workspace,
        title,
        status,
        nextAction,
        url,
        lastEditedTime,
        healthStatus,
        healthOverride,
        risks,
        nextGate,
        gateDate,
        dependsOn,
        blocks,
      }
    })
  })
}

export async function fetchD8Projects(): Promise<ProjectRollupEntry[]> {
  if (MOCK_MODE) return getMockPollResult().projectRollup.filter((p) => p.workspace === 'D8')

  const config = getConfig()
  return queryProjectRows(config.notion.d8_tasks_db, 'D8', true)
}

export async function fetchLightProjects(workspace: 'BGC' | 'EGG'): Promise<ProjectRollupEntry[]> {
  if (MOCK_MODE) return getMockPollResult().projectRollup.filter((p) => p.workspace === workspace)

  const config = getConfig()
  const databaseId = workspace === 'BGC' ? config.notion.bgc_tasks_db : config.notion.egg_tasks_db
  if (!databaseId) return []
  return queryProjectRows(databaseId, workspace, false)
}

/** Concatenates a project row's own page body into a single string — the free-text
 *  context/summary/background/history Gregg writes directly on the project's Notion page. */
export async function fetchProjectContext(pageId: string): Promise<string> {
  const client = getClient()
  const response = await queryWithRetry(() =>
    client.blocks.children.list({ block_id: pageId, page_size: 100 })
  )
  const blocks = response.results as unknown as Array<{ type: string; [key: string]: unknown }>

  return blocks
    .map((block) => {
      const body = block[block.type] as { rich_text?: Array<{ plain_text: string }> } | undefined
      return body?.rich_text?.map((rt) => rt.plain_text).join('') ?? ''
    })
    .filter((text) => text.trim().length > 0)
    .join('\n\n')
}
```

- [ ] **Step 2: Add the missing imports**

At the top of `src/main/notion.service.ts`, extend the existing type import line to include the new types:

```typescript
import type { NotionTask, TaskWorkspace, JobRadarEntry, NewsletterEntry, NewsletterArticle, ProjectRollupEntry, ProjectDependency, ProjectHealth } from '../shared/ipc-types'
```

- [ ] **Step 3: Typecheck**

`notion.service.ts` is main-process code — check it with the node config, not the root one:

Run: `npx tsc --noEmit -p tsconfig.node.json`
Expected: same two pre-existing errors as Task 2 Step 4 (`poll.coordinator.ts`, `mock/index.ts` missing `projectRollup`), no new errors in `notion.service.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/main/notion.service.ts
git commit -m "feat: add fetchD8Projects, fetchLightProjects, fetchProjectContext"
```

---

### Task 5: Poll coordinator + mock fixtures

**Files:**
- Modify: `src/main/poll.coordinator.ts`
- Modify: `src/main/mock/notion.fixtures.ts`
- Modify: `src/main/mock/index.ts`

**Interfaces:**
- Consumes: `fetchD8Projects`, `fetchLightProjects` (Task 4).
- Produces: `PollResult.projectRollup` populated on every `pollNotion()` cycle; `MOCK_PROJECT_ROLLUP` fixture for `MOCK_MODE`.

- [ ] **Step 1: Add mock fixture data**

Add to `src/main/mock/notion.fixtures.ts`, after `MOCK_BGC_TASKS`:

```typescript
export const MOCK_PROJECT_ROLLUP: ProjectRollupEntry[] = [
  {
    tier: 'rich',
    id: 'd8-proj-1',
    workspace: 'D8',
    title: 'KCU Enablement',
    status: 'In Progress',
    nextAction: 'Confirm Track 2 session date with Scott',
    url: 'https://notion.so/d8-proj-1',
    lastEditedTime: new Date(Date.now() - 2 * 3600000).toISOString(),
    healthStatus: 'At Risk',
    healthOverride: null,
    risks: 'Track 2 infra dependency slipping — SME availability unconfirmed for next week.',
    nextGate: 'Track 2 Gate Review',
    gateDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    dependsOn: [],
    blocks: [],
  },
  {
    tier: 'light',
    id: 'bgc-proj-1',
    workspace: 'BGC',
    title: 'ODIN',
    status: 'In Progress',
    nextAction: 'Pick up from Gate 3 close',
    url: 'https://notion.so/bgc-proj-1',
    lastEditedTime: new Date(Date.now() - 26 * 3600000).toISOString(),
  },
  {
    tier: 'light',
    id: 'egg-proj-1',
    workspace: 'EGG',
    title: 'Egg_Mission_Control',
    status: 'In Progress',
    nextAction: 'Ship project rollup panel',
    url: 'https://notion.so/egg-proj-1',
    lastEditedTime: new Date(Date.now() - 1 * 3600000).toISOString(),
  },
]
```

Update the import line at the top of that file:

```typescript
import type { NotionTask, JobRadarEntry, NewsletterEntry, ProjectRollupEntry } from '../../shared/ipc-types'
```

- [ ] **Step 2: Wire the mock fixture into `getMockPollResult`**

In `src/main/mock/index.ts`, update the import and the returned object:

```typescript
import type { PollResult } from '../../shared/ipc-types'
import { MOCK_CALENDAR, MOCK_INBOX, MOCK_GMAIL } from './graph.fixtures'
import { MOCK_D8_TASKS, MOCK_EGG_TASKS, MOCK_BGC_TASKS, MOCK_JOB_RADAR, MOCK_JOB_RADAR_UPDATED_AT, MOCK_NEWSLETTERS, MOCK_NEWSLETTERS_UPDATED_AT, MOCK_PROJECT_ROLLUP } from './notion.fixtures'

export function getMockPollResult(): PollResult {
  return {
    calendar: MOCK_CALENDAR,
    inbox: MOCK_INBOX,
    d8Tasks: MOCK_D8_TASKS,
    eggTasks: MOCK_EGG_TASKS,
    bgcTasks: MOCK_BGC_TASKS,
    jobRadar: MOCK_JOB_RADAR,
    jobRadarUpdatedAt: MOCK_JOB_RADAR_UPDATED_AT,
    newsletters: MOCK_NEWSLETTERS,
    newslettersUpdatedAt: MOCK_NEWSLETTERS_UPDATED_AT,
    gmail: MOCK_GMAIL,
    projectRollup: MOCK_PROJECT_ROLLUP,
  }
}

export const MOCK_MODE = process.env.MISSION_CONTROL_MOCK === 'true'
```

- [ ] **Step 3: Wire into `poll.coordinator.ts`**

In `src/main/poll.coordinator.ts`:

Update the import line:
```typescript
import { fetchD8Tasks, fetchEggTasks, fetchBgcTasks, fetchJobRadar, fetchNewsletters, fetchD8Projects, fetchLightProjects } from './notion.service'
```

Update `DEFAULT_POLL_RESULT` to add, after `bgcTasks: [],`:
```typescript
  projectRollup: [],
```

In `pollNotion()`, change the `Promise.allSettled` call and its destructuring to:

```typescript
  const [d8Result, eggResult, bgcResult, jobRadarResult, newslettersResult, d8ProjectsResult, bgcProjectsResult, eggProjectsResult] = await Promise.allSettled([
    fetchD8Tasks(),
    fetchEggTasks(),
    fetchBgcTasks(),
    fetchJobRadar(),
    fetchNewsletters(),
    fetchD8Projects(),
    fetchLightProjects('BGC'),
    fetchLightProjects('EGG'),
  ])
```

Add, after the existing `jobRadar`/`newsletters` destructuring lines and before the Gmail-enrichment `try` block:

```typescript
  const fallbackProjects = fallback.projectRollup
  const d8Projects = d8ProjectsResult.status === 'fulfilled' ? d8ProjectsResult.value : fallbackProjects.filter((p) => p.workspace === 'D8')
  const bgcProjects = bgcProjectsResult.status === 'fulfilled' ? bgcProjectsResult.value : fallbackProjects.filter((p) => p.workspace === 'BGC')
  const eggProjects = eggProjectsResult.status === 'fulfilled' ? eggProjectsResult.value : fallbackProjects.filter((p) => p.workspace === 'EGG')
  const projectRollup = [...d8Projects, ...bgcProjects, ...eggProjects]
```

Add matching error logs alongside the existing ones:
```typescript
  if (d8ProjectsResult.status === 'rejected') console.error('[PollCoordinator] fetchD8Projects failed:', d8ProjectsResult.reason)
  if (bgcProjectsResult.status === 'rejected') console.error('[PollCoordinator] fetchLightProjects(BGC) failed:', bgcProjectsResult.reason)
  if (eggProjectsResult.status === 'rejected') console.error('[PollCoordinator] fetchLightProjects(EGG) failed:', eggProjectsResult.reason)
```

Update the final `_lastResult` assignment to include `projectRollup`:
```typescript
  _lastResult = { ...(_lastResult ?? DEFAULT_POLL_RESULT), d8Tasks, eggTasks, bgcTasks, jobRadar, jobRadarUpdatedAt, newsletters, newslettersUpdatedAt, projectRollup }
```

- [ ] **Step 4: Typecheck and run full test suite**

Run: `npx tsc --noEmit -p tsconfig.node.json`
Expected: no errors — this is the config that actually covers `src/main/**`, and should now clear the two pre-existing errors from Tasks 2 and 4.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `npx vitest run`
Expected: all existing tests plus `test/project-rollup.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/poll.coordinator.ts src/main/mock/notion.fixtures.ts src/main/mock/index.ts
git commit -m "feat: poll project rollup data alongside tasks"
```

---

### Task 6: IPC handler + preload exposure for on-demand project context

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/main.tsx`

**Interfaces:**
- Consumes: `fetchProjectContext` (Task 4).
- Produces: `window.api.getProjectContext(pageId: string): Promise<{ ok: boolean; context?: string; error?: string }>` — Task 8's panel calls this directly.

**Note:** `src/renderer/src/main.tsx` contains a separate browser-shim mock (`window.api` fallback for running the renderer outside Electron) that Task 2 already had to patch with `projectRollup: []` on its `MOCK_POLL` object, to fix a typecheck error Task 2 surfaced. That shim also needs a `getProjectContext` stub once this task adds the real one to the `Window['api']` type, or the shim object literal will fail its own excess/missing-property typecheck.

- [ ] **Step 1: Add the IPC handler**

In `src/main/index.ts`, update the import line:
```typescript
import { validateToken, archiveTask, completeTask, moveTask, fetchProjectContext } from './notion.service'
```

Add, after the existing `move-notion-task` handler:

```typescript
ipcMain.handle(
  'get-project-context',
  async (_event, pageId: string): Promise<{ ok: boolean; context?: string; error?: string }> => {
    try {
      const context = await fetchProjectContext(pageId)
      return { ok: true, context }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
)
```

- [ ] **Step 2: Expose it in preload**

In `src/preload/index.ts`, add inside the `contextBridge.exposeInMainWorld('api', { ... })` object, after `moveTask`:

```typescript
  getProjectContext: (pageId: string): Promise<{ ok: boolean; context?: string; error?: string }> =>
    ipcRenderer.invoke('get-project-context', pageId),
```

Add to the `Window['api']` type declaration at the bottom of the file, after `moveTask`:

```typescript
      getProjectContext: (pageId: string) => Promise<{ ok: boolean; context?: string; error?: string }>
```

- [ ] **Step 3: Add the stub to the browser shim**

In `src/renderer/src/main.tsx`, add to the `window.api = { ... }` object, after `moveTask`:

```typescript
    getProjectContext: () => Promise.resolve({ ok: true, context: '' }),
```

- [ ] **Step 4: Typecheck**

This task touches both configs — `main/index.ts` is node-only, `preload/index.ts` is in both, `renderer/src/main.tsx` is renderer-only:

Run: `npx tsc --noEmit -p tsconfig.node.json`
Expected: no errors.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/main/index.ts src/preload/index.ts src/renderer/src/main.tsx
git commit -m "feat: expose get-project-context IPC channel"
```

---

### Task 7: Renderer types + nav entry

**Files:**
- Modify: `src/renderer/src/types.ts`
- Modify: `src/renderer/src/components/NavSidebar.tsx`

**Interfaces:**
- Produces: `NavPanelId` includes `'projects'` — Task 8/9 depend on this.

- [ ] **Step 1: Extend renderer types**

In `src/renderer/src/types.ts`, extend the re-export line to include the new types:

```typescript
export type { CalendarEvent, NotionTask, InboxData, GmailInboxData, PollResult, TaskWorkspace, JobRadarEntry, ChatMessage, NewsletterEntry, NewsletterArticle, ProjectRollupEntry, ProjectHealth, ProjectDependency } from '../../shared/ipc-types'
```

Update `NavPanelId`:
```typescript
export type NavPanelId = 'meeting' | 'inbox' | 'd8' | 'bgc' | 'egg' | 'jobRadar' | 'newsletters' | 'projects'
```

- [ ] **Step 2: Add the nav icon and entry**

In `src/renderer/src/components/NavSidebar.tsx`, add a new icon function after `NewspaperIcon`:

```typescript
const FolderIcon = () => (
  <svg {...ICON_PROPS} className="w-[18px] h-[18px]">
    <path d="M2.5 5.5a1 1 0 0 1 1-1h4l1.5 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-12.5a1 1 0 0 1-1-1v-9z" />
  </svg>
)
```

Add to `NAV_ITEMS`, after the `newsletters` entry:
```typescript
  { id: 'projects', label: 'Projects', icon: <FolderIcon /> },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: pre-existing errors only from `App.tsx`'s switch statement not yet handling `'projects'` (Task 9 fixes this) — confirm no *other* new errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/types.ts src/renderer/src/components/NavSidebar.tsx
git commit -m "feat: add Projects nav entry"
```

---

### Task 8: ProjectRollupPanel component

**Files:**
- Create: `src/renderer/src/panels/ProjectRollupPanel.tsx`

**Interfaces:**
- Consumes: `PanelState<ProjectRollupEntry[]>`, `window.api.getProjectContext` (Task 6), `PanelHeader`, `SkeletonBars` (existing components).
- Produces: `<ProjectRollupPanel panel={...} />` — Task 9 renders this for the `'projects'` case.

- [ ] **Step 1: Write the component**

```typescript
import { useState } from 'react'
import { PanelHeader } from '../components/PanelHeader'
import { SkeletonBars } from '../components/SkeletonBars'
import type { PanelState, ProjectRollupEntry, ProjectHealth } from '../types'

const HEALTH_STYLE: Record<ProjectHealth, { text: string; bg: string; dot: string }> = {
  'On Track': { text: 'text-mc-d8', bg: 'bg-mc-pill-blue-bg', dot: 'bg-mc-d8' },
  'At Risk': { text: 'text-[#92620a]', bg: 'bg-[#fdf1dc]', dot: 'bg-[#e0a30c]' },
  'Off Track': { text: 'text-mc-error', bg: 'bg-mc-error bg-opacity-10', dot: 'bg-mc-error' },
}

const WORKSPACE_LABEL: Record<string, string> = { D8: 'D8', BGC: 'BGC', EGG: 'Egg' }

function formatLastTouched(iso: string): string {
  const parsed = new Date(iso)
  if (isNaN(parsed.getTime())) return iso
  const days = Math.round((Date.now() - parsed.getTime()) / 86400000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

interface ProjectCardProps {
  project: ProjectRollupEntry
}

function ProjectCard({ project }: ProjectCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [context, setContext] = useState<string | null>(null)
  const [contextLoading, setContextLoading] = useState(false)

  async function handleToggle() {
    const next = !expanded
    setExpanded(next)
    if (next && project.tier === 'rich' && context === null && !contextLoading) {
      setContextLoading(true)
      const result = await window.api.getProjectContext(project.id)
      setContextLoading(false)
      setContext(result.ok ? (result.context ?? '') : '')
    }
  }

  const health = project.tier === 'rich' ? HEALTH_STYLE[project.healthStatus!] : null
  const showRisks = project.tier === 'rich' && !!project.gateDate && !!project.risks
  const hasDeps = project.tier === 'rich' && ((project.dependsOn?.length ?? 0) > 0 || (project.blocks?.length ?? 0) > 0)

  return (
    <div className="rounded-mc-md border border-mc-canvas-border bg-mc-canvas p-3.5">
      <button onClick={handleToggle} className="w-full text-left focus:outline-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-mc-body font-semibold text-mc-ink truncate">{project.title}</div>
            <div className="text-mc-sm text-mc-ink-muted">
              {project.status} · Last touched {formatLastTouched(project.lastEditedTime)}
            </div>
          </div>
          {health && (
            <span className={`flex-shrink-0 text-mc-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-mc-sm ${health.bg} ${health.text}`}>
              {project.healthStatus}
            </span>
          )}
        </div>

        {project.nextAction && (
          <p className="text-mc-sm text-mc-ink mt-2">→ {project.nextAction}</p>
        )}

        {showRisks && (
          <p className="text-mc-sm text-mc-error mt-1.5">⚠ {project.risks}</p>
        )}

        {project.tier === 'rich' && project.nextGate && (
          <p className="text-mc-xs text-mc-ink-faint mt-1.5 uppercase tracking-widest">
            Next gate: {project.nextGate}{project.gateDate ? ` — ${project.gateDate}` : ''}
          </p>
        )}

        {hasDeps && (
          <p className="text-mc-xs text-mc-ink-faint mt-1.5">
            {(project.dependsOn?.length ?? 0) > 0 && `Blocked by ${project.dependsOn!.map((d) => d.title).join(', ')}`}
            {(project.dependsOn?.length ?? 0) > 0 && (project.blocks?.length ?? 0) > 0 && ' · '}
            {(project.blocks?.length ?? 0) > 0 && `Blocking ${project.blocks!.map((d) => d.title).join(', ')}`}
          </p>
        )}
      </button>

      {expanded && project.tier === 'rich' && (
        <div className="mt-3 pt-3 border-t border-mc-canvas-border text-mc-sm text-mc-ink-muted whitespace-pre-wrap">
          {contextLoading ? 'Loading…' : (context || 'No additional context written on this project yet.')}
        </div>
      )}
    </div>
  )
}

interface ProjectRollupPanelProps {
  panel: PanelState<ProjectRollupEntry[]>
}

export function ProjectRollupPanel({ panel }: ProjectRollupPanelProps) {
  const { status } = panel

  const dotState = status.state === 'error' ? 'error'
    : status.state === 'stale' ? 'stale'
    : status.state === 'loading' ? 'loading'
    : status.state === 'not-configured' ? 'not-configured'
    : 'ok'

  const grouped: Record<string, ProjectRollupEntry[]> = { D8: [], BGC: [], EGG: [] }
  for (const p of panel.data ?? []) grouped[p.workspace]?.push(p)

  return (
    <section role="region" aria-label="Project Rollup" className="flex flex-col h-full bg-mc-canvas">
      <PanelHeader label="PROJECT ROLLUP" shortLabel="PROJECTS" dotState={dotState} />

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {status.state === 'loading' && <SkeletonBars count={4} />}

        {status.state === 'not-configured' && (
          <div className="flex items-center justify-center h-full text-mc-ink-muted text-mc-sm">
            Connect Notion to see the project rollup.
          </div>
        )}

        {(status.state === 'ok' || status.state === 'stale' || status.state === 'empty') && (
          (['D8', 'BGC', 'EGG'] as const).map((workspace) => (
            <div key={workspace}>
              <div className="text-mc-xs font-bold uppercase tracking-widest text-mc-ink-faint mb-2">
                {WORKSPACE_LABEL[workspace]}
              </div>
              {grouped[workspace].length === 0 ? (
                <div className="text-mc-sm text-mc-ink-muted">No projects tracked yet.</div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {grouped[workspace].map((p) => <ProjectCard key={p.id} project={p} />)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors from this file (pre-existing `App.tsx` switch-case error from Task 7 still present until Task 9).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/panels/ProjectRollupPanel.tsx
git commit -m "feat: add ProjectRollupPanel component"
```

---

### Task 9: Wire the panel into App.tsx

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `ProjectRollupPanel` (Task 8), `ProjectRollupEntry` (Task 7).

- [ ] **Step 1: Import the panel and type**

Add to the import block:
```typescript
import { ProjectRollupPanel } from './panels/ProjectRollupPanel'
```

Add `ProjectRollupEntry` to the existing `import type { ... } from './types'` line.

- [ ] **Step 2: Add panel title and state**

Add to `PANEL_TITLES`:
```typescript
  projects: 'Project Rollup',
```

Add a new state hook, after `newslettersUpdatedAt`:
```typescript
  const [projectRollupPanel, setProjectRollupPanel] = useState<PanelState<ProjectRollupEntry[]>>(loading())
```

- [ ] **Step 3: Populate it in `applyPollResult`**

Inside the `if (notionConfiguredRef.current) { ... }` block in `applyPollResult`, after the existing `setNewslettersUpdatedAt(result.newslettersUpdatedAt)` line:

```typescript
      setProjectRollupPanel({
        status: result.projectRollup.length === 0 ? { state: 'empty' } : { state: 'ok' },
        data: result.projectRollup,
      })
```

- [ ] **Step 4: Reset it on not-configured and on Notion (re-)connect**

In the `useEffect` mount block, inside the `if (!configured) { ... }` branch, after `setNewsletterPanel(...)`:
```typescript
        setProjectRollupPanel({ status: { state: 'not-configured' }, data: null })
```

In `handleNotionSuccess`, after `setNewsletterPanel(loading())`:
```typescript
    setProjectRollupPanel(loading())
```

- [ ] **Step 5: Add the render case**

In `renderActivePanel()`'s switch, after the `'newsletters'` case:
```typescript
      case 'projects':
        return <ProjectRollupPanel panel={projectRollupPanel} />
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors — this was the last consumer of the Task 7 `NavPanelId` addition.

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 8: Manual smoke test in mock mode**

Run: `MISSION_CONTROL_MOCK=true npm run dev`

In the app: click the new folder icon in the left nav. Expected: three workspace sections (D8, BGC, EGG), each showing the mock project from Task 5's fixtures. Click the D8 card to expand it — expect a "Loading…" flash then "No additional context written on this project yet." (mock mode's `getProjectContext` isn't wired to return fixture text, since it's a live Notion-only call — this is expected, not a bug). Confirm the At Risk pill renders on the D8 card and the BGC/EGG cards show no health pill at all.

- [ ] **Step 9: Manual smoke test against live Notion**

Run: `npm run dev` (without `MISSION_CONTROL_MOCK`), with a real Notion token already configured.

Confirm the Project row created in Task 1 Step 5 for each workspace appears in the correct section, with the correct tier (D8 rich, BGC/EGG light). Expand the D8 project's card and confirm any text written in that row's Notion page body appears under "Loading…".

- [ ] **Step 10: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: wire Project Rollup panel into App"
```

---

## Post-plan validation

Run through `VALIDATION.md`'s Section 1 (Integration Health) for this new surface before calling this phase done, per the project's existing phase-gated validation cadence — add a row for "Project Rollup (Notion)" confirming all three workspaces query without error and D8's health-status derivation matches manual expectation for at least one real project.

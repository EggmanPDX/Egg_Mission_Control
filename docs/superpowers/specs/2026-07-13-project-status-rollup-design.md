# Project-Level Status Rollup — Design

> Item 6 from `NORTH_STAR.md`: "not just a task list — every project (D8, BGC, Egg) with a
> status." This closes the open decision at `NORTH_STAR.md` line 113 ("needs its own data
> model for project-level status").

## Goal

One panel in Mission Control listing every real project across D8, BGC, and Egg, with
enough context per project to answer "what's next" without opening Notion.

## Scope decisions locked this session

- **Unit of rollup:** individual projects (~19, per the project registry), not
  workspace-level (3 rows). Grouped by workspace in the UI.
- **Status source:** hybrid — auto-derived by default, manual override always wins.
- **Depth is asymmetric by workspace, not uniform:**
  - **D8** gets full project detail: health status, risks, next gate + date, next action,
    dependencies, and free-text history/context/background.
  - **BGC and Egg** get lightweight tracking only: existing task-DB status, next action,
    last-touched. No health-status pill, no risks, no gates.
- **Schema pattern is unified across all three workspaces** even though displayed depth
  differs: every workspace's existing task database gets (or already has) a `Type:
  Task/Project` split, and "project" rows are just rows in that same database, not a
  separate database per workspace.

## Data model (Notion schema changes)

### D8 Tasks & Projects (existing DB, `Type: Project` rows only)
New properties:
- `Health Status` — select: On Track / At Risk / Off Track (blank = auto-derive)
- `Risks` — text, free-form running log
- `Next Gate` — text
- `Gate Date` — date
- `Next Action` — text

Reused, not new:
- `Depends On` / `Blocks` — existing relation properties on this DB already support
  cross-project dependency links.
- Page body of each Project row — free-text context, summary, background, history.
  Written directly in Notion by Gregg; Mission Control renders it read-only.

### BGC Tasks & Projects (existing DB, already has `Type: Task/Project`, `Project` rows only)
New property:
- `Next Action` — text

Reused, not new:
- `Status` (To-do/In Progress/Done/Blocked) — sufficient for "what's next," no health pill.
- Notion's built-in last-edited timestamp — used for "last touched," no manual field.

### Egg's Command Center (existing DB)
New properties:
- `Type` — select: Task/Project (mirrors D8/BGC exactly; this DB currently has no
  Task/Project split at all)
- `Next Action` — text, on `Project` rows

No other workspace's existing properties are altered or removed. This design only adds
columns and rows — nothing in the current schema changes meaning or is deleted.

## Health Status auto-derivation (D8 only)

Applies only to D8 `Project` rows. BGC and Egg never compute or display a health pill.

1. If `Health Status` is manually set on the row, use it — always wins, no override logic.
2. Else derive, in order:
   - `Status = Blocked` → **At Risk**
   - `Gate Date` is in the past and `Status != Done` → **Off Track**
   - Any `Depends On` relation whose own `Status != Done` → **At Risk** (rendered as
     "blocked by <project name>")
   - Otherwise → **On Track**

## Display rules

Per-project card content, in priority order:
1. Status (health pill for D8; plain Status select for BGC/Egg)
2. Next Action
3. Page-body context/summary/background/history (D8 only — rendered read-only, lazy-loaded)
4. Risks — **D8 only, and only if `Gate Date` is set.** No gate date means no explicit
   deadline to be at risk of, so the Risks line is hidden rather than shown empty.
5. Dependencies — D8 only, shown as a short "blocked by / blocking" line when
   `Depends On`/`Blocks` relations exist.

BGC and Egg cards are strictly lighter: Status, Next Action, Last Touched. No risks, gates,
or dependencies section at all for these two workspaces.

## Architecture

- `notion.service.ts`:
  - `fetchD8Projects()` — queries D8 Tasks & Projects filtered `Type = Project`, includes
    the new rich fields plus resolved dependency names.
  - `fetchLightProjects(workspace: 'BGC' | 'EGG')` — shared function, queries the
    corresponding DB filtered `Type = Project`, returns Status/Next Action/last-edited only.
  - Page-body context fetch (`blocks.children.list` on a project's own page ID) is a
    separate, lazy call — only fires when a card is expanded in the UI, not on every poll
    cycle. Avoids one extra API call per project every 10 minutes.
- `shared/ipc-types.ts`: new `ProjectRollupEntry` type with a `tier: 'rich' | 'light'`
  discriminant so the renderer picks the right card layout without re-deriving it.
- `renderer/src/panels/ProjectRollupPanel.tsx` (new) + new left-nav entry, grouped by
  workspace (D8 section, BGC section, Egg section).

## Error handling

- A workspace DB missing the new `Type` property (not yet migrated in Notion) → that
  workspace's section shows a "not yet wired" state, same pattern already used for Gmail.
  Never crash the whole panel over one workspace's data.
- A `Depends On`/`Blocks` relation pointing at an archived or deleted page → skip that one
  dependency line silently; don't fail the whole card.

## Testing

- One `vitest` unit test for the Health Status derivation function — pure logic, fixtures
  cover: manual override wins, blocked-by-dependency, past-gate-date, happy path. Matches
  the existing `vitest.config.ts` setup already in this project; no new test infra.

## Non-goals (this pass)

- No write-back for the new fields from Mission Control — Risks/Next Action/Health Status
  overrides are set in Notion directly, same as today's pattern for most fields. (Mark
  Complete / Move / Delete already exist for tasks; this spec doesn't extend write access
  to the new project-level fields.)
- No project-level notifications or alerting — this is a read/display feature only.

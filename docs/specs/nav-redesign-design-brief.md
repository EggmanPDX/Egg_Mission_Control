# Design Brief: Left-Nav Redesign + Job Radar Panel

> For: Design team
> From: Gregg / Mission Control build
> Status: DRAFT — for UI design, not yet built
> Companion doc: [mission-control.md](./mission-control.md) (original approved spec — read for full app context, tech stack, data sources)

## 1. What this app is

Mission Control is a persistent Electron desktop app that lives in Gregg's Dock, always on. It aggregates everything he'd otherwise have to check manually across Microsoft (D8/work) and Google/Notion (BGC/Egg/personal) into one place: calendar, inbox/chat pulse, tasks across three workspaces, and (new) a job search feed. Everything updates automatically in the background (polling every 5–10 min depending on source). It is currently **read-only except for task actions** (mark complete, move between workspaces, delete).

## 2. What's changing: layout, not data

Today the app is a **fixed three-column layout** — all three modules visible simultaneously, side by side, always:

```
┌─────────────┬──────────────────────┬─────────────┐
│  Meeting     │   Notion Tasks        │   Inbox     │
│  Brief       │   (D8 | BGC | Egg     │   Pulse     │
│              │    sub-columns)       │             │
└─────────────┴──────────────────────┴─────────────┘
```

We're moving to a **left-nav + single canvas** model:

```
┌──────────┬────────────────────────────────────────┐
│          │                                        │
│  NAV     │                                        │
│          │              CANVAS                    │
│  ○ Item  │      (shows ONE selected panel's        │
│  ○ Item  │       full content, full width/height)  │
│  ○ Item  │                                        │
│  ○ Item  │                                        │
│  ○ Item  │                                        │
│          │                                        │
└──────────┴────────────────────────────────────────┘
```

- Left nav is a persistent vertical list of icons/labels, one per panel.
- Clicking a nav item swaps the canvas content — only one panel is visible at a time, but it now gets the **entire canvas width**, not 1/3 of it. This means panels can show more per item (more tasks visible, more calendar detail, etc.) than they do today.
- The nav itself is always visible; it does not scroll away.
- One nav item should be visually marked "active" / selected at all times (whichever panel is currently open in the canvas).
- The app should remember the last-open panel across restarts if reasonably easy — not a hard requirement, just a nice-to-have to flag as a question for engineering.

**The data and interactions inside each panel are not changing** — the content described in Section 4 below already exists and is battle-tested. This redesign is purely about *how you navigate between them*.

## 3. Nav inventory (6 items)

| # | Nav label | Status | Data source |
|---|---|---|---|
| 1 | Meeting Brief | Existing | Microsoft Graph (calendar) |
| 2 | Inbox Pulse | Existing | Microsoft Graph (Outlook + Teams) |
| 3 | D8 Tasks | Existing (currently a sub-column of "Notion Tasks") | Notion |
| 4 | BGC Tasks | Existing (currently a sub-column of "Notion Tasks") | Notion |
| 5 | Egg Tasks | Existing (currently a sub-column of "Notion Tasks") | Notion |
| 6 | **Job Radar** | **New — this brief's main ask** | Notion (see Section 4.4) |

Note the "Notion Tasks" 3-column module is being **split into three separate nav items** (D8 / BGC / Egg), one workspace per nav entry, since each now gets a full canvas of its own instead of a cramped sub-column. Each keeps its own color identity (D8 = blue, BGC = its own accent, Egg = egg-yellow — see existing token names in Section 6) since Gregg switches between these mentally as distinct contexts.

Design should feel free to propose grouping (e.g. a "Tasks" section header over D8/BGC/Egg in the nav) if it reads cleaner than six flat items — that's a layout call, not a data change.

## 4. Page-by-page spec

Every nav item below follows the same template: what it is, the exact data available (real field names, already live), suggested content treatment, empty state, interaction, and freshness. Interaction patterns referenced (detail view, notes, status dot) are defined once in Section 5 rather than repeated per page.

### 4.1 Meeting Brief

**What it is:** Today's calendar, in chronological order, pulled from Microsoft Graph.

**Data available per event (confirmed live, real field names):**
- **subject** — event title
- **start / end** — ISO timestamps (used to compute time, duration, and live countdown)
- **attendees** — array of display names
- **webLink** — opens the event in Outlook
- **body** — plain-text agenda/description (optional, may be empty)

**Suggested content treatment:** A vertical list, one row per event, ordered by start time. Each row shows the start time, the subject, and up to ~4 attendee names. The next upcoming event (the first one that hasn't ended yet) should be visually distinct from the rest — an accent border/background — and show a live "in 45 min" style countdown next to it, since that's the one Gregg needs to notice first. Past/later events can recede visually (lower opacity or muted styling).

**Empty state:** "Clear calendar today. Unusual. Enjoy it." — keep this tone, it's intentional (Gregg's brand voice: dry, direct, a little sharp).

**Interaction:** Clicking an event opens a detail view showing the full time range, computed duration, full attendee list, and the agenda body text if present. External action: "Open in Outlook" (via `webLink`).

**Freshness:** Polled from Microsoft Graph roughly every 5 minutes.

### 4.2 Inbox Pulse

**What it is:** A pulse-check on unread Outlook email and Teams chats — not a full inbox, just "how much is piling up and what's most recent," pulled from Microsoft Graph.

**Data available (confirmed live, real field names):**
- **outlookUnread** — total unread count (number)
- **outlookTopSubjects** — array of `{ subject, from }` for the top unread emails
- **teamsUnread** — unread Teams chat count (can be `null` if that permission scope isn't available — needs a distinct visual treatment from "0", e.g. an em-dash)
- **recentChats** — array of Teams messages, each with `from`, `preview` (message snippet), `receivedAt` (timestamp), `webUrl`

**Suggested content treatment:** Two stacked blocks. Top block: a large, prominent unread-email number, with a short list beneath it of the top unread subjects (sender name + subject line). Bottom block: unread Teams chat count, with a short list of the most recent chat previews (sender, message snippet, relative time like "15m ago").

**Empty state:** "Outlook is clear." for the zero-unread case.

**Interaction:** Clicking an email row opens a lightweight detail view (sender + subject — there's no email body fetched, just the header info). Clicking a chat row opens a detail view with the sender, full relative timestamp, and message preview text, with an "Open in Teams" external link.

**Freshness:** Polled from Microsoft Graph roughly every 5 minutes.

### 4.3 D8 Tasks / BGC Tasks / Egg Tasks (one nav item each, same template)

**What it is:** That workspace's active task list, pulled live from its Notion database. Three separate nav items, same content shape, different data source and color identity per workspace.

**Data available per task (confirmed live, real field names):**
- **title** — task name
- **priority** — `P1`, `P2`, `P3`, or `null` (no priority set)
- **status** — free-text status string from Notion (e.g. "In Progress," "Todo")
- **url** — opens the task in Notion

**Suggested content treatment:** A flat, scannable vertical list — one row per task. Each row: a small color-coded dot for priority (P1/P2/P3 each get a distinct color — see Section 6), the task title, and a small secondary indicator dot if Gregg has a private note saved on that task (see 5.2). No need to show status inline in the list — it's one tap away in the detail view. With the full canvas now available (vs. today's cramped 1/3-width sub-column), there's room to show more tasks at once and/or slightly larger touch/click targets — use the space.

**Empty state:** "No active [D8/BGC/Egg] tasks."

**Not-configured state:** If the Notion connection for this workspace hasn't been set up, show a "Connect Notion" prompt with a setup call-to-action instead of the list — this replaces the whole panel content, not just a row.

**Interaction:** Clicking a task opens a detail view showing status and priority, a private notes field, and three actions: **Mark complete**, **Move to** [either of the other two workspaces], and **Delete** (soft-delete/archive, with a confirm-before-delete step). External action: "Open in Notion" (via `url`).

**Freshness:** Polled from Notion roughly every 10 minutes; task actions (complete/move/delete) also trigger an immediate refresh so the change reflects right away rather than waiting for the next poll.

### 4.4 Job Radar (new)

**What it is:** A daily-refreshed list of job postings scored against Gregg's ideal-role profile (AI-forward training/enablement leadership, remote or Portland-OR-based). Currently only 5 roles are shown per day (the top-scoring matches out of everything found) — this is a config value (`TOP_N`) that could change later, not a hard UI constraint.

**Data available per job (confirmed live, real field names/shapes):**
- **title** — role title, e.g. "Director, Field Enablement"
- **company** — e.g. "CoreWeave"
- **location** — city/state or "United States", e.g. "San Francisco, CA"
- **posted_ago** — relative freshness, e.g. "3 hours ago"
- **applicants** — competition signal, e.g. "76 applicants" or "<25 applicants"
- **score** — 0–100 fit score against Gregg's profile
- **reason** — a short (≤12 word) plain-language explanation of *why* it scored that way, e.g. "Director Field Enablement, CoreWeave AI cloud, remote"
- **apply_url** — external LinkedIn apply link

**Suggested content treatment:** Each job should read as a scannable card/row, not a dense table — Gregg is triaging fast, not doing deep research here. At minimum surface: title + company (most prominent), score (this is the primary sort signal and should be visually weighted — think of it like a confidence/fit meter, not just a number), the one-line "reason," and location/posted/applicants as secondary metadata. An "Apply" action should open the LinkedIn listing externally.

**Empty state:** "No strong matches today." (already exists as copy from the backend — reuse or adapt).

**Interaction:** Clicking a job card opens a detail view with the same info as the card, with the external Apply link as the primary action. Job Radar entries have **no task-style actions** (no complete/move/delete) — this is read-only, informational content, not something Gregg manages state on. If it'd be useful, a "Notes" field (same private-notes pattern as tasks, see 5.2) could apply here too — e.g. Gregg jotting "already applied" — but that's optional, flag it as an open question rather than assuming it's wanted.

**Freshness:** Generated once a day (part of Gregg's existing morning brief automation) and includes a "Last updated: [timestamp]" marker — same status pattern as the other panels (see Section 5.3).

## 5. Shared interaction patterns (apply across all panels)

### 5.1 Detail view on click
Clicking any item (meeting, email, chat, task, job) currently opens a **centered modal overlay** with: a type badge (e.g. "D8 Task", "Meeting", "Email"), the item's title, key metadata rows (status, priority, time, attendees, etc. — varies by type), a free-text "Status Notes" field, and (for tasks only) action buttons. There's also an external "Open in [Outlook/Notion/Teams]" link when available.

Open question for design: should this stay a modal in the new full-canvas layout, or become an inline detail panel (e.g. a right-side drawer within the canvas) now that there's more room? Either is fine functionally — flag your recommendation.

### 5.2 Private notes
Every clickable item can have a free-text note attached (stored locally, not synced anywhere) — this is Gregg's own scratch space, e.g. "waiting on Andrew" on a task. Items with a saved note show a small subtle indicator dot in the list view so he knows at a glance which items have context attached.

### 5.3 Status indicator (per panel)
Every panel header shows a small status dot reflecting connection/data health:
- **loading** — first load / fetching
- **ok** — fresh data
- **stale** — data is older than expected (shows "X min ago")
- **error** — fetch failed (shows a re-authenticate action if it's an auth problem)
- **not-configured** — the underlying integration (Notion, Microsoft) hasn't been set up yet, shows a setup prompt instead of content

Job Radar should follow this same status pattern rather than inventing a new one.

### 5.4 Task-only actions (D8/BGC/Egg Tasks panels)
Within a task's detail view: **Mark complete**, **Move to [other workspace]** (e.g. a BGC task can move to D8 or Egg), and **Delete** (soft-delete/archive in Notion, with a confirm-before-delete step). These do not apply to Meeting Brief, Inbox Pulse, or Job Radar items.

## 6. Existing visual language (for consistency, not prescription)

The current build uses a dark, dense, information-forward aesthetic — think mission-control/ops-dashboard, not consumer-app. Existing design tokens worth knowing about (design can evolve these, just know what's already named/wired):
- Per-workspace color identity: `mc-d8` (blue), `mc-bgc` (its own accent), `mc-egg` (yellow/gold) — used for badges, borders, and priority dots throughout
- Priority dots: P1/P2/P3 each get a distinct color
- Typography: small, uppercase, letter-spaced labels for headers/metadata (mono font for some labels); tabular numerals for counts
- Panels use a raised-surface header bar with a bottom border separating it from scrollable content below

None of this is sacred — the design team should feel free to refine it as part of this redesign, especially since panels now get much more canvas real estate than the current cramped 1/3-width columns.

## 7. Open questions for design to resolve

1. Nav: flat 6 items, or grouped (e.g. "Tasks" section containing D8/BGC/Egg)?
2. Detail view: keep as centered modal, or move to an inline drawer given the extra canvas space?
3. Job Radar cards: list rows (like tasks) or a more visual card grid (given score is a key visual signal)?
4. Should the score (0–100) get a visual treatment beyond a number — a bar, a badge color scale, etc.?
5. Persisting "last open panel" across app restarts — nice-to-have, confirm if worth the small engineering lift.

## 8. Explicitly out of scope for this brief

- No changes to what data is fetched or how often
- No changes to task actions (complete/move/delete) — behavior only, not visuals, may change
- No Gmail integration, no newsletter feed panel (separate, not-yet-built Phase 2 items — see [mission-control.md](./mission-control.md))
- No new backend/API work — Job Radar's data already exists and is live (see companion engineering note if needed)

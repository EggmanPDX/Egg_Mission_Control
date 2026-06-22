<!-- /autoplan restore point: /Users/greggeiler/.gstack/projects/Mission_Control/HEAD-autoplan-restore-20260619-091909.md -->
# Spec: Mission Control
> Status: APPROVED — /autoplan reviewed 2026-06-19, 19 decisions applied
> Branch: main
> Started: 2026-06-19

## 1. Core Architectural Goal

Gregg operates across two cloud ecosystems (Microsoft for D8/work, Google for Egg/BGC/personal) with Notion as the shared brain across both. The current 7+ step morning ritual costs 30+ minutes daily and produces missed meetings, unpreparedness with a detail-obsessed manager (MJ), and personal work getting crowded out by D8 urgency. Mission Control is a persistent Electron desktop app — always on, never closed, lives in the Dock — that functions like a world-class executive assistant briefing: proactive, synthesized, anticipatory. MVP delivers three modules: D8 Meeting Brief (today's calendar with prep context), D8 Inbox Pulse (Outlook + Teams unread counts and top subjects), and Notion Task View (D8 and Egg tasks side by side). Everything is read-only. Data refreshes automatically in the background.

## 2. Technical Scope & Boundaries

### In scope
- Electron desktop app (macOS, darwin 25.5.0+)
- Three MVP panels: D8 Meeting Brief, D8 Inbox Pulse, Notion Task View
- Microsoft Graph API integration (OAuth via MSAL for Electron, personal Azure free-tier app registration)
- Notion REST API integration (direct — not MCP) reading D8 Tasks DB and Egg Tasks DB
- OS-level meeting notifications (15-minute warning)
- Background polling: Graph every 5 min, Notion every 10 min
- Electron auto-launch on login
- React + TypeScript + Vite + Tailwind frontend (standard D8/Egg stack)
- electron-vite as the build system
- MSAL.js (`@azure/msal-node`) for Microsoft OAuth token management
- `@notionhq/client` for Notion API
- Token storage: Electron's `safeStorage` API (OS keychain — no plaintext tokens on disk)
- Azure personal free-tier app registration for MVP (migration path documented below)

### Out of scope (v1)
- Composing or sending email, Teams messages, or Notion comments (read-only)
- Mobile or web version (desktop only)
- Multi-user support (single-user, hardcoded to Gregg's accounts)
- Gmail integration (Phase 2)
- Newsletter feed (Phase 2)
- Job Radar panel (Phase 2)
- AI summarization or context memory ("30-day lookback" / MJ feature) (Phase 2)
- Settings/preferences UI (config file for now)
- Windows or Linux builds (macOS only for MVP)
- Tauri (Electron for MVP; Tauri migration is a separate ADR if needed)

## 3. Micro-Steps

> Build order: mock data first, real auth second. All UI work proceeds against `src/main/mock/`
> fixture data. Azure auth and Notion token bootstrap are explicit gates, not assumed prerequisites.

- [ ] Step 1: Scaffold Electron + Vite + React + TypeScript + Tailwind project with electron-vite
- [ ] Step 1b: Add `src/main/mock/` with typed fixture data (Graph calendar, Graph messages, Notion tasks). Add `MISSION_CONTROL_MOCK=true` env var — when set, all services return fixture data. [Decision #16]
- [ ] Step 2: **Auth gate** — Register personal Azure free-tier app; verify MSAL auth succeeds against D8 tenant before proceeding. Validate: (a) `Calendars.Read` + `Mail.Read` delegated scopes granted, (b) `ChannelMessage.Read.All` scope status (if admin-restricted, Teams degrades to "unavailable" badge), (c) `missioncontrol://auth` registered as mobile/desktop redirect URI type. If Conditional Access blocks → proceed to Phase 2 enterprise path. [Decision #5, #15]
- [ ] Step 2b: **Notion gate** — Run `setup-notion.mjs` to prompt for Notion integration token and store in `safeStorage`. Verify D8 Tasks DB + Egg Tasks DB queries return data. [Decision #17]
- [ ] Step 3: Implement MSAL OAuth flow in Electron main process with safeStorage token persistence. Add PKCE documentation note. Add `powerMonitor.on('resume')` for immediate post-sleep poll.
- [ ] Step 4: Implement Microsoft Graph service (`graph.service.ts`) — calendarView (today), messages (top 3 unread), Teams best-effort unread (degrade to 0 + badge if scope unavailable). Add 429 backoff with `Retry-After` header handling. [Decision #13]
- [ ] Step 5: Add Notion integration service (`notion.service.ts`) — query D8 Tasks DB and Egg Tasks DB, filter to active/in-progress, sorted by priority.
- [ ] Step 6: Build D8 Meeting Brief panel — today's meetings sorted by time, next meeting highlighted, attendees, all states (loading/empty/error/stale/auth-pending). [Decision #7]
- [ ] Step 7: Build Notion Task View panel — D8 tasks (left column) and Egg tasks (right column), sorted by priority, max 6 rows visible with scroll, clicking a row opens Notion in browser. [Decision #8, #10]
- [ ] Step 8: Build D8 Inbox Pulse panel — Outlook unread count, top 3 subject lines, Teams unread count (best-effort). All states defined. [Decision #7]
- [ ] Step 9: Add `poll.coordinator.ts` (owns all `setInterval` calls) and `notification.scheduler.ts` (owns `Set<event_id+date>` dedup, fires `electron.Notification`). Calendar cache shared between 5-min Graph poll and 1-min notification check — no extra API calls. [Decisions #11, #12]
- [ ] Step 10: Configure Electron auto-launch on login, Dock icon, fixed 1200×720px window (resizable 900–1600px). [Decision #8]
- [ ] Step 11: Config file (`~/.mission-control/config.json`) with `_meta` key (registration name, portal URL, creation date), Notion DB IDs, Azure client ID, refresh intervals. [Decision #18]
- [ ] Step 12: End-to-end test: all three panels load real data, notification fires at T-15min, no duplicate notification after simulated sleep/wake.

## 4. Verification & Definition of Done

- [ ] App launches on login without user interaction
- [ ] D8 Meeting Brief shows today's calendar within 30 seconds of launch (real Outlook data)
- [ ] OS notification fires 15 minutes before each meeting
- [ ] D8 Inbox Pulse shows correct unread count matching Outlook (verified against actual inbox)
- [ ] Notion Task View shows D8 tasks and Egg tasks with correct statuses
- [ ] Background refresh updates panels without requiring app restart
- [ ] OAuth tokens persist across app restarts (no re-login on relaunch)
- [ ] App handles Microsoft Graph API downtime gracefully (shows last-known data + error badge)
- [ ] No plaintext tokens in `~/.mission-control/` or logs
- [ ] Linter passes with zero errors (`npm run lint`)
- [ ] App quits cleanly and re-launches without data corruption

---

# Full Spec

## Context

Gregg runs two parallel professional lives — D8 (client work, paid, Microsoft ecosystem) and Egg/BGC (personal projects, professional development, Google ecosystem) — from a single MacBook. The current morning requires opening 7+ separate contexts before 9am. This costs 30+ minutes daily, causes missed meetings, and leaves no time for the personal work that drives long-term career development. Mission Control is the front door that replaces all of it.

The MVP is intentionally narrow: solve the D8 urgency problem first (what's on my calendar, what's in my inbox, what are my priorities today), because that's where the daily pain is most acute and most measurable. Personal context and advanced features ship in Phase 2.

## Current State

Manual 7+ step morning ritual (verified 2026-06-19):
1. Phone: read newsletters (The Runway, The Code)
2. Phone/laptop: check BGC Gmail
3. Phone/laptop: check gdogsjunk Gmail
4. Phone/laptop: check personal Gmail (rarely)
5. Laptop: open Outlook, check D8 email
6. Laptop: open Teams, check messages
7. Laptop: open D8 Cloud → D8 Morning Brief (Notion)
8. Laptop: open Egg Cloud → Egg Brief (Notion)
9. All day: constant switching between D8 Cloud (Microsoft) and Egg Cloud (Google)

Cost: ~30 minutes daily / ~100+ hours/year. Recurring failure modes: missed meetings, walking into meetings unprepared, personal/Egg work getting crowded out entirely.

## Proposed Change

A persistent Electron desktop app that launches on login and stays open all day. Three panels cover the D8 urgency problem on day one:

```
┌─────────────────────────────────────────────────────────┐
│  MISSION CONTROL                         [D8] [EGG/BGC] │
├──────────────────┬──────────────────┬───────────────────┤
│  D8 MEETING      │  NOTION TASKS    │  D8 INBOX PULSE   │
│  BRIEF           │                  │                   │
│                  │  D8 ──── EGG     │  Outlook: 12 new  │
│  ● 10:00 Standup │  □ Task A  □ X   │  ─ RE: Q3 Plan   │
│    MJ, Connor    │  □ Task B  □ Y   │  ─ FW: Client    │
│    (in 23 min)   │  □ Task C  □ Z   │  ─ RE: Review    │
│                  │                  │                   │
│  ○ 2:00 Strategy │  (scroll for ↓)  │  Teams: best-     │
│    MJ, Full team │                  │  effort (may show │
│                  │                  │  0 if restricted) │
│  ○ 4:00 1:1 MJ  │                  │                   │
└──────────────────┴──────────────────┴───────────────────┘
```
Panel order rationale: Meeting Brief anchors the left (first question at 8am).
Notion Tasks is center (highest decision-value — drives what gets done between meetings).
Inbox Pulse is right (ambient awareness — unread counts, read-only). [Decision #6]

### Implementation Details

#### Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Desktop wrapper | Electron | Mature, JS-native, macOS-first, matches existing skill set |
| Build system | electron-vite | Vite-native, fast HMR, production-ready Electron builds |
| Frontend | React + TypeScript | Standard stack per CLAUDE.md |
| Styling | Tailwind CSS | Standard stack per CLAUDE.md |
| Microsoft auth | `@azure/msal-node` | Official Microsoft library for Electron/Node OAuth |
| Notion | `@notionhq/client` | Official Notion SDK |
| Token storage | `electron.safeStorage` | OS keychain via Electron — no plaintext tokens |
| Config | `~/.mission-control/config.json` | Simple JSON, gitignored, user-editable |

#### Microsoft Graph Integration

Azure app registration (personal free-tier for MVP):
- App type: Public client / native
- Redirect URI: `missioncontrol://auth` (custom protocol, registered in Electron)
- Required scopes: `Calendars.Read`, `Mail.Read`, `ChannelMessage.Read.All` (delegated)

Graph endpoints used:
```
GET /me/calendarView?startDateTime=<today 00:00>&endDateTime=<today 23:59>
  → today's meetings, sorted by start time

GET /me/messages?$top=3&$select=subject,from,receivedDateTime&$filter=isRead eq false&$orderby=receivedDateTime desc
  → top 3 unread Outlook messages

GET /me/chats?$expand=lastMessagePreview
  → Teams chat unread counts (best-effort; Channel unread requires additional scope)
```

Polling: every 5 minutes via `setInterval` in Electron main process. Tokens refreshed silently via MSAL refresh token flow before expiry.

#### Notion Integration

Direct REST via `@notionhq/client`. Auth: Notion integration token stored in `electron.safeStorage`. Two database queries on launch + every 10 minutes:

```typescript
// D8 Tasks
notionClient.databases.query({
  database_id: 'ff6a202b-2ee2-4756-857e-f002bb15a953',
  filter: { property: 'Status', status: { does_not_equal: 'Done' } },
  sorts: [{ property: 'Priority', direction: 'ascending' }]
})

// Egg Tasks
notionClient.databases.query({
  database_id: '052bcc79-ac77-40f0-a5ad-a99f8e868d30',
  filter: { property: 'Status', status: { does_not_equal: 'Done' } },
  sorts: [{ property: 'Priority', direction: 'ascending' }]
})
```

#### Meeting Notifications

`electron.Notification` API fires when a meeting is 15 minutes away. Polling loop checks calendar data every minute against current time. Notification includes: meeting title, attendees, start time. Clicking notification brings Mission Control to foreground.

#### Config File

`~/.mission-control/config.json` (created on first launch with defaults):
```json
{
  "notion": {
    "d8_tasks_db": "ff6a202b-2ee2-4756-857e-f002bb15a953",
    "egg_tasks_db": "052bcc79-ac77-40f0-a5ad-a99f8e868d30"
  },
  "azure": {
    "client_id": "<from app registration>",
    "tenant_id": "common"
  },
  "refresh": {
    "graph_interval_ms": 300000,
    "notion_interval_ms": 600000,
    "notification_lead_minutes": 15
  }
}
```

#### Error Handling

Each panel is independent. If Microsoft Graph is down, Meeting Brief and Inbox Pulse show last-known data with a yellow "Last updated: 12 min ago" badge. Notion down: Task View shows stale data with same badge. Auth failure: panel shows "Re-authenticate" button. No panel failure cascades to others.

## Azure Migration Plan

### MVP: Personal Free-Tier App Registration

1. Create Azure account at portal.azure.com with personal Microsoft account
2. Register app: "Mission Control (personal)" — Public client, macOS
3. Add scopes: `Calendars.Read`, `Mail.Read`, `ChannelMessage.Read.All`
4. Copy `client_id` into `~/.mission-control/config.json`
5. On first launch, MSAL opens browser for one-time sign-in with D8 Microsoft account
6. Tokens cached in OS keychain — subsequent launches are silent

**Limitation:** Personal app registrations can only be authorized by the account owner. MFA policies on the D8 tenant may require additional steps. If D8 IT has Conditional Access policies blocking third-party apps, this will fail and you'll need Phase 2 migration sooner.

### Phase 2: Migration to D8 Azure AD Tenant

When to trigger: if D8 IT blocks personal app registration, or when Mission Control becomes team-facing.

Steps:
1. Work with D8 IT to register "Mission Control" as an enterprise app in the D8 Azure AD tenant
2. Request admin consent for the same 3 scopes (or equivalent)
3. Update `config.json`: change `tenant_id` from `"common"` to the D8 tenant GUID
4. Update `client_id` to the new enterprise app registration ID
5. Users re-authenticate once against the D8 tenant (existing tokens are not portable)
6. Personal app registration can be deleted after migration is confirmed

**Tech migration notes:**
- No code changes required — MSAL handles `common` vs tenant-specific auth transparently
- Token cache format is identical — only the stored token values change
- Custom redirect URI (`missioncontrol://auth`) must be re-registered in the new app registration
- If D8 IT requires a broker (WAM on Windows or Company Portal on macOS), add `@azure/msal-node-extensions` for broker support

## Acceptance Criteria

1. App launches automatically on macOS login with no user interaction required
2. D8 Meeting Brief displays today's meetings from real Outlook calendar within 30 seconds of launch
3. OS notification fires at exactly T-15 minutes before each calendar event (verified against a test meeting)
4. D8 Inbox Pulse shows unread count matching Outlook inbox (manually verified against actual Outlook)
5. Notion Task View shows active D8 and Egg tasks with correct statuses from their respective databases
6. All three panels refresh automatically every 5/10 minutes without app restart
7. OAuth tokens survive app quit + relaunch — no re-authentication prompt on second launch
8. If Microsoft Graph returns 5xx error, panel shows stale data badge, not a crash
9. No token or credential appears in plaintext in `~/.mission-control/`, logs, or crash reports
10. `npm run lint` passes with zero errors

## Testing Plan

| Layer | What | Count |
|---|---|---|
| Unit | MSAL token refresh logic, Graph response parser, Notion query filter | +6 |
| Unit | Meeting notification trigger (mock current time vs meeting time) | +3 |
| Integration | Graph calendarView → Meeting Brief panel renders correct events | +2 |
| Integration | Notion query → Task View renders correct tasks with correct statuses | +2 |
| Integration | Error state: Graph returns 503 → stale badge appears, no crash | +2 |
| E2E | Full launch: all 3 panels show real data within 30s | +1 |
| E2E | Notification fires at T-15 for a real calendar event | +1 |

## Rollback Plan

This is a new local desktop app with no shared infrastructure and no data writes. Rollback = quit the app and delete `~/Applications/Mission Control.app`. No database migrations. No server state. Token data in OS keychain can be cleared via Keychain Access.app.

## Effort Estimate

| Component | Estimate |
|---|---|
| Electron + Vite + React + Tailwind scaffold | 2h |
| Azure app registration + MSAL OAuth flow | 3h |
| Microsoft Graph service (calendar, inbox, Teams) | 4h |
| Notion integration service | 2h |
| D8 Meeting Brief panel UI | 3h |
| D8 Inbox Pulse panel UI | 2h |
| Notion Task View panel UI | 2h |
| Mock data layer + MISSION_CONTROL_MOCK mode | 1h |
| Background polling + error states + 429 backoff | 3h |
| OS notifications + dedup + powerMonitor resume | 2h |
| Config file + setup-notion.mjs bootstrap | 2h |
| Tests (unit: 14 new + integration: 4) | 4h |
| **Total** | **~30h** (revised from 25h; MSAL+Electron first-time overhead accounted) |

## Files Reference

| File | Purpose |
|---|---|
| `package.json` | Electron + Vite + React + Tailwind dependencies |
| `electron.vite.config.ts` | Build config |
| `src/main/index.ts` | Electron main process — window lifecycle + app events ONLY |
| `src/main/auth.service.ts` | MSAL OAuth flow + safeStorage token management (PKCE, Notification API) |
| `src/main/graph.service.ts` | Microsoft Graph API client (calendar, messages, Teams best-effort) |
| `src/main/notion.service.ts` | Notion API client (D8 + Egg task DB queries) |
| `src/main/poll.coordinator.ts` | **NEW** — owns all setInterval calls; shared calendar cache for notification check |
| `src/main/notification.scheduler.ts` | **NEW** — Set<event_id+date> dedup; fires electron.Notification at T-15 |
| `src/main/config.ts` | Config file read/write; auto-creates with defaults + _meta on first launch |
| `src/main/mock/graph.fixtures.ts` | **NEW** — typed Graph API fixture data for MISSION_CONTROL_MOCK=true mode |
| `src/main/mock/notion.fixtures.ts` | **NEW** — typed Notion API fixture data for MISSION_CONTROL_MOCK=true mode |
| `src/renderer/App.tsx` | Root React component, 3-panel layout (Meeting Brief / Tasks / Inbox) |
| `src/renderer/panels/MeetingBrief.tsx` | D8 Meeting Brief panel (all 5 states: loading/empty/error/stale/auth-pending) |
| `src/renderer/panels/NotionTasks.tsx` | Notion Task View panel (center, max 6 rows + scroll, click → Notion browser) |
| `src/renderer/panels/InboxPulse.tsx` | D8 Inbox Pulse panel (right, Teams best-effort count) |
| `setup-notion.mjs` | **NEW** — first-run CLI: prompts for Notion token, stores in safeStorage |
| `~/.mission-control/config.json` | User config (gitignored, created on first launch, includes _meta key) |

## Out of Scope

- Composing or sending email, Teams messages, or Notion comments (read-only only)
- Mobile or web version
- Gmail or Google Drive integration (Phase 2)
- Newsletter feed — The Runway, The Code (Phase 2)
- Job Radar panel (Phase 2)
- AI summarization or context memory — the "MJ 30-day lookback" feature (Phase 2)
- Settings UI — config is a JSON file for now
- Windows or Linux builds
- Multi-user support

## Phase 2 Preview

After MVP is stable and the 4hr D8 + 3hr Egg split is being hit consistently:

- **Gmail Digest panel** — BGC + personal Gmail unread summary
- **Newsletter Feed** — The Runway + The Code surfaced in-app instead of phone
- **Job Radar panel** — surfaces new matches from Egg Morning Brief Notion DB
- **Context Memory layer** — "MJ feature": AI-powered lookback that surfaces relevant prior context from Teams/Outlook/Notion before meetings
- **D8 Azure AD migration** — if IT requires it
- **Tauri port** — if Electron bundle size or memory becomes a problem

---

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|---------|
| 1 | CEO | Reorder micro-steps: Add mock data layer before Azure auth | Mechanical | P6 (bias toward action) | User confirmed: build with dummy data first, wire real auth when ready. Derisks UI build from auth unknowns. | Build UI against live auth from day 1 |
| 2 | CEO | Menu bar vs. Electron window: keep Electron | Taste | P5 (explicit over clever) | OS notifications (T-15 meeting alert) require Electron's `Notification` API. Menu bar can't deliver reliable OS-level alerts. | Menu bar app |
| 3 | CEO | `setInterval` polling strategy: flag for eng review | Taste | P1 (completeness) | Sleep/wake stale data is a real failure mode. Visibility-aware polling with `powerMonitor.on('resume')` should be evaluated in Eng phase. | Keep naive setInterval |
| 4 | CEO | Egg crowding premise: accept as visibility improvement | Mechanical | P3 (pragmatic) | User accepted. Dashboard provides visibility even if behavior change requires personal discipline. | Reject premise / cut Notion panel |
| 5 | CEO | Azure auth risk: proceed with dummy data dev strategy | Mechanical | P6 (bias toward action) | User confirmed D8 won't block. Dummy data approach lets UI build proceed independently. | Gate all development on auth validation |
| 6 | Design | Reorder panels: Meeting Brief → Notion Tasks → Inbox Pulse | Taste | P5/P1 | Tasks drive the day's decisions; unread count is ambient. Surfaced at final gate. | Keep original wireframe order |
| 7 | Design | Add states matrix (loading/empty/error/stale/auth) | Mechanical | P1 | Critical gap — 8am launch with blank panels is the worst UX outcome. | Defer to implementation |
| 8 | Design | Add layout constraints section (1200×720, max 6 rows, scroll) | Mechanical | P5 | Without constraints, implementer picks arbitrarily and rework happens in Phase 2. | Defer |
| 9 | Design | Teams scope: degrade gracefully (show 0 + badge if scope denied) | Mechanical | P3 | Teams unread count via /me/chats does NOT return aggregate counts. Ship as best-effort. | Cut Teams from v1 |
| 10 | Design | Notification dedup: Set<event_id + date>, clear at midnight | Mechanical | P1 | Sleep/wake without dedup = duplicate notifications. Common laptop usage pattern. | Document as known issue |
| 11 | Eng | Add poll.coordinator.ts + notification.scheduler.ts to file table | Mechanical | P5 | index.ts god-file is the #1 maintainability risk for solo projects. Clear separation from day 1. | Keep in index.ts |
| 12 | Eng | Use cached calendar data for 1-min notification check | Mechanical | P1 | 60 extra API calls/hour per the current spec. 429 risk + unnecessary. | Hit API every minute |
| 13 | Eng | Add 429 backoff to Graph service | Mechanical | P1 | Unhandled 429 = silent stale data with no user signal distinguishing throttle from outage. | Silently fail |
| 14 | Eng | Add 8 missing failure mode handlers (see Failure Modes Registry) | Mechanical | P1 | safeStorage throw → crash; config missing → panels fail to load. Basic production hardening. | Ship without |
| 15 | Eng | Teams API: validate endpoint availability in Step 2 | Mechanical | P6 | /me/chats does not return unread counts. Must validate before building Teams UI. | Ship and discover later |
| 16 | DX | Add src/main/mock/ with typed fixture data + MISSION_CONTROL_MOCK=true | Mechanical | P1/P5 | Decision #1 mandates mock-first but mock layer is nowhere in the spec. Without this, first UI work blocks on Azure auth. | Defer mock layer |
| 17 | DX | Document Notion token bootstrap: setup-notion.mjs or equivalent first-run step | Mechanical | P1 | Notion token goes into safeStorage but the spec has no path for putting it there on first install. Silent failure otherwise. | Leave undocumented |
| 18 | DX | Add _meta key to config.json schema (registration name, portal URL, date) | Mechanical | P3 | 2-line fix prevents 30-min archaeology session when returning after 6 months. | Leave bare |
| 19 | DX | Add keychain migration note to rollback plan for Electron version upgrades | Mechanical | P1 | Electron binary signature change can break safeStorage — tokens unreadable after npm update bumps Electron. | Leave undocumented |

---

## Eng Review Decision Log (2026-06-20)

Decisions applied from /plan-eng-review:

| # | Decision | Outcome |
|---|----------|---------|
| D2 | IPC layer | Add `src/preload/index.ts` + `contextBridge.exposeInMainWorld` IPC contract |
| D3 | Notion first-run | Replace `setup-notion.mjs` with in-app first-run setup window (safeStorage not accessible from standalone Node.js) |
| D4 | Packaging | Add `electron-builder` for macOS .app bundle + auto-launch |
| D5 | OAuth protocol | Add `app.setAsDefaultProtocolClient('missioncontrol')` + `open-url` handler in `auth.service.ts` |
| D6 | Shared types | Add `src/renderer/types.ts` with `PanelState<T>` discriminated union |
| D7 | Interval ownership | `poll.coordinator.ts` owns ALL `setInterval` calls; `notification.scheduler.ts` is pure functions + dedup Set |
| D8 | Test coverage | Expand from 17 to ~40 tests (Vitest); cover all 32 code paths |
| D9 | Test framework | Vitest + `@vitest/coverage-v8` |
| D10 | Poll parallelism | `Promise.all` for Graph calls group; `Promise.all` for Notion calls group; groups sequential |
| D11 | Initial poll | Eager poll on `app.ready` before first `setInterval` tick |
| D12 | Dev OAuth | Localhost redirect fallback for dev mode (`NODE_ENV=development`); both URIs registered in Azure |
| D13 | Window management | `app.on('window-all-closed', e => e.preventDefault())`; `app.on('activate', ...)` restores window; Cmd+Q quits cleanly |
| D14 | Teams scope | Replace `ChannelMessage.Read.All` with `Chat.Read` (delegated); `/me/chats` returns DM/group chat, not channel messages |
| D15 | First-run window spec | Add `src/renderer/panels/NotionSetup.tsx` to Files Reference; 2 new IPC handlers (`saveNotionToken`, `validateNotionToken`) |
| TODO-1 | Notion 429 | Add Retry-After backoff to `notion.service.ts` mirroring `graph.service.ts` |
| TODO-2 | Config JSON error | `try/catch` around `JSON.parse()` in `config.ts`; rename broken file to `.bak`; write defaults |
| TODO-3 | Notion skip | Allow skip in first-run setup; Notion panel shows `not-configured` PanelState variant |

## Updated Files Reference

| File | Purpose | Change |
|---|---|---|
| `package.json` | Dependencies | Add: electron-builder, auto-launch, vitest, @vitest/coverage-v8 |
| `electron.vite.config.ts` | Build config | — |
| `electron-builder.yml` | **NEW** | macOS packaging: appId, mac.target (dmg), auto-launch config |
| `vitest.config.ts` | **NEW** | Vitest test config |
| `src/main/index.ts` | Main process — window lifecycle | Add: window-all-closed, activate, Cmd+Q handlers |
| `src/main/auth.service.ts` | MSAL OAuth + safeStorage | Add: protocol registration, open-url handler, localhost dev fallback, safeStorage try/catch |
| `src/main/graph.service.ts` | Microsoft Graph (calendar, messages, Teams) | Fix: Teams scope → Chat.Read |
| `src/main/notion.service.ts` | Notion API client | Add: 429 Retry-After backoff |
| `src/main/poll.coordinator.ts` | Owns ALL setInterval calls + eager initial poll | Add: Promise.all spec, eager launch poll |
| `src/main/notification.scheduler.ts` | Pure functions: T-15 dedup + midnight clear | No change from prior spec |
| `src/main/config.ts` | Config read/write + defaults | Add: try/catch JSON.parse + .bak recovery |
| `src/main/auto-launch.ts` | **NEW** | electron-builder auto-launch registration |
| `src/main/mock/graph.fixtures.ts` | Graph fixture data | — |
| `src/main/mock/notion.fixtures.ts` | Notion fixture data | — |
| `src/preload/index.ts` | **NEW** | contextBridge IPC contract (window.api.*) |
| `src/renderer/App.tsx` | 3-panel layout + first-run gate | Add: conditionally render NotionSetup if !isNotionConfigured |
| `src/renderer/types.ts` | **NEW** | PanelState<T> discriminated union (loading/empty/error/stale/ok/not-configured) |
| `src/renderer/panels/MeetingBrief.tsx` | D8 Meeting Brief panel | — |
| `src/renderer/panels/NotionTasks.tsx` | Notion Task View panel | — |
| `src/renderer/panels/InboxPulse.tsx` | D8 Inbox Pulse panel | — |
| `src/renderer/panels/NotionSetup.tsx` | **NEW** | First-run Notion token setup (3 states: idle/validating/error) |
| `~/.mission-control/config.json` | User config | — |

## Implementation Tasks
Synthesized from /plan-eng-review findings. Each task derives from a specific finding. Run with Claude Code; checkbox as you ship.

- [ ] **T1 (P1, human: ~2h / CC: ~10min)** — preload IPC layer — Add `src/preload/index.ts` with `contextBridge.exposeInMainWorld` defining `window.api.*` IPC contract
  - Surfaced by: Architecture review — missing IPC bridge between main and renderer
  - Files: `src/preload/index.ts`, `src/main/index.ts`
  - Verify: renderer panel can call `window.api.getCalendarEvents()` and receive data

- [ ] **T2 (P1, human: ~2h / CC: ~15min)** — first-run Notion setup — Add `src/renderer/panels/NotionSetup.tsx` with idle/validating/error states + 2 IPC handlers (`saveNotionToken`, `validateNotionToken`)
  - Surfaced by: D3 + D15 — setup-notion.mjs can't access safeStorage; setup window not in Files Reference
  - Files: `src/renderer/panels/NotionSetup.tsx`, `src/preload/index.ts`, `src/main/auth.service.ts`
  - Verify: entering a valid Notion token stores it in safeStorage and loads Notion Tasks panel

- [ ] **T3 (P1, human: ~2h / CC: ~15min)** — electron-builder packaging — Add `electron-builder.yml` + `src/main/auto-launch.ts`; `npm run dist` produces macOS .app
  - Surfaced by: Architecture review D4 — auto-launch on login requires packaged app
  - Files: `electron-builder.yml`, `src/main/auto-launch.ts`, `package.json`
  - Verify: `npm run dist` produces `.app`; app appears in Login Items after first launch

- [ ] **T4 (P1, human: ~1h / CC: ~10min)** — OAuth protocol + dev fallback — `app.setAsDefaultProtocolClient('missioncontrol')` + `open-url` handler + localhost redirect for `NODE_ENV=development`
  - Surfaced by: D5 + D12 — protocol not wired in Electron; dev mode has no fallback
  - Files: `src/main/auth.service.ts`
  - Verify: OAuth round-trip works in dev (localhost) and in packaged app (missioncontrol://)

- [ ] **T5 (P1, human: ~30min / CC: ~5min)** — shared panel types — Add `src/renderer/types.ts` with `PanelState<T>` discriminated union (loading | empty | error | stale | ok | not-configured)
  - Surfaced by: Code quality D6 + TODO-3
  - Files: `src/renderer/types.ts`
  - Verify: all 3 panel components import from `types.ts`, no duplicate state type definitions

- [ ] **T6 (P2, human: ~30min / CC: ~5min)** — interval ownership doc — Add comments to `poll.coordinator.ts` and `notification.scheduler.ts` clarifying ownership split
  - Surfaced by: Code quality D7 — ambiguity between coordinator and scheduler
  - Files: `src/main/poll.coordinator.ts`, `src/main/notification.scheduler.ts`
  - Verify: no `setInterval` in `notification.scheduler.ts`

- [ ] **T7 (P1, human: ~5h / CC: ~15min)** — test framework + expanded coverage — Add `vitest.config.ts` + expand test count from 17 to ~40 covering all 32 code paths in the coverage diagram
  - Surfaced by: Test review D8/D9 — 28% coverage, 4 Decision Audit Trail gaps untested
  - Files: `vitest.config.ts`, `test/*.test.ts`
  - Verify: `npm run test` passes, `npm run coverage` shows ≥80% line coverage

- [ ] **T8 (P1, human: ~15min / CC: ~3min)** — parallel poll execution — `poll.coordinator.ts` uses `Promise.all` for Graph calls and `Promise.all` for Notion calls
  - Surfaced by: Performance D10 — sequential calls = up to 2.5s per cycle
  - Files: `src/main/poll.coordinator.ts`
  - Verify: 5 API calls complete in ~500ms, not 2.5s

- [ ] **T9 (P1, human: ~15min / CC: ~2min)** — eager initial poll — `poll.coordinator.ts` fires `runAllPolls()` once on `app.ready` before setting intervals
  - Surfaced by: Performance D11 — panels blank for up to 5-10 min without initial poll
  - Files: `src/main/poll.coordinator.ts`
  - Verify: all 3 panels show data within 30 seconds of launch

- [ ] **T10 (P1, human: ~1h / CC: ~5min)** — window management — Add `window-all-closed` → `preventDefault()`, `activate` → show window, Cmd+Q → quit cleanly to `src/main/index.ts`
  - Surfaced by: D13 cross-model tension — "always open in Dock" UX promise unspecified
  - Files: `src/main/index.ts`
  - Verify: red X hides window (stays in Dock); clicking Dock icon restores window; Cmd+Q quits

- [ ] **T11 (P1, human: ~15min / CC: ~2min)** — fix Teams scope — Replace `ChannelMessage.Read.All` with `Chat.Read` in Azure scope list and `graph.service.ts` notes
  - Surfaced by: D14 cross-model tension — ChannelMessage.Read.All is application permission, not delegated
  - Files: `src/main/graph.service.ts`, spec Azure section
  - Verify: `/me/chats` with `Chat.Read` returns data (DM + group chats, not channel messages)

- [ ] **T12 (P1, human: ~30min / CC: ~3min)** — safeStorage error recovery — Wrap `safeStorage.decryptString()` in `try/catch` in `auth.service.ts`; on error: clear stored tokens + show re-auth prompt
  - Surfaced by: Failure modes critical gap — Decision #19 risk, no handler
  - Files: `src/main/auth.service.ts`
  - Verify: simulated decryptString() throw → app shows auth-pending panel (not crash)

- [ ] **T13 (P2, human: ~30min / CC: ~5min)** — Notion 429 backoff — Add Retry-After backoff to `notion.service.ts` mirroring Graph implementation
  - Surfaced by: TODO-1 — Notion 429 handler absent while Graph 429 is documented
  - Files: `src/main/notion.service.ts`
  - Verify: simulated 429 → Notion panel shows stale badge after retry exhausted

- [ ] **T14 (P2, human: ~15min / CC: ~2min)** — config JSON recovery — `try/catch` around `JSON.parse()` in `config.ts`; rename broken file to `config.json.bak`; write defaults
  - Surfaced by: TODO-2 — malformed config silently crashes app on launch
  - Files: `src/main/config.ts`
  - Verify: corrupt config.json → app launches with defaults; `.bak` file created

## Design Implementation Tasks
Synthesized from /plan-design-review findings (2026-06-20). Run with Claude Code; checkbox as you ship.

- [ ] **T-DS1 (P1, human: ~1h / CC: ~5min)** — tailwind.config.ts — Add mc-* color/spacing/font design tokens
  - Surfaced by: Pass 5 — no design system; implementation would use hardcoded inconsistent hex values
  - Files: `tailwind.config.ts`
  - Verify: all panel components use `mc-*` tokens exclusively; no raw hex/opacity values in JSX

- [ ] **T-DS2 (P1, human: ~2h / CC: ~10min)** — MeetingBrief.tsx — Next-meeting card: blue tint + left border + yellow countdown
  - Surfaced by: Pass 1 D1 — "next meeting highlighted" unspecified; would default to font-weight:bold
  - Files: `src/renderer/panels/MeetingBrief.tsx`
  - Verify: next meeting shows mc-D8-bg bg, 3px mc-d8 left border, yellow "⏱ in X min" pill; later meetings at 75% opacity

- [ ] **T-DS3 (P1, human: ~1h / CC: ~5min)** — All panels — Skeleton bar loading state (animated pulse, no spinner)
  - Surfaced by: Pass 2 D3 — loading state unspecified across all 3 panels
  - Files: `src/renderer/panels/MeetingBrief.tsx`, `src/renderer/panels/NotionTasks.tsx`, `src/renderer/panels/InboxPulse.tsx`
  - Verify: each panel shows 3-4 skeleton bars on `PanelState = 'loading'`; no spinner anywhere

- [ ] **T-DS4 (P1, human: ~30min / CC: ~5min)** — NotionTasks.tsx — 6px priority dot (P1=red, P2=yellow, P3=gray)
  - Surfaced by: Pass 1 D2 — no priority encoding; tasks scan as uniform undifferentiated list
  - Files: `src/renderer/panels/NotionTasks.tsx`
  - Verify: P1 tasks show mc-priority-p1 dot; P2 mc-priority-p2; P3 mc-priority-p3

- [ ] **T-DS5 (P2, human: ~30min / CC: ~5min)** — auth.service.ts + panels — Status dots flash green 1s after first-time auth success
  - Surfaced by: Pass 3 D6 — no auth success moment; user uncertain if OAuth worked
  - Files: `src/main/auth.service.ts`, `src/renderer/panels/MeetingBrief.tsx`, `src/renderer/panels/InboxPulse.tsx`
  - Verify: after OAuth callback, Meeting Brief + Inbox Pulse status dots pulse mc-ok for 1s; never repeats after first auth

- [ ] **T-DS6 (P1, human: ~30min / CC: ~5min)** — App.tsx — D8 titlebar badge dims to red on auth failure; click triggers re-auth
  - Surfaced by: Pass 7 D12 — auth failure invisible at titlebar level; user has no ambient signal
  - Files: `src/renderer/App.tsx`
  - Verify: simulated auth failure → D8 badge shows red tint; clicking badge fires re-auth IPC call

- [ ] **T-DS7 (P2, human: ~1h / CC: ~10min)** — All interactive elements — Full keyboard navigation
  - Surfaced by: Pass 6 D10 — no keyboard nav spec; task rows not keyboard-accessible
  - Files: `src/renderer/panels/NotionTasks.tsx`, `src/renderer/panels/MeetingBrief.tsx`, `src/renderer/App.tsx`
  - Verify: Tab navigates through all panels; Enter/Space on task row opens Notion; "Re-authenticate" and CTA buttons keyboard-accessible; panels have role="region" aria-label

- [ ] **T-DS8 (P1, human: ~15min / CC: ~3min)** — notification.scheduler.ts — Notification click: app.show() + mainWindow.focus()
  - Surfaced by: Pass 7 D13 — default Electron notification click unreliable on macOS
  - Files: `src/main/notification.scheduler.ts`, `src/main/index.ts`
  - Verify: clicking notification brings Mission Control to foreground from both hidden and behind-other-apps states

---

## Design Specification (2026-06-20 — /plan-design-review)

### Color System (tailwind.config.ts extension)

Define as a custom theme extension — all panel components reference these tokens, no hardcoded hex in components.

```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      mc: {
        base:             '#0a0a0a',  // window background
        surface:          '#111111',  // panel backgrounds
        'surface-raised': '#151515',  // panel headers, elevated surfaces
        border:           '#1e1e1e',  // panel dividers, row separators
        'border-subtle':  '#2a2a2a',  // element borders (badges, inputs)
        // Context accents
        d8:               '#5b9cf6',  // D8 accent — blue
        'D8-bg':          '#1a3a6b',  // D8 tinted backgrounds
        'D8-border':      '#2a4a7b',  // D8 bordered elements
        egg:              '#5bc45b',  // Egg accent — green
        'egg-bg':         '#1a3a1a',  // Egg tinted backgrounds
        'egg-border':     '#2a4a2a',  // Egg bordered elements
        // Status system
        ok:               '#28c840',  // status dot ok
        stale:            '#febc2e',  // status dot stale
        error:            '#ff5f57',  // status dot error
        // Priority dots
        'priority-p1':    '#ff5f57',  // P1 = red
        'priority-p2':    '#febc2e',  // P2 = yellow
        'priority-p3':    '#444444',  // P3 = dark gray
        // Text hierarchy
        'text-primary':   '#e2e2e2',  // primary content
        'text-secondary': '#bbbbb',   // secondary content
        'text-muted':     '#666666',  // labels, metadata
        'text-faint':     '#444444',  // disabled, de-emphasized
        'text-label':     '#555555',  // panel header labels
      }
    },
    borderRadius: {
      'mc-sm':  '4px',   // badges, tags
      'mc-md':  '6px',   // cards, inputs, buttons
      'mc-lg':  '10px',  // window, modal frames
    },
    fontSize: {
      'mc-xs':   ['10px', { lineHeight: '1.4', letterSpacing: '0.1em' }],   // labels
      'mc-sm':   ['11px', { lineHeight: '1.4' }],                            // metadata, hints
      'mc-base': ['12px', { lineHeight: '1.4' }],                            // task text, email subjects
      'mc-body': ['13px', { lineHeight: '1.4' }],                            // meeting titles, body
      'mc-lg':   ['20px', { lineHeight: '1.2' }],                            // inbox count (Teams)
      'mc-xl':   ['32px', { lineHeight: '1',   fontVariantNumeric: 'tabular-nums' }], // inbox count (Outlook)
    }
  }
}
```

### Typography

Reference `~/Projects/Egg/brand/voice.md` for typeface selection. Apply BGC/Egg brand typography to all display elements (panel headers, countdown, unread counts). System fonts acceptable for body/metadata only if consistent with brand voice spec.

Font size scale (see `mc-*` fontSize tokens above). Tabular nums on all numeric data (unread counts, countdown times).

### Panel Layout Constraints

- **Window:** 1200×720px default, resizable 900–1600px
- **Min width behavior:** panels compress equally; minimum 280px per panel at 900px window. Panel header labels may abbreviate at narrow widths (e.g., "D8 MEETING BRIEF" → "MEETING"). No horizontal scroll. No layout collapse.
- **Panel header:** `mc-surface-raised` background, 36px height, left-aligned label in `mc-xs` uppercase monospace, status dot right-aligned
- **Panel dividers:** 1px `mc-border` vertical separators

### Meeting Brief — Visual Hierarchy

**Next meeting (highest priority information in the app):**
- `mc-D8-bg` tinted card background
- 3px left border in `mc-d8`
- Meeting time: `mc-xs` uppercase bold in `mc-d8`
- Meeting title: `mc-body` weight 500 in `mc-text-primary`
- Attendees: `mc-sm` in `mc-d8` at 70% opacity
- Countdown pill: `mc-sm` bold in `mc-stale` (yellow) — "⏱ in 23 min" — always visible, next meeting only

**Later meetings:**
- `mc-surface` background (no tint)
- 2px left border in `mc-border` (dark, recessive)
- 75% opacity on all text
- No countdown

**Countdown display:** Always shown on the next meeting card. Format:
- < 60 min: "in 23 min"
- 1–8 hours: "in 2h 15min"
- > 8 hours: "at 4:00 PM" (switch to absolute time for same-day far-future)

**Empty calendar:** `"Clear calendar today. Unusual. Enjoy it."` — centered, `mc-text-muted`, no icon.

### Notion Tasks — Visual Hierarchy

**Priority encoding:** 6px dot left of task text.
- P1: `mc-priority-p1` (red)
- P2: `mc-priority-p2` (yellow)
- P3: `mc-priority-p3` (dark gray)

No text priority labels. Tasks sorted by priority descending within each column. Max 6 rows visible; scroll for more. Rows are interactive — Tab-navigable with `tabIndex=0`, Enter/Space opens Notion in browser.

**Column headers:**
- D8 column: `mc-d8` text, `mc-D8-border` bottom border
- Egg column: `mc-egg` text, `mc-egg-border` bottom border

### Panel States (all 3 panels)

All states use `PanelState<T>` from `src/renderer/types.ts`.

| State | What User Sees |
|---|---|
| `loading` | Animated skeleton bars (pulse animation, 12px height, `mc-surface-raised` bg). One bar per expected content line. No spinner. |
| `empty` | Panel-specific personality copy (see below). `mc-text-muted` color. No icon. Status dot = `mc-ok` (data loaded, just empty). |
| `error` (network) | Last-known data remains visible. Status dot turns `mc-error` (red). Sub-label under panel name: "Last synced X min ago. Retrying in 2 min." Auto-retry — no user action required. |
| `error` (auth) | Panel shows "Can't authenticate." + "Re-authenticate" button (text button, `mc-d8` color, `mc-sm`). Status dot = `mc-error`. |
| `stale` | Last-known data visible. Yellow stale badge in panel header: "⬤ X min ago" (`mc-stale` dot, `mc-sm`, `mc-D8-bg` background). |
| `not-configured` | Centered: icon (low opacity ◻), panel-specific title, one-line description, CTA button "Set up Notion →" |

**Panel empty copy:**
- Meeting Brief: "Clear calendar today. Unusual. Enjoy it."
- Notion Tasks (D8): "No active D8 tasks."
- Notion Tasks (Egg): "No active Egg tasks."
- Inbox Pulse: "Outlook is clear." (unlikely in practice)

### Inbox Pulse — Visual Hierarchy

**Outlook unread count:** `mc-xl` font (32px tabular-nums) + `mc-sm` "unread" label
**Email subjects:** 3 items, `mc-base` truncated with ellipsis, sender in `mc-xs` uppercase above subject
**Section divider:** 1px `mc-border` between Outlook and Teams blocks
**Teams block:** `mc-lg` count + "chats" label. Sub-label: "Chat.Read · DMs + group only" in `mc-xs` `mc-text-faint`

### Titlebar

- **Normal:** `mc-surface-raised` bg, `mc-text-label` "MISSION CONTROL" centered uppercase `mc-xs`
- **Traffic lights:** left-aligned (native macOS style)
- **Context badges:** right-aligned `[D8]` (blue) and `[EGG]` (green). `mc-xs` bold uppercase.
- **Auth failure:** failing badge bg dims to `mc-error` at 25% opacity, text to `mc-error`. Badge is clickable — triggers re-auth flow.

### Auth Success Moment (first-time only)

After Microsoft OAuth completes and the browser callback fires, Meeting Brief and Inbox Pulse panel status dots flash `mc-ok` (green) for 1 second, then settle to steady green. This one-time signal confirms auth succeeded before data appears. Never shown after subsequent launches.

`app.show() + window.focus()` is called immediately after OAuth callback to bring Mission Control to foreground.

### Notification Click Behavior

`electron.Notification` click handler calls `app.show()` (if window is hidden) then `mainWindow.focus()`. This correctly handles both "window hidden by red-X" and "window behind other apps" states.

### Keyboard Navigation

Full keyboard navigation required for all interactive elements:
- Panel status dots: not focusable (display only)
- Notion task rows: `tabIndex=0`, `role="listitem"`, Enter/Space → open Notion URL in browser
- "Re-authenticate" button: standard button, keyboard-accessible
- "Set up Notion →" CTA: standard button, keyboard-accessible
- ARIA landmarks: each panel uses `role="region"` with `aria-label` matching panel name

Tab order: titlebar (skip) → Meeting Brief content → Notion Tasks D8 column → Notion Tasks Egg column → Inbox Pulse content.

### NotionSetup Window Visual Spec

480×~360px sheet (not full-window). Titlebar: traffic lights + centered "Connect Notion" label in `mc-text-label`.

Body sections:
1. **Branding header:** "MISSION CONTROL" in `mc-egg` xs-bold + "Connect your Notion workspace" in `mc-body` 700 weight + one-line description
2. **Token input field:** Full-width, `mc-base` monospace font, password masking. Field label uppercase `mc-xs`. "Get token ↗" link (Notion integration docs URL) right-aligned in field label row. Hint text below: integration setup instructions.
3. **Actions row:** "Skip for now" (text button, `mc-text-faint`) left-aligned + "Connect Notion →" (filled button, `mc-egg-bg` background) right-aligned

States: idle → validating (button shows "Connecting…", disabled) → error (red error message below input field, button re-enabled) → success (window closes, Notion Tasks panel transitions from `not-configured` to `loading`)

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (via /autoplan) | 19 decisions, scope accepted |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 10 architecture/quality/perf issues, 23 test gaps — all resolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 3/10 → 9/10, 13 decisions made |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

OUTSIDE VOICE (Claude subagent): 9 findings surfaced — 5 genuine gaps applied (D12 dev OAuth, D13 dock behavior, D14 Teams scope fix, D15 first-run window spec, T12 safeStorage recovery), 4 non-actionable or already mitigated.

VERDICT: CEO + ENG + DESIGN CLEARED — ready to implement.

NO UNRESOLVED DECISIONS

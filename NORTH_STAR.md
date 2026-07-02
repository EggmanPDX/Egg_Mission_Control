# Mission Control — North Star

> This is the gold document. It describes the destination, not the current build.
> Cross-check against `VALIDATION.md` (same folder) to see how close the real app is.
> Cross-check against `docs/specs/mission-control.md` for the technical MVP spec this extends.

## The One-Line Goal

One place Gregg opens and never has to leave to know what matters right now —
no separate trip to Notion, Outlook, Gmail, Teams, Google Drive, or a newsletter
app just to figure out today.

---

## The Complete Vision

### 1. Unified Inbox — Outlook + Gmail
- All unread mail, one feed, sorted **high → low priority** automatically
- Each email carries an **AI-drafted response**, always shown before anything is sent
- One click: **Accept & send**, **Edit then send**, or **Skip** — never auto-sent blind
- ✅ Decided (2026-07-02): draft + one-click send, human-reviewed every time. Requires new
  `Mail.Send` Graph scope + a D8-admin-consent round (same process just completed for
  Calendars/Mail/Chat read scopes). No full-auto-send path — see Non-Goals.

### 2. Teams + Presence
- Unread Teams messages (already in MVP scope as "Inbox Pulse")
- **Online/offline status** for key people — new capability, new Graph scope required

### 3. Calendar
- Today's meetings with prep context — this is the existing "D8 Meeting Brief" panel

### 4. Newsletters
- The Rundown + The Code, surfaced in-app instead of on the phone
- Already on the roadmap as Phase 2 in `docs/specs/mission-control.md`

### 5. Job Radar
- New matches surfaced from the Egg Morning Brief Notion DB
- Already on the roadmap as Phase 3

### 6. All-Projects Status Rollup — Full Read/Write Notion Interface
- Not just a task list — every project (D8, BGC, Egg) with a status: **on track / at risk / off track**
- Requires reading project-level Notion pages/properties — a further step beyond the task-level
  read/write already shipped (see below)
- ✅ Decided (2026-07-02): Mission Control becomes a **full read/write interface to Notion** —
  mark tasks done, move tasks between workspaces, delete (archive) tasks, all in-app. Model this
  the same way Gregg already uses Claude Code + Notion MCP: Notion stays the data store, but
  Mission Control (not notion.so) becomes where Gregg actually interacts with it day to day.
- ✅ **Shipped (2026-07-02):** task-level read/write is live — Mark Complete, Move Task
  (D8 ⇄ BGC ⇄ Egg), and Delete (archive), all from the task detail popup. Third workspace
  (BGC Tasks & Projects, `06f9c757-8fab-4db5-a8f3-7f460599ee1e`) added as a visible column
  alongside D8 and Egg. Verified working end-to-end by Gregg, not just build-tested.
- Still open: full task **editing** (title/priority/notes inline) and **creating new tasks**
  from scratch — today's write surface covers status changes, moves, and deletes only.
- Project-level status rollup (the "on track/at risk" summary across all projects) is separate,
  bigger work — needs write methods (`pages.update`, `pages.create`) that now exist in
  `notion.service.ts`, but needs its own data model for project-level (not task-level) status.
  Treat as its own sub-phase with its own review pass before
  building — a bad write to a live task DB is a real failure mode, not just a display bug.

### 7. Learning & Tips Layer
- Observes how Gregg actually works over time
- Surfaces a running signal: *"Here's something we noticed about how you work — here's something to try."*
- Genuinely new territory: a pattern-detection layer over Mission Control's own usage data, not a Graph/Notion API call

### 8. Skill Library Awareness
- Knows what's installed in `~/.claude/skills/`
- Recommends the relevant skill in context (e.g., drafting a LinkedIn post → surfaces `/social-carousel`)

### 9. Workflow & App-Preference Learning
- Learns which tools Gregg actually reaches for, for which kind of work
- Adapts recommendations over time — this is the "ultimate goal" state, the furthest out

---

## Sequencing

Items 1–6 extend the existing Phase 1/2/3 roadmap already locked in `docs/specs/mission-control.md`.
Items 7–9 have no existing spec, no prior art in this codebase, and the highest uncertainty —
they come last, after 1–6 are real and trusted.

---

## Non-Goals (carried forward from the original spec — still true unless explicitly revisited)

- No mobile or web version — desktop only
- No multi-user support
- Notion stays the **data store** — Mission Control becomes the interface Gregg actually uses,
  but Notion is never bypassed or duplicated as a separate source of truth (revised 2026-07-02;
  previously this said Mission Control would stay a read-only "lens" — see Item 6 above)
- No client-facing writes (D8 deliverables, client Notion pages, etc.) — this applies to the
  *client-facing* Notion pages specifically, not Gregg's own task DBs
- No fully-automatic send for any email/chat reply — a human always sees the draft first (Decision #1 below)

---

## Open Decisions

1. ~~Read-only vs. send-capable~~ — **Decided 2026-07-02:** draft + one-click send, human-reviewed
   every time. See Item 1 above.
2. **Presence scope.** Online/offline status needs `Presence.Read`, a separate Graph permission —
   same D8-admin-consent process just completed for Calendars/Mail/Chat. Still open.
3. **Notion project rollup shape.** "All projects, on track/at risk" implies project-level status data
   that may not exist in a clean, query-able form in Notion yet — needs a quick data-model check before
   this is promised as buildable. Still open.

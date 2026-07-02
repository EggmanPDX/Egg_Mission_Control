# Mission Control — Validation Checklist

> Purpose: confirm Mission Control is actually delivering on `NORTH_STAR.md` — not
> "does it compile," but "is it doing the job." Run this whenever something feels
> off, before starting new feature work, or on whatever cadence gets set up under
> "Continuous Validation" below.
>
> Mark each row ✅ / ⚠️ / ❌. Anything ❌ becomes the next thing to fix — before
> new features get added on top.

## 1. Integration Health

| Source | Check | Status |
|---|---|---|
| Outlook (Graph) | Auth token valid; last successful sync < 10 min ago | ✅ 2026-07-02 — real calendar + inbox data confirmed live |
| Gmail | Auth valid (once wired); last successful sync < 10 min ago | not yet wired (Phase 2) |
| Teams (Graph) | `Chat.Read` returning data; no silent 403s | ✅ 2026-07-02 — Inbox Pulse shows real Teams message previews |
| Notion | All three task DBs (D8, BGC, Egg) queryable + writable | ✅ 2026-07-02 — read confirmed for all 3; write (complete/move/delete) confirmed by Gregg |
| Job Radar (Notion, no dedicated DB) | Parses live from the Morning Briefing page's block content | ✅ 2026-07-02 — real data confirmed in packaged app after rebuild; parser skips malformed entries individually rather than failing the whole panel |
| Google Drive | (future) auth valid; no stale-token errors | not yet wired (Phase 2) |

**Fail condition:** any source shows an error/stale badge in-app for longer than a
configured threshold without self-recovering.

## 2. Timeliness

- [ ] Graph poll fires every 5 min as configured — verified via logs/timestamps, not assumed
- [ ] Notion poll fires every 10 min as configured
- [ ] Meeting notification fires at exactly T-15, not late, not duplicated after sleep/wake
- [ ] No panel shows data older than 2× its configured poll interval without a "stale" badge

## 3. Coverage — Nothing Important Hidden

- [ ] Every P1 task (D8 + Egg) appears in the app, not just "somewhere in Notion"
- [ ] Every unread email from a VIP sender surfaces in the priority-sorted list, not buried
- [ ] No newsletter issue is missed for more than 1 day after publish
- [ ] No project silently falls off the status rollup once that panel exists
- Note (2026-07-02): Job Radar intentionally shows only the top 5 roles (`TOP_N` config in
  Egg_Morning_Brief), not every match found — a deliberate cut for signal-over-noise, not a
  coverage gap. Don't flag this as a ❌ later without checking the config first.

## 4. Signal Quality (subjective — needs Gregg's read, not automatable)

- [ ] Priority sort actually matches what Gregg would triage first, most days
- [ ] AI-drafted replies (once built) are directionally correct — track accept / edit / reject rate,
      target >80% accept-or-light-edit before trusting one-click send

## 5. Learning Loop

- [ ] At least one genuinely useful "here's a pattern we noticed" tip per week — not generic filler
- [ ] Tips reference real observed behavior (skill usage, task timing), not guesses

## 6. Skill & Workflow Awareness

- [ ] Skill recommendations match what's actually installed in `~/.claude/skills/` — no stale/hallucinated names
- [ ] App-preference learning correctly identifies tools used ≥3 times for a given task type

## 7. Non-Breakage / Resilience

- [ ] Killing network mid-poll doesn't crash the app — shows stale badge instead
- [ ] Corrupt config recovers to defaults, doesn't crash on launch
- [ ] App survives sleep/wake for a full day without duplicate notifications or memory leaks
- [ ] No panel failure cascades to another panel (each panel fails independently, per spec)

---

## Continuous Validation

**Decided (2026-07-02): phase-gated, not time-scheduled.** This checklist runs at the
boundary of each build phase, not on a cron. No background/unattended automation.

**Mechanism:** Before starting a new phase, and again right after finishing it, run
through the sections above relevant to what changed. A phase doesn't count as "done"
until its own checklist rows are ✅ (or explicitly accepted as ⚠️ with a reason).

**Phase boundaries this applies to** (see `NORTH_STAR.md` → Sequencing, and
`docs/specs/mission-control.md` → Phase 1/2/3):
- Phase 1 (existing MVP: Meeting Brief, Inbox Pulse, Notion Tasks) — ✅ **validated 2026-07-02**,
  real data confirmed in all three panels
- Ad hoc phase: Notion task read/write (Mark Complete, Move, Delete) + third BGC workspace
  column — ✅ **validated 2026-07-02**, all three actions confirmed working by Gregg
- Phase 2 (Gmail, newsletters, Job Radar) — Job Radar slice ✅ **validated 2026-07-02**
  (see Job Radar row in Integration Health above); Gmail and newsletter-in-app still not wired
- Ad hoc phase: left-nav + single-canvas redesign (all 6 pages) — ✅ **validated 2026-07-02**,
  every panel and interaction (nav switching, task complete/move/delete, job bookmarking,
  detail panels, Join Meeting link) confirmed working in the packaged, rebuilt, re-signed app
- Phase 3 (all-projects rollup, learning layer, skill awareness, workflow learning)
- Ad hoc phase: AI-drafted email replies + one-click send (Decision #1 in `NORTH_STAR.md`)

**Cadence:** tied to build milestones, not calendar time — no fixed interval.
**Last run:** 2026-07-02 — Job Radar + left-nav redesign phase validated (see rows/notes above
in sections 1 and 3). Known open items, unchanged from the prior run: sections 4 (Signal
Quality — needs Gregg's subjective read on Job Radar fit-score accuracy specifically now, too)
and 7 (Non-Breakage sleep/wake resilience) are still unverified — haven't run the app across a
full sleep/wake cycle or multi-day uptime yet. Also new from this phase: Timeliness (section 2)
not re-verified against logs for the Job Radar poll specifically — code matches the same cycle
as the other Notion sources, but wasn't watched live across a real interval.

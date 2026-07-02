import { PanelHeader } from '../components/PanelHeader'
import { SkeletonBars } from '../components/SkeletonBars'
import type { PanelState, CalendarEvent } from '../types'

function formatCountdown(startIso: string): string {
  const now = Date.now()
  const start = new Date(startIso).getTime()
  const diff = start - now
  if (diff <= 0) return 'now'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `in ${mins} min`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  if (hours < 8) return `in ${hours}h${rem > 0 ? ` ${rem}min` : ''}`
  return `at ${new Date(startIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

interface MeetingBriefProps {
  panel: PanelState<CalendarEvent[]>
  flashAuthDot?: boolean
  onSelect: (event: CalendarEvent) => void
}

export function MeetingBrief({ panel, flashAuthDot, onSelect }: MeetingBriefProps) {
  const { status } = panel

  const dotState = status.state === 'error' ? 'error'
    : status.state === 'stale' ? 'stale'
    : status.state === 'loading' ? 'loading'
    : status.state === 'not-configured' ? 'not-configured'
    : 'ok'

  const staleLabel = status.state === 'stale'
    ? `${Math.round((Date.now() - status.lastUpdated.getTime()) / 60000)} min ago`
    : undefined

  return (
    <section
      role="region"
      aria-label="D8 Meeting Brief"
      className="flex flex-col h-full bg-mc-canvas"
    >
      <PanelHeader
        label="MEETING BRIEF"
        shortLabel="MEETING"
        dotState={dotState}
        staleLabel={staleLabel}
        flashDot={flashAuthDot}
      />

      <div className="flex-1 overflow-y-auto flex flex-col">
        {status.state === 'loading' && <SkeletonBars count={4} />}

        {status.state === 'not-configured' && (
          <div className="flex items-center justify-center h-full text-mc-ink-muted text-mc-sm">
            Connect Microsoft to see meetings.
          </div>
        )}

        {(status.state === 'error' && status.message === 'auth') && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <span className="text-mc-sm text-mc-ink-muted">Can&apos;t authenticate.</span>
            <button
              onClick={() => window.api.triggerReauth()}
              className="text-mc-sm text-mc-d8 hover:underline focus:outline-none focus:ring-1 focus:ring-mc-d8 rounded-mc-sm px-2 py-1"
            >
              Re-authenticate
            </button>
          </div>
        )}

        {(status.state === 'error' && status.message !== 'auth') && (
          <div className="p-3 text-mc-sm text-mc-ink-muted">
            {panel.data?.length ? (
              <EventList events={panel.data} dimmed onSelect={onSelect} />
            ) : (
              <span>Failed to load. Retrying…</span>
            )}
          </div>
        )}

        {(status.state === 'ok' || status.state === 'stale') && panel.data && (
          panel.data.length === 0
            ? <EmptyCalendar />
            : <EventList events={panel.data} onSelect={onSelect} />
        )}

        {status.state === 'empty' && <EmptyCalendar />}
      </div>
    </section>
  )
}

function EmptyCalendar() {
  return (
    <div className="flex items-center justify-center h-full text-mc-ink-muted text-mc-sm text-center px-4">
      Clear calendar today. Unusual. Enjoy it.
    </div>
  )
}

function EventList({ events, dimmed, onSelect }: { events: CalendarEvent[]; dimmed?: boolean; onSelect: (e: CalendarEvent) => void }) {
  const now = Date.now()
  const nextIdx = events.findIndex(e => new Date(e.end).getTime() > now)
  const remaining = events.filter(e => new Date(e.end).getTime() > now).length

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-1 p-2 flex-1">
        {events.map((event, i) => {
          const isNext = i === nextIdx
          const isPast = new Date(event.end).getTime() <= now
          return (
            <button
              key={event.id}
              onClick={() => onSelect(event)}
              className={`w-full text-left rounded-mc-md p-2.5 border-l-[3px] transition-opacity focus:outline-none
                ${isNext
                  ? 'bg-mc-pill-blue-bg border-mc-d8 hover:brightness-95'
                  : 'bg-transparent border-mc-canvas-border hover:bg-mc-canvas-alt'}
                ${isPast ? 'opacity-50' : ''}
                ${dimmed ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`text-mc-xs uppercase font-bold font-mono ${isNext ? 'text-mc-d8' : 'text-mc-ink-muted'} ${isPast ? 'line-through' : ''}`}>
                  {new Date(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
                {isNext && (
                  <span className="text-mc-sm font-bold text-mc-d8 bg-mc-pill-blue-bg px-1.5 py-0.5 rounded-mc-sm">
                    ⏱ {formatCountdown(event.start)}
                  </span>
                )}
                {isPast && <span className="text-mc-ok text-mc-sm">✓</span>}
              </div>
              <div className={`text-mc-body font-medium text-mc-ink mt-0.5 ${isPast ? 'line-through text-mc-ink-faint' : ''}`}>
                {event.subject}
              </div>
              {event.attendees.length > 0 && (
                <div className="text-mc-sm text-mc-d8 opacity-70 mt-0.5">
                  {event.attendees.slice(0, 4).join(', ')}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div className="px-3 py-2 border-t border-mc-canvas-border bg-mc-canvas-alt text-mc-xs text-mc-ink-muted uppercase tracking-widest">
        {remaining} event{remaining === 1 ? '' : 's'} remaining today
      </div>
    </div>
  )
}

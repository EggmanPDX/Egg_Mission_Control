import { PanelHeader } from '../components/PanelHeader'
import { SkeletonBars } from '../components/SkeletonBars'
import type { PanelState, NewsletterEntry } from '../types'

function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null
  const parsed = new Date(iso)
  if (isNaN(parsed.getTime())) return iso
  const mins = Math.round((Date.now() - parsed.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

interface NewsletterPanelProps {
  panel: PanelState<NewsletterEntry[]>
  updatedAt: string | null
}

export function NewsletterPanel({ panel, updatedAt }: NewsletterPanelProps) {
  const { status } = panel

  const dotState = status.state === 'error' ? 'error'
    : status.state === 'stale' ? 'stale'
    : status.state === 'loading' ? 'loading'
    : status.state === 'not-configured' ? 'not-configured'
    : 'ok'

  const updatedLabel = formatUpdatedAt(updatedAt)

  return (
    <section role="region" aria-label="Newsletters" className="flex flex-col h-full bg-mc-canvas">
      <PanelHeader label="NEWSLETTERS" shortLabel="NEWS" dotState={dotState} />

      {updatedLabel && (
        <div className="px-4 py-2 border-b border-mc-canvas-border bg-mc-canvas-alt text-mc-xs text-mc-ink-muted uppercase tracking-widest">
          Last updated: {updatedLabel}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {status.state === 'loading' && <SkeletonBars count={3} />}

        {status.state === 'not-configured' && (
          <div className="flex items-center justify-center h-full text-mc-ink-muted text-mc-sm">
            Connect Notion to see newsletters.
          </div>
        )}

        {(status.state === 'ok' || status.state === 'stale' || status.state === 'empty') && (
          !panel.data || panel.data.length === 0
            ? (
              <div className="flex items-center justify-center h-full text-mc-ink-muted text-mc-sm">
                No newsletter digest available yet.
              </div>
            )
            : panel.data.map(newsletter => (
                <div key={newsletter.name} className="rounded-mc-md border border-mc-canvas-border p-3.5">
                  <div className="text-mc-body font-semibold text-mc-ink">{newsletter.name}</div>

                  {!newsletter.found && (
                    <div className="text-mc-sm text-mc-ink-faint mt-1">No issue found in last 24h.</div>
                  )}

                  {newsletter.found && (
                    <>
                      {(newsletter.subject || newsletter.sender) && (
                        <div className="text-mc-sm text-mc-ink-muted mt-1">
                          {newsletter.subject}
                          {newsletter.subject && newsletter.sender && '  ·  '}
                          {newsletter.sender}
                        </div>
                      )}
                      {newsletter.summary && (
                        <ul className="mt-2 flex flex-col gap-1">
                          {newsletter.summary.split('\n').filter(Boolean).map((line, i) => (
                            <li key={i} className="text-mc-sm text-mc-ink leading-relaxed">
                              {line.replace(/^•\s*/, '')}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              ))
        )}
      </div>
    </section>
  )
}

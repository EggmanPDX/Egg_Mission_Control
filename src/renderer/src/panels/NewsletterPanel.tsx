import { PanelHeader } from '../components/PanelHeader'
import { SkeletonBars } from '../components/SkeletonBars'
import type { PanelState, NewsletterEntry, SelectedItem } from '../types'

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
  selectedItem: SelectedItem | null
  onSelect: (item: SelectedItem) => void
}

export function NewsletterPanel({ panel, updatedAt, selectedItem, onSelect }: NewsletterPanelProps) {
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
            : panel.data.map(newsletter => {
                const isSelected = selectedItem?.type === 'newsletter' && selectedItem.data.name === newsletter.name
                const stories = newsletter.summary?.split('\n').filter(Boolean) ?? []
                return (
                  <button
                    key={newsletter.name}
                    onClick={() => newsletter.found && onSelect({ type: 'newsletter', data: newsletter })}
                    disabled={!newsletter.found}
                    className={`w-full text-left rounded-mc-md border p-3.5 focus:outline-none
                      ${isSelected ? 'border-mc-d8 bg-mc-pill-blue-bg' : 'border-mc-canvas-border bg-mc-canvas hover:bg-mc-canvas-alt'}
                      ${!newsletter.found ? 'cursor-default' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-mc-body font-semibold text-mc-ink">{newsletter.name}</div>
                      {newsletter.found && <span className="text-mc-ink-faint flex-shrink-0">›</span>}
                    </div>

                    {!newsletter.found && (
                      <div className="text-mc-sm text-mc-ink-faint mt-1">No issue found in last 24h.</div>
                    )}

                    {newsletter.found && (
                      <>
                        {(newsletter.subject || newsletter.sender) && (
                          <div className="text-mc-sm text-mc-ink-muted mt-1 truncate">
                            {newsletter.subject}
                            {newsletter.subject && newsletter.sender && '  ·  '}
                            {newsletter.sender}
                          </div>
                        )}
                        {(newsletter.articles ?? []).length > 0 && (
                          <div className="flex flex-col gap-1 mt-2">
                            {(newsletter.articles ?? []).map((article, i) => {
                              const isStorySelected =
                                selectedItem?.type === 'newsletter-story' &&
                                selectedItem.data.newsletter.name === newsletter.name &&
                                selectedItem.data.article.headline === article.headline
                              return (
                                <button
                                  key={i}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onSelect({ type: 'newsletter-story', data: { newsletter, article } })
                                  }}
                                  className={`w-full text-left text-mc-sm font-semibold leading-snug px-2 py-1 rounded-mc-sm focus:outline-none
                                    ${isStorySelected ? 'text-mc-d8 bg-mc-pill-blue-bg' : 'text-mc-ink hover:text-mc-d8 hover:bg-mc-canvas-alt'}`}
                                >
                                  {article.headline}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </button>
                )
              })
        )}
      </div>
    </section>
  )
}

import { PanelHeader } from '../components/PanelHeader'
import { SkeletonBars } from '../components/SkeletonBars'
import type { PanelState, JobRadarEntry, SelectedItem } from '../types'

const SAVED_JOBS_KEY = 'mc:saved-jobs'
function loadSavedJobs(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SAVED_JOBS_KEY) ?? '[]')) } catch { return new Set() }
}

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

interface JobRadarPanelProps {
  panel: PanelState<JobRadarEntry[]>
  updatedAt: string | null
  selectedItem: SelectedItem | null
  onSelect: (item: SelectedItem) => void
}

export function JobRadarPanel({ panel, updatedAt, selectedItem, onSelect }: JobRadarPanelProps) {
  const { status } = panel
  const savedJobs = loadSavedJobs()

  const dotState = status.state === 'error' ? 'error'
    : status.state === 'stale' ? 'stale'
    : status.state === 'loading' ? 'loading'
    : status.state === 'not-configured' ? 'not-configured'
    : 'ok'

  const updatedLabel = formatUpdatedAt(updatedAt)

  return (
    <section role="region" aria-label="Job Radar" className="flex flex-col h-full bg-mc-canvas">
      <PanelHeader label="JOB RADAR" shortLabel="RADAR" dotState={dotState} />

      {updatedLabel && (
        <div className="px-4 py-2 border-b border-mc-canvas-border bg-mc-canvas-alt text-mc-xs text-mc-ink-muted uppercase tracking-widest">
          Last updated: {updatedLabel}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {status.state === 'loading' && <SkeletonBars count={3} />}

        {status.state === 'not-configured' && (
          <div className="flex items-center justify-center h-full text-mc-ink-muted text-mc-sm">
            Connect Notion to see Job Radar.
          </div>
        )}

        {(status.state === 'ok' || status.state === 'stale') && panel.data && (
          panel.data.length === 0
            ? (
              <div className="flex items-center justify-center h-full text-mc-ink-muted text-mc-sm">
                No strong matches today.
              </div>
            )
            : panel.data.map(job => {
                const isSelected = selectedItem?.type === 'job' && selectedItem.data.id === job.id
                const isSaved = savedJobs.has(job.id)
                return (
                  <button
                    key={job.id}
                    onClick={() => onSelect({ type: 'job', data: job })}
                    className={`w-full text-left rounded-mc-md border p-3.5 focus:outline-none
                      ${isSelected ? 'border-mc-d8 bg-mc-pill-blue-bg' : 'border-mc-canvas-border bg-mc-canvas hover:bg-mc-canvas-alt'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isSaved && <span className="text-mc-d8 text-mc-sm flex-shrink-0">★</span>}
                          <div className="text-mc-body font-semibold text-mc-ink truncate">{job.title}</div>
                        </div>
                        <div className="text-mc-sm text-mc-ink-muted">{job.company}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-mc-lg font-bold text-mc-ink font-tabular">{job.score}</div>
                        <div className="text-mc-xs text-mc-ink-faint uppercase tracking-widest -mt-1">Fit Score</div>
                      </div>
                    </div>

                    <div className="w-full h-1 rounded-full bg-mc-canvas-alt overflow-hidden mt-2">
                      <div className="h-full bg-mc-d8" style={{ width: `${job.score}%` }} />
                    </div>

                    <p className="text-mc-sm text-mc-ink-muted italic mt-2 leading-relaxed">{job.reason}</p>

                    <div className="flex items-center justify-between mt-2.5">
                      <div className="text-mc-xs text-mc-ink-faint truncate">
                        {job.location} · {job.postedAgo} · {job.applicants}
                      </div>
                      <a
                        href={job.applyUrl}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(job.applyUrl, '_blank') }}
                        className="flex-shrink-0 text-mc-xs font-bold uppercase tracking-widest px-2 py-1 rounded-mc-sm border border-mc-d8 text-mc-d8 hover:bg-mc-pill-blue-bg"
                      >
                        Apply ↗
                      </a>
                    </div>
                  </button>
                )
              })
        )}

        {status.state === 'empty' && (
          <div className="flex items-center justify-center h-full text-mc-ink-muted text-mc-sm">
            No strong matches today.
          </div>
        )}
      </div>
    </section>
  )
}

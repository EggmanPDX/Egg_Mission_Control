import { PanelHeader } from '../components/PanelHeader'
import { SkeletonBars } from '../components/SkeletonBars'
import type { PanelState, NotionTask } from '../types'

interface NotionTasksProps {
  d8Panel: PanelState<NotionTask[]>
  eggPanel: PanelState<NotionTask[]>
  onSetupNotion: () => void
}

export function NotionTasks({ d8Panel, eggPanel, onSetupNotion }: NotionTasksProps) {
  const notConfigured = d8Panel.status.state === 'not-configured'
  const loading = d8Panel.status.state === 'loading'
  const hasError = d8Panel.status.state === 'error'
  const isStale = d8Panel.status.state === 'stale'

  const dotState = hasError ? 'error'
    : isStale ? 'stale'
    : loading ? 'loading'
    : notConfigured ? 'not-configured'
    : 'ok'

  return (
    <section
      role="region"
      aria-label="Notion Tasks"
      className="flex flex-col h-full border-r border-mc-border bg-mc-surface"
    >
      <PanelHeader
        label="NOTION TASKS"
        shortLabel="TASKS"
        dotState={dotState}
      />

      {notConfigured ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
          <span className="text-mc-text-faint text-4xl opacity-30">◻</span>
          <span className="text-mc-body font-semibold text-mc-text-primary">Connect Notion</span>
          <span className="text-mc-sm text-mc-text-muted">See your D8 and Egg tasks side by side.</span>
          <button
            onClick={onSetupNotion}
            className="mt-1 text-mc-sm bg-mc-egg-bg text-mc-egg border border-mc-egg-border rounded-mc-md px-3 py-1.5 hover:brightness-110 focus:outline-none focus:ring-1 focus:ring-mc-egg"
          >
            Set up Notion →
          </button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <TaskColumn
            label="D8"
            labelColor="text-mc-d8"
            borderColor="border-mc-D8-border"
            panel={d8Panel}
            emptyText="No active D8 tasks."
          />
          <div className="w-px bg-mc-border flex-shrink-0" />
          <TaskColumn
            label="EGG"
            labelColor="text-mc-egg"
            borderColor="border-mc-egg-border"
            panel={eggPanel}
            emptyText="No active Egg tasks."
          />
        </div>
      )}
    </section>
  )
}

interface TaskColumnProps {
  label: string
  labelColor: string
  borderColor: string
  panel: PanelState<NotionTask[]>
  emptyText: string
}

function TaskColumn({ label, labelColor, borderColor, panel, emptyText }: TaskColumnProps) {
  const priorityDot: Record<string, string> = {
    P1: 'bg-mc-priority-p1',
    P2: 'bg-mc-priority-p2',
    P3: 'bg-mc-priority-p3',
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className={`px-3 py-1.5 border-b ${borderColor}`}>
        <span className={`text-mc-xs uppercase font-bold ${labelColor}`}>{label}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {panel.status.state === 'loading' && <SkeletonBars count={3} />}
        {(panel.status.state === 'ok' || panel.status.state === 'stale') && (
          panel.data?.length === 0
            ? <div className="p-3 text-mc-sm text-mc-text-muted">{emptyText}</div>
            : (panel.data ?? []).slice(0, 12).map(task => (
                <button
                  key={task.id}
                  tabIndex={0}
                  role="listitem"
                  onClick={() => window.open(task.url, '_blank')}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && window.open(task.url, '_blank')}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-mc-surface-raised focus:outline-none focus:bg-mc-surface-raised border-b border-mc-border last:border-0"
                >
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot[task.priority ?? 'P3'] ?? 'bg-mc-priority-p3'}`} />
                  <span className="text-mc-base text-mc-text-primary truncate">{task.title}</span>
                </button>
              ))
        )}
      </div>
    </div>
  )
}

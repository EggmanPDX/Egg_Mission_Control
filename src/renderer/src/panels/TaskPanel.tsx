import { useState } from 'react'
import { PanelHeader } from '../components/PanelHeader'
import { SkeletonBars } from '../components/SkeletonBars'
import type { PanelState, NotionTask, SelectedItem, TaskWorkspace } from '../types'

const NOTES_KEY = 'mc:task-notes'
function loadNotes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}') } catch { return {} }
}

const WORKSPACE_STYLE: Record<TaskWorkspace, { text: string; pillBg: string }> = {
  D8: { text: 'text-mc-d8', pillBg: 'bg-mc-pill-blue-bg' },
  BGC: { text: 'text-mc-bgc', pillBg: 'bg-[#fdf1dc]' },
  EGG: { text: 'text-mc-egg', pillBg: 'bg-[#e9f7e9]' },
}

const PRIORITY_DOT: Record<string, string> = {
  P1: 'bg-mc-priority-p1',
  P2: 'bg-mc-priority-p2',
  P3: 'bg-mc-ink-faint',
}

interface TaskPanelProps {
  workspace: TaskWorkspace
  label: string
  panel: PanelState<NotionTask[]>
  selectedItem: SelectedItem | null
  onSelect: (item: SelectedItem) => void
  onSetupNotion: () => void
  onTaskMutated: () => void
}

export function TaskPanel({ workspace, label, panel, selectedItem, onSelect, onSetupNotion, onTaskMutated }: TaskPanelProps) {
  const [completingId, setCompletingId] = useState<string | null>(null)
  const notConfigured = panel.status.state === 'not-configured'
  const loading = panel.status.state === 'loading'
  const hasError = panel.status.state === 'error'
  const isStale = panel.status.state === 'stale'
  const style = WORKSPACE_STYLE[workspace]
  const notes = loadNotes()

  const dotState = hasError ? 'error'
    : isStale ? 'stale'
    : loading ? 'loading'
    : notConfigured ? 'not-configured'
    : 'ok'

  async function handleQuickComplete(e: React.MouseEvent, taskId: string) {
    e.stopPropagation()
    setCompletingId(taskId)
    const result = await window.api.completeTask(taskId, workspace)
    setCompletingId(null)
    if (result.ok) onTaskMutated()
  }

  return (
    <section role="region" aria-label={`${label} Tasks`} className="flex flex-col h-full bg-mc-canvas">
      <PanelHeader label={`${label.toUpperCase()} TASKS`} shortLabel={label.toUpperCase()} dotState={dotState} />

      {notConfigured ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
          <span className="text-mc-ink-faint text-4xl opacity-30">◻</span>
          <span className="text-mc-body font-semibold text-mc-ink">Connect Notion</span>
          <span className="text-mc-sm text-mc-ink-muted">See your {label} tasks here.</span>
          <button
            onClick={onSetupNotion}
            className="mt-1 text-mc-sm bg-mc-pill-blue-bg text-mc-d8 rounded-mc-md px-3 py-1.5 hover:brightness-95 focus:outline-none focus:ring-1 focus:ring-mc-d8"
          >
            Set up Notion →
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-mc-canvas-border bg-mc-canvas-alt">
            <span className={`text-mc-sm font-bold uppercase tracking-wide ${style.text}`}>{label} Tasks</span>
            {(panel.status.state === 'ok' || panel.status.state === 'stale') && panel.data && (
              <span className={`text-mc-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-mc-sm ${style.pillBg} ${style.text}`}>
                {panel.data.length} Active
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && <SkeletonBars count={5} />}

            {(panel.status.state === 'ok' || panel.status.state === 'stale') && (
              panel.data?.length === 0
                ? <div className="p-4 text-mc-sm text-mc-ink-muted">No active {label} tasks.</div>
                : (panel.data ?? []).map(task => {
                    const isSelected = selectedItem?.type === 'task' && selectedItem.data.id === task.id
                    const hasNote = !!notes[`task:${task.id}`]
                    return (
                      <div
                        key={task.id}
                        onClick={() => onSelect({ type: 'task', data: task, workspace })}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer border-b border-mc-canvas-border
                          ${isSelected ? 'bg-mc-pill-blue-bg' : 'hover:bg-mc-canvas-alt'}`}
                      >
                        <button
                          onClick={(e) => handleQuickComplete(e, task.id)}
                          disabled={completingId === task.id}
                          aria-label="Mark complete"
                          title="Mark complete"
                          className="flex-shrink-0 w-4 h-4 rounded-mc-sm border border-mc-canvas-border hover:border-mc-d8 hover:bg-mc-pill-blue-bg focus:outline-none disabled:opacity-40"
                        />
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority ?? 'P3']}`} />
                        <span className="flex-1 text-mc-base text-mc-ink truncate">{task.title}</span>
                        {hasNote && (
                          <span className="w-1.5 h-1.5 rounded-full bg-mc-d8 flex-shrink-0" title="Has notes" />
                        )}
                        <span className="text-mc-ink-faint flex-shrink-0">›</span>
                      </div>
                    )
                  })
            )}
          </div>
        </>
      )}
    </section>
  )
}

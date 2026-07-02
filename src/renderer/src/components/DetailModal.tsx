import { useEffect, useRef, useState } from 'react'
import type { SelectedItem, TaskWorkspace } from '../types'

const ALL_WORKSPACES: TaskWorkspace[] = ['D8', 'BGC', 'EGG']
const WORKSPACE_COLOR: Record<TaskWorkspace, string> = {
  D8: 'text-mc-d8 border-mc-D8-border bg-mc-D8-bg',
  BGC: 'text-mc-bgc border-mc-bgc-border bg-mc-bgc-bg',
  EGG: 'text-mc-egg border-mc-egg-border bg-mc-egg-bg',
}

const NOTES_KEY = 'mc:task-notes'

function loadNotes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}') } catch { return {} }
}
function saveNote(id: string, text: string) {
  const all = loadNotes()
  if (text.trim()) all[id] = text; else delete all[id]
  localStorage.setItem(NOTES_KEY, JSON.stringify(all))
}

function itemKey(item: SelectedItem): string {
  if (item.type === 'calendar') return `cal:${item.data.id}`
  if (item.type === 'task') return `task:${item.data.id}`
  if (item.type === 'chat') return `chat:${item.data.chatId}`
  return `inbox:${item.data.from}:${item.data.subject}`
}

function itemTitle(item: SelectedItem): string {
  if (item.type === 'calendar') return item.data.subject
  if (item.type === 'task') return item.data.title
  if (item.type === 'chat') return item.data.from
  return item.data.subject
}

function itemLink(item: SelectedItem): string | null {
  if (item.type === 'calendar') return item.data.webLink ?? null
  if (item.type === 'task') return item.data.url ?? null
  if (item.type === 'chat') return item.data.webUrl ?? null
  return null
}

function itemLinkLabel(item: SelectedItem): string {
  if (item.type === 'calendar') return 'Open in Outlook'
  if (item.type === 'task') return 'Open in Notion'
  if (item.type === 'chat') return 'Open in Teams'
  return 'Open'
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}
function formatDuration(startIso: string, endIso: string) {
  const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
function formatCountdown(startIso: string) {
  const diff = new Date(startIso).getTime() - Date.now()
  if (diff <= 0) return 'in progress'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `in ${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return `in ${h}h${m ? ` ${m}m` : ''}`
}
function formatRelative(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return formatDate(iso)
}

interface Props {
  item: SelectedItem
  onClose: () => void
  onTaskMutated: () => void
}

export function DetailModal({ item, onClose, onTaskMutated }: Props) {
  const key = itemKey(item)
  const [note, setNote] = useState(() => loadNotes()[key] ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const link = itemLink(item)
  const isRealLink = link && link !== '#'

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleComplete() {
    if (item.type !== 'task') return
    setPendingAction('complete')
    setActionError(null)
    const result = await window.api.completeTask(item.data.id, item.workspace)
    setPendingAction(null)
    if (result.ok) {
      onTaskMutated()
      onClose()
    } else {
      setActionError(result.error ?? 'Failed to mark complete')
    }
  }

  async function handleDelete() {
    if (item.type !== 'task') return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setPendingAction('delete')
    setActionError(null)
    const result = await window.api.archiveTask(item.data.id)
    setPendingAction(null)
    if (result.ok) {
      onTaskMutated()
      onClose()
    } else {
      setActionError(result.error ?? 'Failed to delete')
    }
  }

  async function handleMove(to: TaskWorkspace) {
    if (item.type !== 'task') return
    setPendingAction(`move:${to}`)
    setActionError(null)
    const result = await window.api.moveTask(item.data.id, item.workspace, to)
    setPendingAction(null)
    if (result.ok) {
      onTaskMutated()
      onClose()
    } else {
      setActionError(result.error ?? `Failed to move to ${to}`)
    }
  }

  useEffect(() => {
    textareaRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleNoteChange(text: string) {
    setNote(text)
    saveNote(key, text)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />

      <div
        className="relative z-10 w-full max-w-md mx-4 bg-mc-surface border border-mc-border rounded-mc-lg shadow-2xl flex flex-col max-h-[82vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-mc-border flex-shrink-0">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <TypeBadge item={item} />
            <div className="text-mc-body font-semibold text-mc-text-primary leading-snug pr-2">
              {itemTitle(item)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {isRealLink && (
              <button
                onClick={() => window.open(link!, '_blank')}
                className="text-mc-xs font-bold uppercase tracking-widest px-2 py-1 rounded-mc-sm border focus:outline-none
                  text-mc-d8 border-mc-D8-border bg-mc-D8-bg hover:brightness-110"
              >
                {itemLinkLabel(item)} ↗
              </button>
            )}
            <button
              onClick={onClose}
              className="text-mc-text-faint hover:text-mc-text-muted focus:outline-none text-xl leading-none pb-0.5"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          <ItemDetails item={item} />

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-mc-xs uppercase tracking-widest text-mc-text-muted font-bold">
              Status Notes
            </label>
            <textarea
              ref={textareaRef}
              value={note}
              onChange={e => handleNoteChange(e.target.value)}
              placeholder="Add context, blockers, next steps…"
              rows={4}
              className="w-full bg-mc-surface-raised border border-mc-border-subtle rounded-mc-md px-3 py-2 text-mc-sm text-mc-text-primary placeholder-mc-text-faint resize-none focus:outline-none focus:ring-1 focus:ring-mc-egg"
            />
          </div>
        </div>

        {/* Task actions */}
        {item.type === 'task' && (
          <div className="flex-shrink-0 border-t border-mc-border px-4 py-3 flex flex-col gap-2">
            {actionError && (
              <div className="text-mc-sm text-mc-error">{actionError}</div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleComplete}
                disabled={pendingAction !== null}
                className="text-mc-sm font-medium px-2.5 py-1 rounded-mc-sm border text-mc-ok border-mc-ok border-opacity-30 bg-mc-ok bg-opacity-10 hover:bg-opacity-20 focus:outline-none disabled:opacity-40"
              >
                {pendingAction === 'complete' ? 'Completing…' : '✓ Mark complete'}
              </button>

              {ALL_WORKSPACES.filter(ws => ws !== item.workspace).map(ws => (
                <button
                  key={ws}
                  onClick={() => handleMove(ws)}
                  disabled={pendingAction !== null}
                  className={`text-mc-sm font-medium px-2.5 py-1 rounded-mc-sm border hover:brightness-110 focus:outline-none disabled:opacity-40 ${WORKSPACE_COLOR[ws]}`}
                >
                  {pendingAction === `move:${ws}` ? 'Moving…' : `→ Move to ${ws}`}
                </button>
              ))}

              <button
                onClick={handleDelete}
                disabled={pendingAction !== null}
                className={`text-mc-sm font-medium px-2.5 py-1 rounded-mc-sm border focus:outline-none disabled:opacity-40 ml-auto
                  ${confirmingDelete
                    ? 'text-white bg-mc-error border-mc-error hover:brightness-110'
                    : 'text-mc-error border-mc-error border-opacity-30 bg-mc-error bg-opacity-10 hover:bg-opacity-20'}`}
              >
                {pendingAction === 'delete' ? 'Deleting…' : confirmingDelete ? 'Confirm delete?' : '🗑 Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TypeBadge({ item }: { item: SelectedItem }) {
  if (item.type === 'calendar') {
    return <span className="text-mc-xs uppercase font-bold tracking-widest text-mc-d8">Meeting</span>
  }
  if (item.type === 'task') {
    const priorityColor = item.data.priority === 'P1' ? 'text-mc-priority-p1'
      : item.data.priority === 'P2' ? 'text-mc-priority-p2' : 'text-mc-priority-p3'
    return (
      <div className="flex items-center gap-2">
        <span className={`text-mc-xs uppercase font-bold tracking-widest ${item.workspace === 'D8' ? 'text-mc-d8' : 'text-mc-egg'}`}>
          {item.workspace} Task
        </span>
        {item.data.priority && (
          <span className={`text-mc-xs font-bold ${priorityColor}`}>{item.data.priority}</span>
        )}
      </div>
    )
  }
  if (item.type === 'chat') {
    return <span className="text-mc-xs uppercase font-bold tracking-widest text-mc-d8">Teams Chat</span>
  }
  return <span className="text-mc-xs uppercase font-bold tracking-widest text-mc-d8">Email</span>
}

function ItemDetails({ item }: { item: SelectedItem }) {
  if (item.type === 'calendar') {
    const { data } = item
    return (
      <div className="flex flex-col gap-2.5">
        <Row label="When">
          <span>{formatDate(data.start)} · {formatTime(data.start)} – {formatTime(data.end)}</span>
          <span className="text-mc-text-muted ml-1.5">({formatDuration(data.start, data.end)})</span>
        </Row>
        <Row label="Starts"><span className="text-mc-egg font-medium">{formatCountdown(data.start)}</span></Row>
        {data.attendees.length > 0 && (
          <Row label="With">{data.attendees.join(', ')}</Row>
        )}
        {data.body && (
          <div className="flex flex-col gap-1 mt-1">
            <span className="text-mc-xs uppercase tracking-widest text-mc-text-muted font-bold">Agenda</span>
            <p className="text-mc-sm text-mc-text-muted whitespace-pre-wrap leading-relaxed">{data.body}</p>
          </div>
        )}
      </div>
    )
  }

  if (item.type === 'task') {
    const { data } = item
    return (
      <div className="flex flex-col gap-2">
        <Row label="Status">{data.status}</Row>
        {data.priority && <Row label="Priority">{data.priority}</Row>}
      </div>
    )
  }

  if (item.type === 'chat') {
    const { data } = item
    return (
      <div className="flex flex-col gap-2">
        <Row label="Received">{formatRelative(data.receivedAt)}</Row>
        {data.preview && (
          <div className="flex flex-col gap-1 mt-1">
            <span className="text-mc-xs uppercase tracking-widest text-mc-text-muted font-bold">Message</span>
            <p className="text-mc-sm text-mc-text-muted leading-relaxed">{data.preview}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Row label="From">{item.data.from}</Row>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-mc-xs uppercase tracking-widest text-mc-text-muted w-14 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-mc-sm text-mc-text-primary flex-1">{children}</span>
    </div>
  )
}

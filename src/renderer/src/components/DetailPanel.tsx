import { useEffect, useRef, useState } from 'react'
import type { SelectedItem, TaskWorkspace } from '../types'

const ALL_WORKSPACES: TaskWorkspace[] = ['D8', 'BGC', 'EGG']
const WORKSPACE_PILL: Record<TaskWorkspace, string> = {
  D8: 'text-mc-d8 bg-mc-pill-blue-bg',
  BGC: 'text-mc-bgc bg-[#fdf1dc]',
  EGG: 'text-mc-egg bg-[#e9f7e9]',
}

const NOTES_KEY = 'mc:task-notes'
const SAVED_JOBS_KEY = 'mc:saved-jobs'

function loadNotes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}') } catch { return {} }
}
function saveNote(id: string, text: string) {
  const all = loadNotes()
  if (text.trim()) all[id] = text; else delete all[id]
  localStorage.setItem(NOTES_KEY, JSON.stringify(all))
}

function loadSavedJobs(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SAVED_JOBS_KEY) ?? '[]')) } catch { return new Set() }
}
function toggleSavedJob(id: string): boolean {
  const saved = loadSavedJobs()
  const nowSaved = !saved.has(id)
  if (nowSaved) saved.add(id); else saved.delete(id)
  localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify([...saved]))
  return nowSaved
}

function itemKey(item: SelectedItem): string {
  if (item.type === 'calendar') return `cal:${item.data.id}`
  if (item.type === 'task') return `task:${item.data.id}`
  if (item.type === 'chat') return `chat:${item.data.chatId}`
  if (item.type === 'job') return `job:${item.data.id}`
  if (item.type === 'newsletter') return `newsletter:${item.data.name}`
  return `inbox:${item.data.from}:${item.data.subject}`
}

function panelLabel(item: SelectedItem): string {
  if (item.type === 'calendar') return 'MEETING DETAILS'
  if (item.type === 'task') return 'TASK DETAILS'
  if (item.type === 'chat') return 'MESSAGE DETAILS'
  if (item.type === 'job') return 'JOB DETAILS'
  if (item.type === 'newsletter') return 'NEWSLETTER'
  return 'MESSAGE DETAILS'
}

function itemTitle(item: SelectedItem): string {
  if (item.type === 'calendar') return item.data.subject
  if (item.type === 'task') return item.data.title
  if (item.type === 'chat') return item.data.from
  if (item.type === 'job') return item.data.title
  if (item.type === 'newsletter') return item.data.name
  return item.data.subject
}

function itemLink(item: SelectedItem): string | null {
  if (item.type === 'calendar') return item.data.webLink ?? null
  if (item.type === 'task') return item.data.url ?? null
  if (item.type === 'chat') return item.data.webUrl ?? null
  if (item.type === 'job') return item.data.applyUrl
  return null
}

function itemLinkLabel(item: SelectedItem): string {
  if (item.type === 'calendar') return 'Open in Outlook'
  if (item.type === 'task') return 'Open in Notion'
  if (item.type === 'chat') return 'Open in Teams'
  if (item.type === 'job') return 'Apply'
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

export function DetailPanel({ item, onClose, onTaskMutated }: Props) {
  const key = itemKey(item)
  const [note, setNote] = useState(() => loadNotes()[key] ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const link = itemLink(item)
  const isRealLink = link && link !== '#'

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(() => item.type === 'job' && loadSavedJobs().has(item.data.id))

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

  function handleToggleSaved() {
    if (item.type !== 'job') return
    setIsSaved(toggleSavedJob(item.data.id))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleNoteChange(text: string) {
    setNote(text)
    saveNote(key, text)
  }

  return (
    <div className="w-[380px] flex-shrink-0 h-full border-l border-mc-canvas-border bg-mc-canvas flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-mc-canvas-border flex-shrink-0">
        <span className="text-mc-xs uppercase tracking-widest text-mc-ink-muted font-semibold">
          {panelLabel(item)}
        </span>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="text-mc-ink-faint hover:text-mc-ink-muted focus:outline-none text-xl leading-none pb-0.5"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5 min-w-0">
            <TypeBadge item={item} />
            <div className="text-mc-body font-semibold text-mc-ink leading-snug">
              {itemTitle(item)}
            </div>
            {item.type === 'job' && (
              <div className="text-mc-sm text-mc-ink-muted">{item.data.company}</div>
            )}
          </div>
          {item.type === 'job' && (
            <button
              onClick={handleToggleSaved}
              aria-label={isSaved ? 'Remove from saved' : 'Save for later'}
              title={isSaved ? 'Remove from saved' : 'Save for later'}
              className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-mc-sm border focus:outline-none
                ${isSaved ? 'text-mc-d8 border-mc-d8 bg-mc-pill-blue-bg' : 'text-mc-ink-faint border-mc-canvas-border hover:text-mc-ink-muted'}`}
            >
              {isSaved ? '★' : '☆'}
            </button>
          )}
        </div>

        <ItemDetails item={item} />

        {isRealLink && (
          <a
            href={link!}
            onClick={(e) => { e.preventDefault(); window.open(link!, '_blank') }}
            className="self-start text-mc-sm font-bold uppercase tracking-widest px-3 py-1.5 rounded-mc-sm border
              text-mc-d8 border-mc-d8 bg-mc-pill-blue-bg hover:brightness-95 cursor-pointer"
          >
            {itemLinkLabel(item)} ↗
          </a>
        )}

        {item.type === 'calendar' && item.data.joinUrl && (
          <button
            onClick={() => window.open(item.data.joinUrl, '_blank')}
            className="self-start text-mc-sm font-bold uppercase tracking-widest px-3 py-1.5 rounded-mc-sm
              text-white bg-mc-sidebar-active hover:brightness-110 focus:outline-none"
          >
            Join Meeting ↗
          </button>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-mc-xs uppercase tracking-widest text-mc-ink-muted font-bold">
            {item.type === 'job' ? 'Private Note' : 'Status Notes'}
          </label>
          <textarea
            ref={textareaRef}
            value={note}
            onChange={e => handleNoteChange(e.target.value)}
            placeholder="Add context, blockers, next steps…"
            rows={4}
            className="w-full bg-mc-canvas-alt border border-mc-canvas-border rounded-mc-md px-3 py-2 text-mc-sm text-mc-ink placeholder-mc-ink-faint resize-none focus:outline-none focus:ring-1 focus:ring-mc-d8"
          />
        </div>
      </div>

      {/* Task actions */}
      {item.type === 'task' && (
        <div className="flex-shrink-0 border-t border-mc-canvas-border px-4 py-3 flex flex-col gap-2">
          {actionError && (
            <div className="text-mc-sm text-mc-error">{actionError}</div>
          )}
          <button
            onClick={handleComplete}
            disabled={pendingAction !== null}
            className="w-full text-mc-sm font-bold uppercase tracking-widest py-2 rounded-mc-sm text-white bg-mc-sidebar-active hover:brightness-110 focus:outline-none disabled:opacity-40"
          >
            {pendingAction === 'complete' ? 'Completing…' : '✓ Mark Complete'}
          </button>
          <div className="flex items-center gap-2">
            {ALL_WORKSPACES.filter(ws => ws !== item.workspace).map(ws => (
              <button
                key={ws}
                onClick={() => handleMove(ws)}
                disabled={pendingAction !== null}
                className="flex-1 text-mc-sm font-medium px-2.5 py-1.5 rounded-mc-sm border border-mc-canvas-border text-mc-ink-muted hover:bg-mc-canvas-alt focus:outline-none disabled:opacity-40"
              >
                {pendingAction === `move:${ws}` ? 'Moving…' : `→ Move ${ws}`}
              </button>
            ))}
          </div>
          <button
            onClick={handleDelete}
            disabled={pendingAction !== null}
            className={`w-full text-mc-sm font-medium px-2.5 py-1.5 rounded-mc-sm border focus:outline-none disabled:opacity-40
              ${confirmingDelete
                ? 'text-white bg-mc-error border-mc-error hover:brightness-110'
                : 'text-mc-error border-mc-pill-red-bg bg-mc-pill-red-bg hover:brightness-95'}`}
          >
            {pendingAction === 'delete' ? 'Deleting…' : confirmingDelete ? 'Confirm delete?' : '🗑 Delete Task'}
          </button>
        </div>
      )}
    </div>
  )
}

function TypeBadge({ item }: { item: SelectedItem }) {
  if (item.type === 'calendar') {
    return <span className="text-mc-xs uppercase font-bold tracking-widest text-mc-d8">Meeting</span>
  }
  if (item.type === 'task') {
    const priorityColor = item.data.priority === 'P1' ? 'text-mc-priority-p1'
      : item.data.priority === 'P2' ? 'text-mc-priority-p2' : 'text-mc-ink-muted'
    return (
      <div className="flex items-center gap-2">
        <span className={`text-mc-xs uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-mc-sm ${WORKSPACE_PILL[item.workspace]}`}>
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
  if (item.type === 'job') {
    return <span className="text-mc-xs uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-mc-sm text-mc-d8 bg-mc-pill-blue-bg">Job Radar · {item.data.score}/100</span>
  }
  if (item.type === 'newsletter') {
    return <span className="text-mc-xs uppercase font-bold tracking-widest text-mc-d8">Newsletter</span>
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
          <span className="text-mc-ink-muted ml-1.5">({formatDuration(data.start, data.end)})</span>
        </Row>
        <Row label="Starts"><span className="text-mc-d8 font-medium">{formatCountdown(data.start)}</span></Row>
        {data.attendees.length > 0 && (
          <Row label="With">{data.attendees.join(', ')}</Row>
        )}
        {data.body && (
          <div className="flex flex-col gap-1 mt-1">
            <span className="text-mc-xs uppercase tracking-widest text-mc-ink-muted font-bold">Agenda</span>
            <p className="text-mc-sm text-mc-ink-muted whitespace-pre-wrap leading-relaxed">{data.body}</p>
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
            <span className="text-mc-xs uppercase tracking-widest text-mc-ink-muted font-bold">Message</span>
            <p className="text-mc-sm text-mc-ink-muted leading-relaxed">{data.preview}</p>
          </div>
        )}
      </div>
    )
  }

  if (item.type === 'job') {
    const { data } = item
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-mc-xs text-mc-ink-muted">
            <span className="uppercase tracking-widest font-bold">Fit Score</span>
            <span className="font-bold text-mc-ink">{data.score}/100</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-mc-canvas-alt overflow-hidden">
            <div className="h-full bg-mc-d8" style={{ width: `${data.score}%` }} />
          </div>
        </div>
        <Row label="Where">{data.location}</Row>
        <Row label="Posted">{data.postedAgo}</Row>
        <Row label="Interest">{data.applicants}</Row>
        <div className="flex flex-col gap-1 mt-1">
          <span className="text-mc-xs uppercase tracking-widest text-mc-ink-muted font-bold">Why it matched</span>
          <p className="text-mc-sm text-mc-ink-muted italic leading-relaxed">{data.reason}</p>
        </div>
      </div>
    )
  }

  if (item.type === 'newsletter') {
    const { data } = item
    const stories = (data.summary ?? '')
      .split('\n')
      .filter(Boolean)
      .map((line) => line.replace(/^•\s*/, ''))
      .map((line) => {
        const sepIndex = line.indexOf(': ')
        return sepIndex === -1
          ? { headline: line, gist: '' }
          : { headline: line.slice(0, sepIndex), gist: line.slice(sepIndex + 2) }
      })
    return (
      <div className="flex flex-col gap-2.5">
        {(data.subject || data.sender) && (
          <Row label="Issue">
            {data.subject}
            {data.subject && data.sender && <span className="text-mc-ink-muted"> · {data.sender}</span>}
            {!data.subject && data.sender}
          </Row>
        )}
        <div className="flex flex-col gap-2.5 mt-1">
          <span className="text-mc-xs uppercase tracking-widest text-mc-ink-muted font-bold">Stories</span>
          {stories.map((story, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="text-mc-sm font-semibold text-mc-ink leading-snug">{story.headline}</span>
              {story.gist && <span className="text-mc-sm text-mc-ink-muted leading-relaxed">{story.gist}</span>}
            </div>
          ))}
        </div>
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
      <span className="text-mc-xs uppercase tracking-widest text-mc-ink-muted w-14 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-mc-sm text-mc-ink flex-1">{children}</span>
    </div>
  )
}

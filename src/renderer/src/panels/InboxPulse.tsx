import { useState } from 'react'
import { PanelHeader } from '../components/PanelHeader'
import { SkeletonBars } from '../components/SkeletonBars'
import type { PanelState, InboxData, GmailInboxData, ChatMessage } from '../types'
import type { SelectedItem } from '../types'

interface InboxPulseProps {
  panel: PanelState<InboxData>
  gmailPanel: PanelState<GmailInboxData[]>
  flashAuthDot?: boolean
  onSelect: (item: SelectedItem) => void
  onConnectGmail: () => void
}

export function InboxPulse({ panel, gmailPanel, flashAuthDot, onSelect, onConnectGmail }: InboxPulseProps) {
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
      aria-label="D8 Inbox Pulse"
      className="flex flex-col h-full bg-mc-canvas"
    >
      <PanelHeader
        label="INBOX PULSE"
        shortLabel="INBOX"
        dotState={dotState}
        staleLabel={staleLabel}
        flashDot={flashAuthDot}
      />

      <div className="flex-1 overflow-y-auto">
        {status.state === 'loading' && <SkeletonBars count={4} />}

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

        {(status.state === 'ok' || status.state === 'stale' || status.state === 'empty' || (status.state === 'error' && status.message !== 'auth')) && panel.data && (
          <InboxContent data={panel.data} onSelect={onSelect} />
        )}
      </div>

      <GmailBlock panel={gmailPanel} onConnect={onConnectGmail} />
    </section>
  )
}

function formatRelative(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function InboxContent({ data, onSelect }: { data: InboxData; onSelect: (item: SelectedItem) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const visible = data.outlookTopSubjects.filter(item => !deletedIds.has(item.id))
  const shown = expanded ? visible : visible.slice(0, 3)
  const hiddenCount = visible.length - 3

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletedIds(prev => new Set([...prev, id]))
    await window.api.deleteOutlookMessage(id)
  }

  return (
    <div className="flex flex-col">
      {/* Outlook block */}
      <div className="px-3 pt-3 pb-1">
        <div className="text-mc-xl font-tabular text-mc-ink">{data.outlookUnread}</div>
        <div className="text-mc-sm text-mc-ink-muted -mt-1">unread emails</div>
      </div>

      <div className="px-3 pb-2 flex flex-col">
        {shown.map((item, i) => (
          <div key={i} className="flex items-center gap-1 border-b border-mc-canvas-border last:border-0">
            <button
              onClick={() => onSelect({ type: 'inbox', data: item })}
              className="flex-1 text-left py-1.5 hover:bg-mc-canvas-alt px-1 -mx-1 rounded-mc-sm focus:outline-none min-w-0"
            >
              <div className="text-mc-xs text-mc-ink-muted uppercase tracking-widest truncate">{item.from}</div>
              <div className="text-mc-base text-mc-ink truncate">{item.subject}</div>
            </button>
            <button
              onClick={(e) => handleDelete(item.id, e)}
              className="flex-shrink-0 p-1 text-mc-ink-faint hover:text-red-500 focus:outline-none rounded-mc-sm"
              aria-label="Delete email"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ))}
        {!expanded && hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-1 text-mc-xs text-mc-d8 hover:underline focus:outline-none text-left"
          >
            Show {hiddenCount} more
          </button>
        )}
        {expanded && visible.length > 3 && (
          <button
            onClick={() => setExpanded(false)}
            className="mt-1 text-mc-xs text-mc-d8 hover:underline focus:outline-none text-left"
          >
            Show less
          </button>
        )}
      </div>

      {/* Teams chats block */}
      <div className="border-t border-mc-canvas-border">
        <div className="px-3 pt-3 pb-1 flex items-baseline justify-between">
          <div>
            <div className="text-mc-lg font-tabular text-mc-ink">{data.teamsUnread ?? '—'}</div>
            <div className="text-mc-sm text-mc-ink-muted -mt-0.5">unread chats</div>
          </div>
        </div>

        {data.recentChats && data.recentChats.length > 0 && (
          <div className="px-3 pb-3 flex flex-col gap-0">
            {data.recentChats.map((chat) => (
              <ChatRow key={chat.chatId} chat={chat} onSelect={() => onSelect({ type: 'chat', data: chat })} />
            ))}
          </div>
        )}

        {(!data.recentChats || data.recentChats.length === 0) && (
          <div className="px-3 pb-3 text-mc-xs text-mc-ink-faint">Chat.Read · DMs + group only</div>
        )}
      </div>
    </div>
  )
}

function GmailBlock({
  panel,
  onConnect,
}: {
  panel: PanelState<GmailInboxData[]>
  onConnect: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { status } = panel

  if (status.state === 'not-configured') {
    return (
      <div className="border-t border-mc-canvas-border px-3 py-3 flex-shrink-0 flex items-center justify-between">
        <div>
          <div className="text-mc-sm font-semibold text-mc-ink">Gmail</div>
          <div className="text-mc-xs text-mc-ink-muted">Not connected</div>
        </div>
        <button
          onClick={onConnect}
          className="text-mc-sm bg-mc-pill-blue-bg text-mc-d8 rounded-mc-md px-3 py-1.5 hover:brightness-95 focus:outline-none focus:ring-1 focus:ring-mc-d8"
        >
          Connect Gmail →
        </button>
      </div>
    )
  }

  if (status.state === 'loading') {
    return (
      <div className="border-t border-mc-canvas-border flex-shrink-0">
        <SkeletonBars count={2} />
      </div>
    )
  }

  const accounts = panel.data
  if (!accounts) return null

  return (
    <div className="flex-shrink-0">
      {accounts.map((account) => (
        <div key={account.email} className="border-t border-mc-canvas-border">
          <div className="px-3 pt-3 pb-1 flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <div className="text-mc-lg font-tabular text-mc-ink">{account.unread}</div>
              <div className="text-mc-sm text-mc-ink-muted -mt-0.5">unread Gmail</div>
            </div>
            <div className="text-mc-xs text-mc-ink-faint uppercase tracking-widest truncate">{account.email}</div>
          </div>
          {account.topSubjects.length > 0 && (
            <div className="px-3 pb-3 flex flex-col">
              {(expanded ? account.topSubjects : account.topSubjects.slice(0, 3)).map((item, i) => (
                <button
                  key={i}
                  onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${item.id}`, '_blank')}
                  className="w-full text-left py-1.5 border-b border-mc-canvas-border last:border-0 hover:bg-mc-canvas-alt px-1 -mx-1 rounded-mc-sm focus:outline-none"
                >
                  <div className="text-mc-xs text-mc-ink-muted uppercase tracking-widest truncate">{item.from}</div>
                  <div className="text-mc-base text-mc-ink truncate">{item.subject}</div>
                </button>
              ))}
              {!expanded && account.topSubjects.length > 3 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="mt-1 text-mc-xs text-mc-d8 hover:underline focus:outline-none text-left"
                >
                  Show {account.topSubjects.length - 3} more
                </button>
              )}
              {expanded && account.topSubjects.length > 3 && (
                <button
                  onClick={() => setExpanded(false)}
                  className="mt-1 text-mc-xs text-mc-d8 hover:underline focus:outline-none text-left"
                >
                  Show less
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      <div className="border-t border-mc-canvas-border px-3 py-2">
        <button
          onClick={onConnect}
          className="text-mc-xs font-bold uppercase tracking-widest text-mc-d8 hover:underline focus:outline-none"
        >
          + Add another Gmail account
        </button>
      </div>
    </div>
  )
}

function ChatRow({ chat, onSelect }: { chat: ChatMessage; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left py-1.5 border-b border-mc-canvas-border last:border-0 hover:bg-mc-canvas-alt px-1 -mx-1 rounded-mc-sm focus:outline-none"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-mc-xs text-mc-d8 uppercase tracking-widest font-bold truncate">{chat.from}</span>
        <span className="text-mc-xs text-mc-ink-faint flex-shrink-0">{formatRelative(chat.receivedAt)}</span>
      </div>
      <div className="text-mc-base text-mc-ink truncate">{chat.preview}</div>
    </button>
  )
}

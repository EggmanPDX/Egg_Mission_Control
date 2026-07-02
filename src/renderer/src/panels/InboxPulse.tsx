import { PanelHeader } from '../components/PanelHeader'
import { SkeletonBars } from '../components/SkeletonBars'
import type { PanelState, InboxData, ChatMessage } from '../types'
import type { SelectedItem } from '../types'

interface InboxPulseProps {
  panel: PanelState<InboxData>
  flashAuthDot?: boolean
  onSelect: (item: SelectedItem) => void
}

export function InboxPulse({ panel, flashAuthDot, onSelect }: InboxPulseProps) {
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

        {(status.state === 'ok' || status.state === 'stale' || (status.state === 'error' && status.message !== 'auth')) && panel.data && (
          <InboxContent data={panel.data} onSelect={onSelect} />
        )}

        {status.state === 'empty' && (
          <div className="flex items-center justify-center h-full text-mc-ink-muted text-mc-sm">
            Outlook is clear.
          </div>
        )}
      </div>
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
  return (
    <div className="flex flex-col">
      {/* Outlook block */}
      <div className="px-3 pt-3 pb-1">
        <div className="text-mc-xl font-tabular text-mc-ink">{data.outlookUnread}</div>
        <div className="text-mc-sm text-mc-ink-muted -mt-1">unread emails</div>
      </div>

      <div className="px-3 pb-2 flex flex-col">
        {data.outlookTopSubjects.map((item, i) => (
          <button
            key={i}
            onClick={() => onSelect({ type: 'inbox', data: item })}
            className="w-full text-left py-1.5 border-b border-mc-canvas-border last:border-0 hover:bg-mc-canvas-alt px-1 -mx-1 rounded-mc-sm focus:outline-none"
          >
            <div className="text-mc-xs text-mc-ink-muted uppercase tracking-widest truncate">{item.from}</div>
            <div className="text-mc-base text-mc-ink truncate">{item.subject}</div>
          </button>
        ))}
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

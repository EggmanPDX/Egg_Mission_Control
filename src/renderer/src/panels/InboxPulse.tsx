import { PanelHeader } from '../components/PanelHeader'
import { SkeletonBars } from '../components/SkeletonBars'
import type { PanelState, InboxData } from '../types'

interface InboxPulseProps {
  panel: PanelState<InboxData>
  flashAuthDot?: boolean
}

export function InboxPulse({ panel, flashAuthDot }: InboxPulseProps) {
  const { status } = panel

  const dotState = status.state === 'error' ? 'error'
    : status.state === 'stale' ? 'stale'
    : status.state === 'loading' ? 'loading'
    : 'ok'

  const staleLabel = status.state === 'stale'
    ? `${Math.round((Date.now() - status.lastUpdated.getTime()) / 60000)} min ago`
    : undefined

  return (
    <section
      role="region"
      aria-label="D8 Inbox Pulse"
      className="flex flex-col h-full bg-mc-surface"
    >
      <PanelHeader
        label="D8 INBOX PULSE"
        shortLabel="INBOX"
        dotState={dotState}
        staleLabel={staleLabel}
        flashDot={flashAuthDot}
      />

      <div className="flex-1 overflow-y-auto">
        {status.state === 'loading' && <SkeletonBars count={4} />}

        {(status.state === 'error' && status.message === 'auth') && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <span className="text-mc-sm text-mc-text-muted">Can&apos;t authenticate.</span>
            <button
              onClick={() => window.api.triggerReauth()}
              className="text-mc-sm text-mc-d8 hover:underline focus:outline-none focus:ring-1 focus:ring-mc-d8 rounded-mc-sm px-2 py-1"
            >
              Re-authenticate
            </button>
          </div>
        )}

        {(status.state === 'ok' || status.state === 'stale' || (status.state === 'error' && status.message !== 'auth')) && panel.data && (
          <InboxContent data={panel.data} />
        )}

        {status.state === 'empty' && (
          <div className="flex items-center justify-center h-full text-mc-text-muted text-mc-sm">
            Outlook is clear.
          </div>
        )}
      </div>
    </section>
  )
}

function InboxContent({ data }: { data: InboxData }) {
  return (
    <div className="flex flex-col gap-0">
      {/* Outlook block */}
      <div className="p-3">
        <div className="text-mc-xl font-tabular text-mc-text-primary">{data.outlookUnread}</div>
        <div className="text-mc-sm text-mc-text-muted -mt-1">unread</div>
      </div>

      <div className="px-3 pb-2 flex flex-col gap-1">
        {data.outlookTopSubjects.map((item, i) => (
          <div key={i} className="py-1 border-b border-mc-border last:border-0">
            <div className="text-mc-xs text-mc-text-muted uppercase tracking-widest truncate">{item.from}</div>
            <div className="text-mc-base text-mc-text-primary truncate">{item.subject}</div>
          </div>
        ))}
      </div>

      {/* Teams block */}
      <div className="border-t border-mc-border p-3">
        <div className="text-mc-lg font-tabular text-mc-text-primary">
          {data.teamsUnread ?? '—'}
        </div>
        <div className="text-mc-sm text-mc-text-muted">chats</div>
        <div className="text-mc-xs text-mc-text-faint mt-0.5">Chat.Read · DMs + group only</div>
      </div>
    </div>
  )
}

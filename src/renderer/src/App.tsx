import { useState, useEffect, useCallback, useRef } from 'react'
import { MeetingBrief } from './panels/MeetingBrief'
import { NotionTasks } from './panels/NotionTasks'
import { InboxPulse } from './panels/InboxPulse'
import { NotionSetup } from './panels/NotionSetup'
import { DetailModal } from './components/DetailModal'
import type { PanelState, CalendarEvent, NotionTask, InboxData, PollResult, SelectedItem } from './types'

const loading = <T,>(): PanelState<T> => ({ status: { state: 'loading' }, data: null })

export default function App() {
  const [showNotionSetup, setShowNotionSetup] = useState(false)
  const [msGraphAuthed, setMsGraphAuthed] = useState(false)
  const [flashDots, setFlashDots] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)

  const [meetingPanel, setMeetingPanel] = useState<PanelState<CalendarEvent[]>>(loading())
  const [d8TaskPanel, setD8TaskPanel] = useState<PanelState<NotionTask[]>>(loading())
  const [eggTaskPanel, setEggTaskPanel] = useState<PanelState<NotionTask[]>>(loading())
  const [bgcTaskPanel, setBgcTaskPanel] = useState<PanelState<NotionTask[]>>(loading())
  const [inboxPanel, setInboxPanel] = useState<PanelState<InboxData>>(loading())

  // Guards applyPollResult against overwriting a correctly-set 'not-configured' state with a
  // stale cached poll result — isNotionConfigured() and getPollResult() race on mount and can
  // resolve in either order.
  const notionConfiguredRef = useRef<boolean>(false)

  const applyPollResult = useCallback((result: PollResult) => {
    setMeetingPanel({
      status: result.calendar.length === 0 ? { state: 'empty' } : { state: 'ok' },
      data: result.calendar,
    })
    setInboxPanel({
      status: result.inbox.outlookUnread === 0 ? { state: 'empty' } : { state: 'ok' },
      data: result.inbox,
    })
    if (notionConfiguredRef.current) {
      setD8TaskPanel({
        status: result.d8Tasks.length === 0 ? { state: 'empty' } : { state: 'ok' },
        data: result.d8Tasks,
      })
      setEggTaskPanel({
        status: result.eggTasks.length === 0 ? { state: 'empty' } : { state: 'ok' },
        data: result.eggTasks,
      })
      setBgcTaskPanel({
        status: result.bgcTasks.length === 0 ? { state: 'empty' } : { state: 'ok' },
        data: result.bgcTasks,
      })
    }
  }, [])

  useEffect(() => {
    // Check Notion config on mount
    window.api.isNotionConfigured().then(configured => {
      notionConfiguredRef.current = configured
      if (!configured) {
        setD8TaskPanel({ status: { state: 'not-configured' }, data: null })
        setEggTaskPanel({ status: { state: 'not-configured' }, data: null })
        setBgcTaskPanel({ status: { state: 'not-configured' }, data: null })
      }
    })

    // Load initial poll result
    window.api.getPollResult().then(result => {
      if (result) applyPollResult(result)
    })

    // Subscribe to push updates
    const unsubPoll = window.api.onPollUpdate(applyPollResult)
    const unsubAuth = window.api.onAuthStateChange(({ msGraphAuthed: authed, notionConfigured: nc }) => {
      setMsGraphAuthed(authed)
      notionConfiguredRef.current = nc
      if (authed) {
        // Flash dots for 1 second on first successful auth
        setFlashDots(true)
        setTimeout(() => setFlashDots(false), 1000)
      }
    })

    return () => {
      unsubPoll()
      unsubAuth()
    }
  }, [applyPollResult])

  const handleNotionSuccess = () => {
    notionConfiguredRef.current = true
    setShowNotionSetup(false)
    setD8TaskPanel(loading())
    setEggTaskPanel(loading())
    setBgcTaskPanel(loading())
    // Poll coordinator will pick up Notion token and update on next cycle
  }

  // Re-fetches the current poll result after a task mutation (archive/complete/move) so the
  // panels reflect the change immediately rather than waiting for the next poll interval.
  const refreshAfterMutation = useCallback(() => {
    window.api.getPollResult().then(result => {
      if (result) applyPollResult(result)
    })
  }, [applyPollResult])

  if (showNotionSetup) {
    return (
      <NotionSetup
        onSuccess={handleNotionSuccess}
        onSkip={() => setShowNotionSetup(false)}
      />
    )
  }

  return (
    <>
    <div className="flex flex-col h-screen bg-mc-base text-mc-text-primary">
      {/* Titlebar */}
      <div className="flex items-center justify-between px-4 h-8 bg-mc-surface-raised border-b border-mc-border flex-shrink-0" style={{ paddingLeft: '80px' }}>
        <span className="text-mc-xs uppercase tracking-widest text-mc-text-label mx-auto">MISSION CONTROL</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.api.triggerReauth()}
            className={`text-mc-xs font-bold uppercase px-2 py-0.5 rounded-mc-sm border focus:outline-none
              ${msGraphAuthed
                ? 'text-mc-d8 border-mc-D8-border bg-mc-D8-bg hover:brightness-110'
                : 'text-mc-error border-mc-error border-opacity-25 bg-mc-error bg-opacity-10 hover:bg-opacity-20'}`}
          >
            D8
          </button>
          <span className="text-mc-xs font-bold uppercase text-mc-egg bg-mc-egg-bg border border-mc-egg-border px-2 py-0.5 rounded-mc-sm">
            EGG
          </span>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 min-w-0">
          <MeetingBrief panel={meetingPanel} flashAuthDot={flashDots} onSelect={item => setSelectedItem({ type: 'calendar', data: item })} />
        </div>
        <div className="flex-1 min-w-0">
          <NotionTasks
            d8Panel={d8TaskPanel}
            eggPanel={eggTaskPanel}
            bgcPanel={bgcTaskPanel}
            onSetupNotion={() => setShowNotionSetup(true)}
            onSelect={setSelectedItem}
          />
        </div>
        <div className="flex-1 min-w-0">
          <InboxPulse panel={inboxPanel} flashAuthDot={flashDots} onSelect={setSelectedItem} />
        </div>
      </div>
    </div>

    {selectedItem && (
      <DetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onTaskMutated={refreshAfterMutation}
      />
    )}
    </>
  )
}

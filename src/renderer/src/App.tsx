import { useState, useEffect, useCallback } from 'react'
import { MeetingBrief } from './panels/MeetingBrief'
import { NotionTasks } from './panels/NotionTasks'
import { InboxPulse } from './panels/InboxPulse'
import { NotionSetup } from './panels/NotionSetup'
import type { PanelState, CalendarEvent, NotionTask, InboxData, PollResult } from './types'

const loading = <T,>(): PanelState<T> => ({ status: { state: 'loading' }, data: null })

export default function App() {
  const [notionConfigured, setNotionConfigured] = useState<boolean | null>(null)
  const [showNotionSetup, setShowNotionSetup] = useState(false)
  const [msGraphAuthed, setMsGraphAuthed] = useState(false)
  const [flashDots, setFlashDots] = useState(false)

  const [meetingPanel, setMeetingPanel] = useState<PanelState<CalendarEvent[]>>(loading())
  const [d8TaskPanel, setD8TaskPanel] = useState<PanelState<NotionTask[]>>(loading())
  const [eggTaskPanel, setEggTaskPanel] = useState<PanelState<NotionTask[]>>(loading())
  const [inboxPanel, setInboxPanel] = useState<PanelState<InboxData>>(loading())

  const applyPollResult = useCallback((result: PollResult) => {
    setMeetingPanel({
      status: result.calendar.length === 0 ? { state: 'empty' } : { state: 'ok' },
      data: result.calendar,
    })
    setInboxPanel({
      status: result.inbox.outlookUnread === 0 ? { state: 'empty' } : { state: 'ok' },
      data: result.inbox,
    })
    setD8TaskPanel({
      status: result.d8Tasks.length === 0 ? { state: 'empty' } : { state: 'ok' },
      data: result.d8Tasks,
    })
    setEggTaskPanel({
      status: result.eggTasks.length === 0 ? { state: 'empty' } : { state: 'ok' },
      data: result.eggTasks,
    })
  }, [])

  useEffect(() => {
    // Check Notion config on mount
    window.api.isNotionConfigured().then(configured => {
      setNotionConfigured(configured)
      if (!configured) {
        setD8TaskPanel({ status: { state: 'not-configured' }, data: null })
        setEggTaskPanel({ status: { state: 'not-configured' }, data: null })
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
      setNotionConfigured(nc)
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
    setNotionConfigured(true)
    setShowNotionSetup(false)
    setD8TaskPanel(loading())
    setEggTaskPanel(loading())
    // Poll coordinator will pick up Notion token and update on next cycle
  }

  if (showNotionSetup) {
    return (
      <NotionSetup
        onSuccess={handleNotionSuccess}
        onSkip={() => setShowNotionSetup(false)}
      />
    )
  }

  return (
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
          <MeetingBrief panel={meetingPanel} flashAuthDot={flashDots} />
        </div>
        <div className="flex-1 min-w-0">
          <NotionTasks
            d8Panel={d8TaskPanel}
            eggPanel={eggTaskPanel}
            onSetupNotion={() => setShowNotionSetup(true)}
          />
        </div>
        <div className="flex-1 min-w-0">
          <InboxPulse panel={inboxPanel} flashAuthDot={flashDots} />
        </div>
      </div>
    </div>
  )
}

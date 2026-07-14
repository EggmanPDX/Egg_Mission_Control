import { useState, useEffect, useCallback, useRef } from 'react'
import { MeetingBrief } from './panels/MeetingBrief'
import { TaskPanel } from './panels/TaskPanel'
import { InboxPulse } from './panels/InboxPulse'
import { JobRadarPanel } from './panels/JobRadarPanel'
import { NewsletterPanel } from './panels/NewsletterPanel'
import { NotionSetup } from './panels/NotionSetup'
import { ProjectRollupPanel } from './panels/ProjectRollupPanel'
import { NavSidebar } from './components/NavSidebar'
import { DetailPanel } from './components/DetailPanel'
import type { PanelState, CalendarEvent, NotionTask, InboxData, GmailInboxData, JobRadarEntry, NewsletterEntry, ProjectRollupEntry, PollResult, SelectedItem, NavPanelId } from './types'

const loading = <T,>(): PanelState<T> => ({ status: { state: 'loading' }, data: null })

const ACTIVE_PANEL_KEY = 'mc:active-panel'
const PANEL_TITLES: Record<NavPanelId, string> = {
  meeting: 'Meeting Brief',
  inbox: 'Inbox Pulse',
  d8: 'D8 Tasks',
  bgc: 'BGC Tasks',
  egg: 'Egg Tasks',
  jobRadar: 'Job Radar',
  newsletters: 'Newsletters',
  projects: 'Project Rollup',
}

function loadActivePanel(): NavPanelId {
  const saved = localStorage.getItem(ACTIVE_PANEL_KEY)
  if (saved && saved in PANEL_TITLES) return saved as NavPanelId
  return 'meeting'
}

export default function App() {
  const [activePanel, setActivePanelState] = useState<NavPanelId>(loadActivePanel)
  const [showNotionSetup, setShowNotionSetup] = useState(false)
  const [msGraphAuthed, setMsGraphAuthed] = useState(false)
  const [googleAuthed, setGoogleAuthed] = useState(false)
  const [flashDots, setFlashDots] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)

  const [meetingPanel, setMeetingPanel] = useState<PanelState<CalendarEvent[]>>(loading())
  const [d8TaskPanel, setD8TaskPanel] = useState<PanelState<NotionTask[]>>(loading())
  const [eggTaskPanel, setEggTaskPanel] = useState<PanelState<NotionTask[]>>(loading())
  const [bgcTaskPanel, setBgcTaskPanel] = useState<PanelState<NotionTask[]>>(loading())
  const [inboxPanel, setInboxPanel] = useState<PanelState<InboxData>>(loading())
  const [gmailPanel, setGmailPanel] = useState<PanelState<GmailInboxData[]>>(loading())
  const [jobRadarPanel, setJobRadarPanel] = useState<PanelState<JobRadarEntry[]>>(loading())
  const [jobRadarUpdatedAt, setJobRadarUpdatedAt] = useState<string | null>(null)
  const [newsletterPanel, setNewsletterPanel] = useState<PanelState<NewsletterEntry[]>>(loading())
  const [newslettersUpdatedAt, setNewslettersUpdatedAt] = useState<string | null>(null)
  const [projectRollupPanel, setProjectRollupPanel] = useState<PanelState<ProjectRollupEntry[]>>(loading())

  // Guards applyPollResult against overwriting a correctly-set 'not-configured' state with a
  // stale cached poll result — isNotionConfigured() and getPollResult() race on mount and can
  // resolve in either order.
  const notionConfiguredRef = useRef<boolean>(false)
  const googleConfiguredRef = useRef<boolean>(false)
  // Ref so applyPollResult (useCallback []) can read current auth state without stale closure
  const msGraphAuthedRef = useRef<boolean>(false)

  function setActivePanel(id: NavPanelId) {
    setActivePanelState(id)
    setSelectedItem(null)
    localStorage.setItem(ACTIVE_PANEL_KEY, id)
  }

  const applyPollResult = useCallback((result: PollResult) => {
    const calendarStatus = result.calendar.length > 0
      ? { state: 'ok' as const }
      : msGraphAuthedRef.current
        ? { state: 'empty' as const }
        : { state: 'error' as const, message: 'auth', lastUpdated: null }
    setMeetingPanel({ status: calendarStatus, data: result.calendar })
    setInboxPanel({
      status: result.inbox.outlookUnread === 0 ? { state: 'empty' } : { state: 'ok' },
      data: result.inbox,
    })
    if (googleConfiguredRef.current) {
      setGmailPanel({
        status: result.gmail.length === 0 ? { state: 'empty' } : { state: 'ok' },
        data: result.gmail,
      })
    }
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
      setJobRadarPanel({
        status: result.jobRadar.length === 0 ? { state: 'empty' } : { state: 'ok' },
        data: result.jobRadar,
      })
      setJobRadarUpdatedAt(result.jobRadarUpdatedAt)
      setNewsletterPanel({
        status: result.newsletters.length === 0 ? { state: 'empty' } : { state: 'ok' },
        data: result.newsletters,
      })
      setNewslettersUpdatedAt(result.newslettersUpdatedAt)
      setProjectRollupPanel({
        status: result.projectRollup.length === 0 ? { state: 'empty' } : { state: 'ok' },
        data: result.projectRollup,
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
        setJobRadarPanel({ status: { state: 'not-configured' }, data: null })
        setNewsletterPanel({ status: { state: 'not-configured' }, data: null })
        setProjectRollupPanel({ status: { state: 'not-configured' }, data: null })
      } else {
        // getPollResult() below races with this and usually wins before the ref is set,
        // leaving Notion panels blank. Re-apply once the ref is confirmed true.
        window.api.getPollResult().then(result => { if (result) applyPollResult(result) })
      }
    })

    // Check Google (Gmail) config on mount
    window.api.isGoogleConfigured().then(configured => {
      googleConfiguredRef.current = configured
      setGoogleAuthed(configured)
      if (!configured) {
        setGmailPanel({ status: { state: 'not-configured' }, data: null })
      }
    })

    // Load initial poll result
    window.api.getPollResult().then(result => {
      if (result) applyPollResult(result)
    })

    // Subscribe to push updates
    const unsubPoll = window.api.onPollUpdate(applyPollResult)
    const unsubAuth = window.api.onAuthStateChange(({ msGraphAuthed: authed, notionConfigured: nc }) => {
      msGraphAuthedRef.current = authed
      setMsGraphAuthed(authed)
      notionConfiguredRef.current = nc
      if (!authed) {
        setMeetingPanel(prev =>
          prev.status.state === 'ok' || prev.status.state === 'loading'
            ? { status: { state: 'error', message: 'auth', lastUpdated: null }, data: null }
            : prev
        )
      }
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
    setJobRadarPanel(loading())
    setNewsletterPanel(loading())
    setProjectRollupPanel(loading())
    // Poll coordinator will pick up Notion token and update on next cycle
  }

  // Connects one Gmail account. Safe to call again to add a 2nd/3rd account — each call
  // adds or refreshes one account (by email) without disconnecting previously connected ones.
  const handleGoogleReauth = async () => {
    const result = await window.api.triggerGoogleReauth()
    if (result.ok) {
      googleConfiguredRef.current = true
      setGoogleAuthed(true)
      setGmailPanel(loading())
      // Poll coordinator's post-auth pollGraph() will populate this shortly; also refresh now
      // in case that resolves before the next getPollResult call would naturally happen.
      window.api.getPollResult().then(r => { if (r) applyPollResult(r) })
    } else {
      console.error('[App] Google reauth failed:', result.error)
    }
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

  function renderActivePanel() {
    switch (activePanel) {
      case 'meeting':
        return <MeetingBrief panel={meetingPanel} flashAuthDot={flashDots} onSelect={item => setSelectedItem({ type: 'calendar', data: item })} />
      case 'inbox':
        return <InboxPulse panel={inboxPanel} gmailPanel={gmailPanel} flashAuthDot={flashDots} onSelect={setSelectedItem} onConnectGmail={handleGoogleReauth} />
      case 'd8':
        return <TaskPanel workspace="D8" label="D8" panel={d8TaskPanel} selectedItem={selectedItem} onSelect={setSelectedItem} onSetupNotion={() => setShowNotionSetup(true)} onTaskMutated={refreshAfterMutation} />
      case 'bgc':
        return <TaskPanel workspace="BGC" label="BGC" panel={bgcTaskPanel} selectedItem={selectedItem} onSelect={setSelectedItem} onSetupNotion={() => setShowNotionSetup(true)} onTaskMutated={refreshAfterMutation} />
      case 'egg':
        return <TaskPanel workspace="EGG" label="Egg" panel={eggTaskPanel} selectedItem={selectedItem} onSelect={setSelectedItem} onSetupNotion={() => setShowNotionSetup(true)} onTaskMutated={refreshAfterMutation} />
      case 'jobRadar':
        return <JobRadarPanel panel={jobRadarPanel} updatedAt={jobRadarUpdatedAt} selectedItem={selectedItem} onSelect={setSelectedItem} />
      case 'newsletters':
        return <NewsletterPanel panel={newsletterPanel} updatedAt={newslettersUpdatedAt} selectedItem={selectedItem} onSelect={setSelectedItem} />
      case 'projects':
        return <ProjectRollupPanel panel={projectRollupPanel} />
    }
  }

  return (
    <>
    <div className="flex flex-col h-screen bg-mc-canvas text-mc-ink">
      {/* Titlebar */}
      <div className="flex items-center justify-between px-4 h-8 bg-mc-sidebar border-b border-mc-sidebar-border flex-shrink-0" style={{ paddingLeft: '80px' }}>
        <span className="text-mc-xs uppercase tracking-widest text-white/60">
          Mission Control <span className="text-white/30 mx-1.5">|</span> <span className="text-white/90">{PANEL_TITLES[activePanel]}</span>
        </span>
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
          <button
            onClick={handleGoogleReauth}
            className={`text-mc-xs font-bold uppercase px-2 py-0.5 rounded-mc-sm border focus:outline-none
              ${googleAuthed
                ? 'text-mc-d8 border-mc-D8-border bg-mc-D8-bg hover:brightness-110'
                : 'text-mc-error border-mc-error border-opacity-25 bg-mc-error bg-opacity-10 hover:bg-opacity-20'}`}
          >
            Gmail
          </button>
          <span className="text-mc-xs font-bold uppercase text-mc-egg bg-mc-egg-bg border border-mc-egg-border px-2 py-0.5 rounded-mc-sm">
            EGG
          </span>
        </div>
      </div>

      {/* Nav + canvas */}
      <div className="flex flex-1 overflow-hidden">
        <NavSidebar active={activePanel} onSelect={setActivePanel} onOpenSettings={() => setShowNotionSetup(true)} />
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 min-w-0">
            {renderActivePanel()}
          </div>
          {selectedItem && (
            <DetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} onTaskMutated={refreshAfterMutation} />
          )}
        </div>
      </div>
    </div>
    </>
  )
}

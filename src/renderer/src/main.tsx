import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Browser shim: provide window.api with mock data when running outside Electron
if (!window.api) {
  const MOCK_POLL = {
    calendar: [
      { id: 'evt-001', subject: 'D8 Standup', start: new Date(Date.now() + 30*60000).toISOString(), end: new Date(Date.now() + 60*60000).toISOString(), attendees: ['MJ', 'Connor', 'Priya'], webLink: '#' },
      { id: 'evt-002', subject: 'Q3 Strategy Review', start: new Date(Date.now() + 3*60*60000).toISOString(), end: new Date(Date.now() + 4*60*60000).toISOString(), attendees: ['MJ', 'Full team'], webLink: '#' },
      { id: 'evt-003', subject: '1:1 with MJ', start: new Date(Date.now() + 5*60*60000).toISOString(), end: new Date(Date.now() + 5.5*60*60000).toISOString(), attendees: ['MJ'], webLink: '#' },
    ],
    inbox: { outlookUnread: 12, outlookTopSubjects: [{ subject: 'RE: Q3 Plan — need your input', from: 'MJ' }, { subject: 'FW: Client feedback on Phase 1', from: 'Connor' }, { subject: 'RE: Sprint review notes', from: 'Priya' }], teamsUnread: 4 },
    d8Tasks: [
      { id: 'd8-1', title: 'Finalize Phase 1 delivery doc', priority: 'P1', status: 'In Progress', url: '#' },
      { id: 'd8-2', title: 'Review MJ feedback on prototype', priority: 'P1', status: 'Todo', url: '#' },
      { id: 'd8-3', title: 'Update sprint board', priority: 'P2', status: 'Todo', url: '#' },
    ],
    eggTasks: [
      { id: 'egg-1', title: 'Ship Mission Control MVP', priority: 'P1', status: 'In Progress', url: '#' },
      { id: 'egg-2', title: 'Update Linkit App to Claude 3.5', priority: 'P2', status: 'Todo', url: '#' },
      { id: 'egg-3', title: 'Write skill: design-consultation', priority: 'P2', status: 'Todo', url: '#' },
    ],
  }
  const noop = () => () => {}
  // @ts-expect-error browser shim for development preview
  window.api = {
    isNotionConfigured: () => Promise.resolve(true),
    getPollResult: () => Promise.resolve(MOCK_POLL),
    onPollUpdate: (cb: (r: typeof MOCK_POLL) => void) => { setTimeout(() => cb(MOCK_POLL), 100); return noop() },
    onAuthStateChange: noop,
    saveNotionToken: () => Promise.resolve({ ok: true }),
    validateNotionToken: () => Promise.resolve({ ok: true }),
    triggerReauth: () => Promise.resolve(),
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import type { PollResult } from './types'

// Browser shim: provide window.api with mock data when running outside Electron
if (!window.api) {
  const MOCK_POLL: PollResult = {
    calendar: [
      { id: 'evt-001', subject: 'D8 Standup', start: new Date(Date.now() + 30*60000).toISOString(), end: new Date(Date.now() + 60*60000).toISOString(), attendees: ['MJ', 'Connor', 'Priya'], webLink: '#', body: 'Agenda:\n1. Sprint blockers\n2. Phase 1 delivery status\n3. Client feedback review\n\nZoom link in calendar.', joinUrl: 'https://teams.microsoft.com/l/meetup-join/mock' },
      { id: 'evt-002', subject: 'Q3 Strategy Review', start: new Date(Date.now() + 3*60*60000).toISOString(), end: new Date(Date.now() + 4*60*60000).toISOString(), attendees: ['MJ', 'Full team'], webLink: '#', body: 'Review Q3 OKRs and adjust priorities based on Phase 1 outcomes. Bring updated delivery timelines.' },
      { id: 'evt-003', subject: '1:1 with MJ', start: new Date(Date.now() + 5*60*60000).toISOString(), end: new Date(Date.now() + 5.5*60*60000).toISOString(), attendees: ['MJ'], webLink: '#', body: 'Weekly sync. Topics: career growth, current project load, any blockers.' },
    ],
    inbox: {
      outlookUnread: 12,
      outlookTopSubjects: [{ subject: 'RE: Q3 Plan — need your input', from: 'MJ' }, { subject: 'FW: Client feedback on Phase 1', from: 'Connor' }, { subject: 'RE: Sprint review notes', from: 'Priya' }],
      teamsUnread: 4,
      recentChats: [
        { chatId: 'chat-1', from: 'MJ', preview: 'Can you send over the updated delivery doc before standup?', receivedAt: new Date(Date.now() - 15*60000).toISOString(), webUrl: '#' },
        { chatId: 'chat-2', from: 'Connor', preview: 'The client loved the prototype — they want to see Phase 2 scoped out this week.', receivedAt: new Date(Date.now() - 45*60000).toISOString(), webUrl: '#' },
        { chatId: 'chat-3', from: 'Priya', preview: 'Sprint board is updated. Moved 3 items to done.', receivedAt: new Date(Date.now() - 2*60*60000).toISOString(), webUrl: '#' },
      ],
    },
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
    bgcTasks: [
      { id: 'bgc-1', title: 'Finalize BGC Q3 marketing plan', priority: 'P1', status: 'In Progress', url: '#' },
      { id: 'bgc-2', title: 'BLD-001 Sensor case study', priority: 'P2', status: 'Todo', url: '#' },
    ],
    jobRadar: [
      { id: 'job-1', title: 'Director, Field Enablement', company: 'CoreWeave', location: 'San Francisco, CA', postedAgo: '3 hours ago', applicants: '<25 applicants', score: 75, reason: 'Director Field Enablement, CoreWeave AI cloud, remote', applyUrl: '#' },
      { id: 'job-2', title: 'Enterprise Sales Enablement Manager', company: 'Harvey', location: 'New York, United States', postedAgo: '53 minutes ago', applicants: '<25 applicants', score: 65, reason: 'Sales enablement mgr at AI legal company, remote', applyUrl: '#' },
      { id: 'job-3', title: 'Head of GTM Enablement', company: 'Nextiva', location: 'Scottsdale, AZ', postedAgo: '4 hours ago', applicants: '<25 applicants', score: 65, reason: 'Head of GTM Enablement, AI-powered CX platform, remote', applyUrl: '#' },
    ],
    jobRadarUpdatedAt: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
    newsletters: [
      { name: 'The Rundown', found: true, subject: "🎉 Anthropic's Fable 5 returns worldwide", sender: 'The Rundown AI <news@daily.therundown.ai>', summary: "• Anthropic restarts Fable 5: U.S. lifts export controls, model returns with tighter safety filters.\n• Meta preps cloud business: Meta plans to rent spare AI data center compute to outside developers.\n• Google's Design.md standard: New guide pairs Design.md with Claude Code for consistent site design." },
      { name: 'The Neuron', found: true, subject: '😹 Fable 5 first reviews', sender: 'The Neuron <theneuron@newsletter.theneurondaily.com>', summary: "• Fable 5 relaunch: Anthropic restored Fable 5 after export controls lifted, adding a cybersecurity classifier.\n• Meta cloud ambitions: Meta is reportedly getting serious about launching its own cloud business.\n• Together AI raises $800M: The funding will scale open-model infrastructure for AI developers." },
      { name: 'The Code', found: true, subject: '🚀 Cognition ships Devin for Security', sender: 'The Code <superhumancode@news.codenewsletter.ai>', summary: '• Cognition ships Devin Security Swarm: Parallel AI agents scan codebases for vulnerabilities and auto-generate patch PRs.\n• Meta reportedly building a cloud compute business: Drafting "Meta Compute" to compete with AWS, GCP, Azure.\n• Claude Sonnet 5\'s "cheaper" pricing is a mirage: New tokenizer makes it cost ~15% more per task than Opus 4.8.' },
    ],
    newslettersUpdatedAt: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
    gmail: [
      {
        email: 'gdogsjunk@gmail.com',
        unread: 7,
        topSubjects: [
          { subject: 'Your Amazon order has shipped', from: 'Amazon' },
          { subject: 'Reminder: dentist appointment tomorrow', from: 'Dr. Chen Office' },
          { subject: 'Weekly digest: 12 new stories', from: 'Substack' },
        ],
      },
      {
        email: 'gregg@buildgreatcourses.com',
        unread: 3,
        topSubjects: [
          { subject: 'Invoice #4521 paid', from: 'Stripe' },
          { subject: 'New client inquiry: onboarding program', from: 'Squarespace Forms' },
        ],
      },
    ],
  }
  const noop = () => () => {}
  window.api = {
    isNotionConfigured: () => Promise.resolve(true),
    getPollResult: () => Promise.resolve(MOCK_POLL),
    onPollUpdate: (cb: (r: PollResult) => void) => { setTimeout(() => cb(MOCK_POLL), 100); return noop() },
    onAuthStateChange: noop,
    saveNotionToken: () => Promise.resolve({ ok: true }),
    validateNotionToken: () => Promise.resolve({ ok: true }),
    triggerReauth: () => Promise.resolve(),
    isGoogleConfigured: () => Promise.resolve(true),
    getConnectedGoogleAccounts: () => Promise.resolve(['gdogsjunk@gmail.com', 'gregg@buildgreatcourses.com']),
    triggerGoogleReauth: () => Promise.resolve({ ok: true, email: 'gdogsjunk@gmail.com' }),
    completeTask: () => Promise.resolve({ ok: true }),
    archiveTask: () => Promise.resolve({ ok: true }),
    moveTask: () => Promise.resolve({ ok: true }),
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

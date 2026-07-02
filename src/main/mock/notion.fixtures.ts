import type { NotionTask, JobRadarEntry, NewsletterEntry } from '../../shared/ipc-types'

export const MOCK_D8_TASKS: NotionTask[] = [
  { id: 'd8-1', title: 'Finalize Phase 1 delivery doc', priority: 'P1', status: 'In Progress', url: 'https://notion.so/d8-1' },
  { id: 'd8-2', title: 'Review MJ feedback on prototype', priority: 'P1', status: 'Todo', url: 'https://notion.so/d8-2' },
  { id: 'd8-3', title: 'Update sprint board', priority: 'P2', status: 'Todo', url: 'https://notion.so/d8-3' },
  { id: 'd8-4', title: 'Draft retrospective notes', priority: 'P2', status: 'Todo', url: 'https://notion.so/d8-4' },
  { id: 'd8-5', title: 'Schedule Phase 2 kickoff', priority: 'P3', status: 'Todo', url: 'https://notion.so/d8-5' },
  { id: 'd8-6', title: 'Archive Phase 1 assets', priority: 'P3', status: 'Todo', url: 'https://notion.so/d8-6' },
]

export const MOCK_EGG_TASKS: NotionTask[] = [
  { id: 'egg-1', title: 'Ship Mission Control MVP', priority: 'P1', status: 'In Progress', url: 'https://notion.so/egg-1' },
  { id: 'egg-2', title: 'Update Linkit App to Claude 3.5', priority: 'P2', status: 'Todo', url: 'https://notion.so/egg-2' },
  { id: 'egg-3', title: 'Write skill: design-consultation', priority: 'P2', status: 'Todo', url: 'https://notion.so/egg-3' },
  { id: 'egg-4', title: 'Morning Brief latency fix', priority: 'P3', status: 'Todo', url: 'https://notion.so/egg-4' },
]

export const MOCK_BGC_TASKS: NotionTask[] = [
  { id: 'bgc-1', title: 'Finalize BGC Q3 marketing plan', priority: 'P1', status: 'In Progress', url: 'https://notion.so/bgc-1' },
  { id: 'bgc-2', title: 'BLD-001 Sensor case study', priority: 'P2', status: 'Todo', url: 'https://notion.so/bgc-2' },
]

export const MOCK_JOB_RADAR: JobRadarEntry[] = [
  {
    id: 'https://www.linkedin.com/jobs/view/mock-1',
    title: 'Director, Field Enablement',
    company: 'CoreWeave',
    location: 'San Francisco, CA',
    postedAgo: '3 hours ago',
    applicants: '<25 applicants',
    score: 75,
    reason: 'Director Field Enablement, CoreWeave AI cloud, remote',
    applyUrl: 'https://www.linkedin.com/jobs/view/mock-1',
  },
  {
    id: 'https://www.linkedin.com/jobs/view/mock-2',
    title: 'Enterprise Sales Enablement Manager',
    company: 'Harvey',
    location: 'New York, United States',
    postedAgo: '53 minutes ago',
    applicants: '<25 applicants',
    score: 65,
    reason: 'Sales enablement mgr at AI legal company, remote',
    applyUrl: 'https://www.linkedin.com/jobs/view/mock-2',
  },
]

export const MOCK_JOB_RADAR_UPDATED_AT = new Date(Date.now() - 3 * 60 * 60000).toISOString()

export const MOCK_NEWSLETTERS: NewsletterEntry[] = [
  {
    name: 'The Rundown',
    found: true,
    subject: "🎉 Anthropic's Fable 5 returns worldwide",
    sender: 'The Rundown AI <news@daily.therundown.ai>',
    summary: "• Anthropic restarts Fable 5 globally after US lifts export controls, with tighter filters\n• US government now gets pre-release access to Anthropic's future models before launch\n• Amazon researchers' security flaw findings prompted original 18-day shutdown of Fable 5",
  },
  {
    name: 'The Neuron',
    found: true,
    subject: '😹 Fable 5 first reviews',
    sender: 'The Neuron <theneuron@newsletter.theneurondaily.com>',
    summary: "• Anthropic's Fable 5 relaunched after government-forced shutdown, but defaults to Opus 4.8 for coding\n• Meta is aggressively building out a cloud business to compete in AI infrastructure\n• Together AI raised $800M to scale infrastructure for open-source AI models",
  },
  {
    name: 'TLDR',
    found: false,
  },
  {
    name: 'The Code',
    found: true,
    subject: '🚀 Cognition ships Devin for Security',
    sender: 'The Code <superhumancode@news.codenewsletter.ai>',
    summary: '• Cognition launches Devin for Security, an autonomous agent for vulnerability triage\n• Anthropic drops Claude Sonnet 5 with major coding benchmark gains\n• US companies increasingly adopting Chinese open-source models for cost reasons',
  },
]

export const MOCK_NEWSLETTERS_UPDATED_AT = new Date(Date.now() - 3 * 60 * 60000).toISOString()

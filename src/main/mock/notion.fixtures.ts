import type { NotionTask, JobRadarEntry, NewsletterEntry, ProjectRollupEntry } from '../../shared/ipc-types'

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

export const MOCK_PROJECT_ROLLUP: ProjectRollupEntry[] = [
  {
    tier: 'rich',
    id: 'd8-proj-1',
    workspace: 'D8',
    title: 'KCU Enablement',
    status: 'In Progress',
    nextAction: 'Confirm Track 2 session date with Scott',
    url: 'https://notion.so/d8-proj-1',
    lastEditedTime: new Date(Date.now() - 2 * 3600000).toISOString(),
    healthStatus: 'At Risk',
    healthOverride: null,
    risks: 'Track 2 infra dependency slipping — SME availability unconfirmed for next week.',
    nextGate: 'Track 2 Gate Review',
    gateDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    dependsOn: [],
    blocks: [],
  },
  {
    tier: 'light',
    id: 'bgc-proj-1',
    workspace: 'BGC',
    title: 'ODIN',
    status: 'In Progress',
    nextAction: 'Pick up from Gate 3 close',
    url: 'https://notion.so/bgc-proj-1',
    lastEditedTime: new Date(Date.now() - 26 * 3600000).toISOString(),
  },
  {
    tier: 'light',
    id: 'egg-proj-1',
    workspace: 'EGG',
    title: 'Egg_Mission_Control',
    status: 'In Progress',
    nextAction: 'Ship project rollup panel',
    url: 'https://notion.so/egg-proj-1',
    lastEditedTime: new Date(Date.now() - 1 * 3600000).toISOString(),
  },
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
    summary: "• Anthropic restarts Fable 5: U.S. lifts export controls, model returns with tighter safety filters and government pre-release access to future models.\n• Meta preps cloud business: Meta plans to rent spare AI data center compute to outside developers, boosting its stock 9.3%.\n• Google's Design.md standard: New guide shows how to pair Google's Design.md with Claude Code to generate consistent, non-generic website designs.",
  },
  {
    name: 'The Neuron',
    found: true,
    subject: '😹 Fable 5 first reviews',
    sender: 'The Neuron <theneuron@newsletter.theneurondaily.com>',
    summary: "• Fable 5 relaunch: Anthropic restored Claude's Fable 5 model after lifting government-driven export controls, adding a cybersecurity classifier that reroutes flagged coding requests to Opus 4.8.\n• Meta cloud ambitions: Meta is reportedly getting serious about launching its own cloud computing business.\n• Together AI raises $800M: The funding will scale open-model infrastructure for AI developers.",
  },
  {
    name: 'The Code',
    found: true,
    subject: '🚀 Cognition ships Devin for Security',
    sender: 'The Code <superhumancode@news.codenewsletter.ai>',
    summary: '• Cognition ships Devin Security Swarm: Parallel AI agents scan codebases for exploitable business logic flaws, verify them in sandboxes, and auto-generate patch PRs.\n• Meta reportedly building a cloud compute business: Meta is drafting "Meta Compute" to rent AI compute and host models, competing with AWS, Google Cloud, and Azure.\n• Claude Sonnet 5\'s "cheaper" pricing is a mirage: New tokenizer and heavier reasoning loops make Sonnet 5 cost ~15% more per task than Opus 4.8, despite flat token rates.',
  },
]

export const MOCK_NEWSLETTERS_UPDATED_AT = new Date(Date.now() - 3 * 60 * 60000).toISOString()

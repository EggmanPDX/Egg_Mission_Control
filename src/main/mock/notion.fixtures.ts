import type { NotionTask, JobRadarEntry } from '../../shared/ipc-types'

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

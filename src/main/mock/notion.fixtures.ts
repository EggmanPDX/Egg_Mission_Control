import type { NotionTask } from '../../shared/ipc-types'

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

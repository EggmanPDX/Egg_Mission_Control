import type { PollResult } from '../../shared/ipc-types'
import { MOCK_CALENDAR, MOCK_INBOX } from './graph.fixtures'
import { MOCK_D8_TASKS, MOCK_EGG_TASKS } from './notion.fixtures'

export function getMockPollResult(): PollResult {
  return {
    calendar: MOCK_CALENDAR,
    inbox: MOCK_INBOX,
    d8Tasks: MOCK_D8_TASKS,
    eggTasks: MOCK_EGG_TASKS,
  }
}

export const MOCK_MODE = process.env.MISSION_CONTROL_MOCK === 'true'

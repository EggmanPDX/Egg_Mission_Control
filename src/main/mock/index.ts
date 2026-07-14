import type { PollResult } from '../../shared/ipc-types'
import { MOCK_CALENDAR, MOCK_INBOX, MOCK_GMAIL } from './graph.fixtures'
import { MOCK_D8_TASKS, MOCK_EGG_TASKS, MOCK_BGC_TASKS, MOCK_JOB_RADAR, MOCK_JOB_RADAR_UPDATED_AT, MOCK_NEWSLETTERS, MOCK_NEWSLETTERS_UPDATED_AT, MOCK_PROJECT_ROLLUP } from './notion.fixtures'

export function getMockPollResult(): PollResult {
  return {
    calendar: MOCK_CALENDAR,
    inbox: MOCK_INBOX,
    d8Tasks: MOCK_D8_TASKS,
    eggTasks: MOCK_EGG_TASKS,
    bgcTasks: MOCK_BGC_TASKS,
    jobRadar: MOCK_JOB_RADAR,
    jobRadarUpdatedAt: MOCK_JOB_RADAR_UPDATED_AT,
    newsletters: MOCK_NEWSLETTERS,
    newslettersUpdatedAt: MOCK_NEWSLETTERS_UPDATED_AT,
    gmail: MOCK_GMAIL,
    projectRollup: MOCK_PROJECT_ROLLUP,
  }
}

export const MOCK_MODE = process.env.MISSION_CONTROL_MOCK === 'true'

import { describe, it, expect } from 'vitest'
import { deriveHealthStatus } from '../src/main/notion.service'

describe('deriveHealthStatus', () => {
  it('manual override always wins, even over a past gate date', () => {
    expect(
      deriveHealthStatus({
        status: 'Blocked',
        gateDate: '2020-01-01',
        healthOverride: 'On Track',
        blockingDeps: [{ status: 'To-do' }],
      })
    ).toBe('On Track')
  })

  it('Blocked status derives to At Risk with no override', () => {
    expect(
      deriveHealthStatus({ status: 'Blocked', gateDate: null, healthOverride: null, blockingDeps: [] })
    ).toBe('At Risk')
  })

  it('a past gate date on a non-Done project derives to Off Track', () => {
    expect(
      deriveHealthStatus({
        status: 'In Progress',
        gateDate: '2020-01-01',
        healthOverride: null,
        blockingDeps: [],
      })
    ).toBe('Off Track')
  })

  it('a past gate date on a Done project does not derive to Off Track', () => {
    expect(
      deriveHealthStatus({ status: 'Done', gateDate: '2020-01-01', healthOverride: null, blockingDeps: [] })
    ).toBe('On Track')
  })

  it('an incomplete blocking dependency derives to At Risk', () => {
    expect(
      deriveHealthStatus({
        status: 'In Progress',
        gateDate: null,
        healthOverride: null,
        blockingDeps: [{ status: 'In Progress' }],
      })
    ).toBe('At Risk')
  })

  it('defaults to On Track with nothing else in play', () => {
    expect(
      deriveHealthStatus({ status: 'To-do', gateDate: null, healthOverride: null, blockingDeps: [] })
    ).toBe('On Track')
  })
})

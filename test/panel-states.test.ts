import { describe, it, expect } from 'vitest'
import type { PanelState } from '../src/renderer/src/types'

describe('PanelState type guard helpers', () => {
  it('loading state has no data', () => {
    const p: PanelState<string[]> = { status: { state: 'loading' }, data: null }
    expect(p.status.state).toBe('loading')
    expect(p.data).toBeNull()
  })

  it('ok state carries data', () => {
    const p: PanelState<string[]> = { status: { state: 'ok' }, data: ['a', 'b'] }
    expect(p.data).toEqual(['a', 'b'])
  })

  it('stale state carries lastUpdated', () => {
    const d = new Date()
    const p: PanelState<string[]> = { status: { state: 'stale', lastUpdated: d }, data: ['x'] }
    expect(p.status.state).toBe('stale')
    if (p.status.state === 'stale') {
      expect(p.status.lastUpdated).toBe(d)
    }
  })

  it('not-configured state has no data', () => {
    const p: PanelState<unknown[]> = { status: { state: 'not-configured' }, data: null }
    expect(p.status.state).toBe('not-configured')
  })
})

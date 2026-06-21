import { describe, it, expect } from 'vitest'

function mapPriority(priorityValue: unknown): 'P1' | 'P2' | 'P3' | null {
  if (typeof priorityValue === 'string') {
    if (priorityValue === 'P1' || priorityValue === 'P2' || priorityValue === 'P3') {
      return priorityValue
    }
  }
  return null
}

describe('notion priority mapping', () => {
  it('maps valid P1, P2, P3 values correctly', () => {
    expect(mapPriority('P1')).toBe('P1')
    expect(mapPriority('P2')).toBe('P2')
    expect(mapPriority('P3')).toBe('P3')
  })

  it('returns null for invalid priority like "High"', () => {
    expect(mapPriority('High')).toBe(null)
    expect(mapPriority('Low')).toBe(null)
    expect(mapPriority('Medium')).toBe(null)
  })

  it('returns null for non-string values', () => {
    expect(mapPriority(null)).toBe(null)
    expect(mapPriority(undefined)).toBe(null)
    expect(mapPriority(123)).toBe(null)
    expect(mapPriority({})).toBe(null)
  })
})

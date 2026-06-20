import { describe, it, expect } from 'vitest'

// We can't test safeStorage in a unit context (it requires Electron main process).
// Test the pure logic: callback URL parsing.

describe('auth callback URL parsing', () => {
  it('extracts code from callback URL', () => {
    const url = new URL('missioncontrol://auth?code=abc123&session_state=xyz')
    expect(url.searchParams.get('code')).toBe('abc123')
  })

  it('returns null for URL with no code', () => {
    const url = new URL('missioncontrol://auth?error=access_denied')
    expect(url.searchParams.get('code')).toBeNull()
  })
})

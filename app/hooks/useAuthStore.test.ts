import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './useAuthStore'

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state manually if needed, but Zustand stores persist in memory
    // during tests unless cleared.
    useAuthStore.getState().setSession(null)
  })

  it('initializes with null session', () => {
    const state = useAuthStore.getState()
    expect(state.session).toBeNull()
    expect(state.hydrated).toBe(false)
  })

  it('updates session', () => {
    const mockSession = { user: { id: '123' }, access_token: 'abc' } as any
    useAuthStore.getState().setSession(mockSession)
    expect(useAuthStore.getState().session).toEqual(mockSession)
  })

  it('sets hydrated state', () => {
    useAuthStore.getState().setHydrated()
    expect(useAuthStore.getState().hydrated).toBe(true)
  })
})

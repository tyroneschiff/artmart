import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'

type AuthStore = {
  session: Session | null
  hydrated: boolean
  setSession: (session: Session | null) => void
  setHydrated: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  hydrated: false,
  setSession: (session) => set({ session }),
  setHydrated: () => set({ hydrated: true }),
}))

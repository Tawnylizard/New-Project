import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Plan } from '@klyovo/shared'

interface AppUser {
  id: string
  displayName: string
  plan: Plan
  planExpiresAt: string | null
  referralCode: string
}

interface AppState {
  token: string | null
  user: AppUser | null
  isLoading: boolean

  setAuth: (token: string, user: AppUser) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  updateUser: (user: Partial<AppUser>) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,

      setAuth: (token, user) => set({ token, user }),

      logout: () => set({ token: null, user: null }),

      setLoading: loading => set({ isLoading: loading }),

      updateUser: partial => {
        const current = get().user
        if (current) set({ user: { ...current, ...partial } })
      }
    }),
    {
      name: 'klyovo-auth',
      partialize: state => ({ token: state.token, user: state.user })
    }
  )
)

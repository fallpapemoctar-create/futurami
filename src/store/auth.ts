import { create } from 'zustand'

export interface AuthUser {
  id: string
  username: string
  prenom: string
  nom: string
  fullName: string
  isAdmin: boolean
  canManageInterpreters: boolean
  canManageMissions: boolean
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  setAuth: (user: AuthUser, token: string) => void
  logout: () => void
}

function loadStored(): Pick<AuthState, 'user' | 'token'> {
  try {
    const u = localStorage.getItem('ami_user')
    const t = localStorage.getItem('ami_token')
    return { user: u ? JSON.parse(u) : null, token: t }
  } catch {
    return { user: null, token: null }
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadStored(),
  setAuth: (user, token) => {
    localStorage.setItem('ami_user', JSON.stringify(user))
    localStorage.setItem('ami_token', token)
    set({ user, token })
  },
  logout: () => {
    localStorage.removeItem('ami_user')
    localStorage.removeItem('ami_token')
    set({ user: null, token: null })
  },
}))

import { useEffect, useState } from 'react'
import { api } from '../api'

export interface GoogleUser {
  email: string
  name: string
}

export function useGoogleAuth() {
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    localStorage.removeItem('firebase-google-sheets-auth')
    api<GoogleUser | null>('session')
      .then(setUser)
      .catch(() => setError('Could not load your session.'))
      .finally(() => setReady(true))
  }, [])
  return {
    ready,
    user,
    error,
    signIn: () => location.assign('/auth/login'),
    signOut: async () => {
      try {
        await api('logout', {})
        location.reload()
      } catch {
        setError('Could not sign out. Please try again.')
      }
    },
  }
}

import { useEffect, useState } from 'react'
import { api } from '../api'
import { setQueryUser } from '../queryClient'

export interface GoogleUser {
  email: string
  name: string
}

export function useGoogleAuth() {
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api<GoogleUser | null>('session')
      .then((profile) => {
        setQueryUser(profile?.email ?? null)
        setUser(profile)
      })
      .catch(() => setError('Could not load your session.'))
      .finally(() => setReady(true))
  }, [])
  return {
    ready,
    user,
    error,
    signIn: () => location.assign('/auth/login?' + new URLSearchParams({ returnTo: location.search })),
    signOut: async () => {
      try {
        await api('logout', {})
        setQueryUser(null)
        location.reload()
      } catch {
        setError('Could not sign out. Please try again.')
      }
    },
  }
}

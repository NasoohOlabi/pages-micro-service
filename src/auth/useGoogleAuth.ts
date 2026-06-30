import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '../config'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const GAPI_SRC = 'https://apis.google.com/js/api.js'
const SCOPES =
  'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email'

export interface GoogleUser {
  email: string
  name: string
}

interface UseGoogleAuthResult {
  ready: boolean
  user: GoogleUser | null
  accessToken: string | null
  error: string | null
  signIn: () => void
  signOut: () => void
}

const STORAGE_KEY = 'google-auth'
const REFRESH_MARGIN_MS = 5 * 60 * 1000

interface StoredAuth {
  accessToken: string
  user: GoogleUser
  expiresAt: number
}

function loadStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredAuth
    if (!stored.accessToken || !stored.expiresAt) return null
    return stored
  } catch {
    return null
  }
}

function saveStoredAuth(stored: StoredAuth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

const scriptPromises = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  const cached = scriptPromises.get(src)
  if (cached) return cached

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
  scriptPromises.set(src, promise)
  return promise
}

async function fetchUserInfo(accessToken: string): Promise<GoogleUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch user info')
  const data = await res.json()
  return { email: data.email, name: data.name ?? data.email }
}

export function useGoogleAuth(): UseGoogleAuthResult {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tokenClientRef = useRef<ReturnType<
    Window['google']['accounts']['oauth2']['initTokenClient']
  > | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const delay = Math.max(expiresAt - Date.now() - REFRESH_MARGIN_MS, 0)
    refreshTimerRef.current = setTimeout(() => {
      tokenClientRef.current?.requestAccessToken({ prompt: '' })
    }, delay)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        await Promise.all([loadScript(GIS_SRC), loadScript(GAPI_SRC)])
        await new Promise<void>((resolve) => window.gapi.load('client', () => resolve()))
        await window.gapi.client.init({})
        await window.gapi.client.load('sheets', 'v4')

        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: config.googleClientId,
          scope: SCOPES,
          callback: async (response) => {
            if (response.error || !response.access_token) {
              setError('Sign-in failed or was cancelled.')
              return
            }
            window.gapi.client.setToken({ access_token: response.access_token })
            setAccessToken(response.access_token)
            const expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000
            try {
              const profile = await fetchUserInfo(response.access_token)
              setUser(profile)
              saveStoredAuth({ accessToken: response.access_token, user: profile, expiresAt })
              scheduleRefresh(expiresAt)
            } catch {
              setError('Signed in, but could not load your profile.')
            }
          },
        })

        if (!cancelled) setReady(true)

        const stored = loadStoredAuth()
        if (stored && !cancelled) {
          window.gapi.client.setToken({ access_token: stored.accessToken })
          setAccessToken(stored.accessToken)
          setUser(stored.user)
          if (stored.expiresAt - REFRESH_MARGIN_MS <= Date.now()) {
            tokenClientRef.current?.requestAccessToken({ prompt: '' })
          } else {
            scheduleRefresh(stored.expiresAt)
          }
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load Google sign-in. Check your connection and try again.')
        }
      }
    }

    init()
    return () => {
      cancelled = true
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [scheduleRefresh])

  const signIn = useCallback(() => {
    setError(null)
    tokenClientRef.current?.requestAccessToken({ prompt: '' })
  }, [])

  const signOut = useCallback(() => {
    if (accessToken) {
      window.google.accounts.oauth2.revoke(accessToken)
      window.gapi.client.setToken(null)
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    clearStoredAuth()
    setAccessToken(null)
    setUser(null)
  }, [accessToken])

  return { ready, user, accessToken, error, signIn, signOut }
}

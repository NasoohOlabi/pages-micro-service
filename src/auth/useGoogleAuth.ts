import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '../config'
import { registerTokenRefresher } from './token'
import { useLocale } from '../i18n/LocaleContext'

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
type TokenRequestMode = 'interactive' | 'silent'

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

// A stored token is only usable if it still has comfortable life left. An
// expired (or about-to-expire) token must not be handed to the Sheets client —
// doing so produces 401s until the silent refresh lands.
function isTokenLive(stored: StoredAuth): boolean {
  return stored.expiresAt - REFRESH_MARGIN_MS > Date.now()
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
  const { t } = useLocale()
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<GoogleUser | null>(() => loadStoredAuth()?.user ?? null)
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const stored = loadStoredAuth()
    return stored && isTokenLive(stored) ? stored.accessToken : null
  })
  const [error, setError] = useState<string | null>(null)
  const tokenClientRef = useRef<ReturnType<
    Window['google']['accounts']['oauth2']['initTokenClient']
  > | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenRequestModeRef = useRef<TokenRequestMode>('silent')
  // Resolvers waiting on the next requestAccessToken callback (used by the 401
  // retry path so a Sheets call can await a fresh token before retrying).
  const tokenWaitersRef = useRef<Array<{ resolve: () => void; reject: (e: unknown) => void }>>([])

  const settleTokenWaiters = useCallback((err?: unknown) => {
    const waiters = tokenWaitersRef.current
    tokenWaitersRef.current = []
    for (const waiter of waiters) {
      if (err) waiter.reject(err)
      else waiter.resolve()
    }
  }, [])

  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const delay = Math.max(expiresAt - Date.now() - REFRESH_MARGIN_MS, 0)
    refreshTimerRef.current = setTimeout(() => {
      tokenRequestModeRef.current = 'silent'
      tokenClientRef.current?.requestAccessToken({ prompt: '' })
    }, delay)
  }, [])

  const handleTokenFailure = useCallback(
    (err: unknown) => {
      if (tokenRequestModeRef.current === 'interactive') {
        setError(t('signInFailed'))
      }
      setAccessToken(null)
      window.gapi.client.setToken(null)
      settleTokenWaiters(err)
    },
    [settleTokenWaiters, t],
  )

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
            console.info('[auth] token callback', {
              error: response.error,
              hasToken: !!response.access_token,
              expiresIn: response.expires_in,
              scope: response.scope,
            })
            if (response.error || !response.access_token) {
              handleTokenFailure(new Error(response.error ?? 'no access token'))
              return
            }
            window.gapi.client.setToken({ access_token: response.access_token })
            setError(null)
            setAccessToken(response.access_token)
            const expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000
            // The token is live now — unblock any 401 retry waiting on it before
            // the (slower) profile fetch.
            settleTokenWaiters()
            scheduleRefresh(expiresAt)
            try {
              const profile = await fetchUserInfo(response.access_token)
              setUser(profile)
              saveStoredAuth({ accessToken: response.access_token, user: profile, expiresAt })
            } catch {
              // On a silent refresh we already have the user; reuse it so a
              // transient userinfo hiccup doesn't drop the session.
              const existing = loadStoredAuth()?.user
              if (existing) {
                saveStoredAuth({ accessToken: response.access_token, user: existing, expiresAt })
              } else {
                setError(t('signedInProfileError'))
              }
            }
          },
          error_callback: (err) => {
            console.warn('[auth] token request failed', err)
            handleTokenFailure(new Error(err.message ?? err.type ?? 'token request failed'))
          },
        })

        registerTokenRefresher(
          () =>
            new Promise<void>((resolve, reject) => {
              if (!tokenClientRef.current) {
                console.error('[auth] refresher called but token client not ready')
                reject(new Error('Token client not ready'))
                return
              }
              console.info('[auth] refresher requesting new access token (prompt: "")')
              tokenWaitersRef.current.push({ resolve, reject })
              tokenRequestModeRef.current = 'silent'
              tokenClientRef.current.requestAccessToken({ prompt: '' })
            }),
        )

        if (!cancelled) setReady(true)

        const stored = loadStoredAuth()
        console.info('[auth] init complete', {
          hasStored: !!stored,
          tokenLive: stored ? isTokenLive(stored) : null,
          expiresAt: stored ? new Date(stored.expiresAt).toISOString() : null,
          now: new Date().toISOString(),
        })
        if (stored && !cancelled) {
          // Show the user optimistically either way (skip the login flash).
          setUser(stored.user)
          if (isTokenLive(stored)) {
            console.info('[auth] reusing stored token (will self-heal via 401 retry if rejected)')
            window.gapi.client.setToken({ access_token: stored.accessToken })
            setAccessToken(stored.accessToken)
            scheduleRefresh(stored.expiresAt)
          } else {
            // Don't install the stale token — refresh silently and let the
            // callback set both the client token and accessToken once it lands.
            // Until then accessToken stays null so no Sheets call fires (401).
            console.info('[auth] stored token expired — requesting fresh token on load')
            tokenRequestModeRef.current = 'silent'
            tokenClientRef.current?.requestAccessToken({ prompt: '' })
          }
        }
      } catch (err) {
        console.error('[auth] init failed', err)
        if (!cancelled) {
          setError(t('googleLoadError'))
        }
      }
    }

    init()
    return () => {
      cancelled = true
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      settleTokenWaiters(new Error('Auth unmounted'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleRefresh])

  const signIn = useCallback(() => {
    setError(null)
    tokenRequestModeRef.current = 'interactive'
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

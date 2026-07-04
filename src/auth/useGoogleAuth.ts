import { useCallback, useEffect, useRef, useState } from 'react'
import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { config } from '../config'
import { registerTokenRefresher } from './token'
import { useLocale } from '../i18n/LocaleContext'

const GAPI_SRC = 'https://apis.google.com/js/api.js'
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const STORAGE_KEY = 'firebase-google-sheets-auth'
// Google access tokens live ~1h; used only when GIS omits expires_in.
const FALLBACK_TTL_MS = 55 * 60 * 1000
const REFRESH_MARGIN_MS = 5 * 60 * 1000

const firebaseApp = initializeApp(config.firebase)
const auth = getAuth(firebaseApp)
// Firebase owns the persisted *identity*; the Sheets access token comes from GIS
// (see below) because Firebase can't silently refresh a provider access token.
const googleProvider = new GoogleAuthProvider()
googleProvider.addScope(SHEETS_SCOPE)

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

interface TokenResult {
  token: string
  expiresAt: number
}

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
    if (!stored.accessToken || !stored.expiresAt || !stored.user?.email) return null
    return stored
  } catch {
    return null
  }
}

function isTokenLive(stored: StoredAuth): boolean {
  return stored.expiresAt - REFRESH_MARGIN_MS > Date.now()
}

function saveStoredAuth(stored: StoredAuth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

function toGoogleUser(firebaseUser: User): GoogleUser {
  const email = firebaseUser.email ?? ''
  return {
    email,
    name: firebaseUser.displayName ?? email,
  }
}

const scriptPromises = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  const cached = scriptPromises.get(src)
  if (cached) return cached

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), {
        once: true,
      })
      return
    }

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

async function initGapi() {
  await loadScript(GAPI_SRC)
  await new Promise<void>((resolve) => window.gapi.load('client', () => resolve()))
  await window.gapi.client.init({})
  await window.gapi.client.load('sheets', 'v4')
}

// A single GIS token client fronts every access-token request. Its callbacks are
// static, so we route each request's result to the current promise via these refs.
let tokenClient: TokenClient | null = null
let settleResolve: ((result: TokenResult) => void) | null = null
let settleReject: ((error: Error) => void) | null = null

function settle(result: TokenResult | null, error?: Error) {
  const resolve = settleResolve
  const reject = settleReject
  settleResolve = null
  settleReject = null
  if (result) resolve?.(result)
  else reject?.(error ?? new Error('Token request failed'))
}

async function initGis() {
  await loadScript(GIS_SRC)
  if (tokenClient) return
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: config.googleClientId,
    scope: SHEETS_SCOPE,
    callback: (response) => {
      if (response.error || !response.access_token) {
        settle(null, new Error(response.error ?? 'Missing Google access token'))
        return
      }
      const ttl = response.expires_in ? response.expires_in * 1000 : FALLBACK_TTL_MS
      settle({ token: response.access_token, expiresAt: Date.now() + ttl })
    },
    error_callback: (err) => settle(null, new Error(err.type ?? 'Token request failed')),
  })
}

// interactive=false → `prompt: ''`: reuse the existing Google session with no UI
// (silent refresh). interactive=true → show consent, needed for the first grant.
function requestSheetsToken(interactive: boolean, hint?: string): Promise<TokenResult> {
  return new Promise<TokenResult>((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('GIS token client not ready'))
      return
    }
    settle(null, new Error('Superseded by a newer token request'))
    settleResolve = resolve
    settleReject = reject
    tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '', hint })
  })
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
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userRef = useRef<User | null>(null)
  const installTokenRef = useRef<(result: TokenResult, profile: GoogleUser) => void>(() => {})

  const clearToken = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    window.gapi?.client?.setToken(null)
    clearStoredAuth()
    setAccessToken(null)
  }, [])

  // Silently mint a fresh Sheets token for the current Firebase user — no popup.
  const silentRefresh = useCallback(async () => {
    const firebaseUser = userRef.current
    if (!firebaseUser) throw new Error('No Firebase user')
    const result = await requestSheetsToken(false, firebaseUser.email ?? undefined)
    installTokenRef.current(result, toGoogleUser(firebaseUser))
  }, [])

  const scheduleTokenRefresh = useCallback(
    (expiresAt: number) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      const delay = Math.max(expiresAt - Date.now() - REFRESH_MARGIN_MS, 0)
      refreshTimerRef.current = setTimeout(() => {
        silentRefresh().catch((err) => {
          console.warn('[auth] silent token refresh failed', err)
          clearToken()
        })
      }, delay)
    },
    [silentRefresh, clearToken],
  )

  const installToken = useCallback(
    (result: TokenResult, profile: GoogleUser) => {
      window.gapi.client.setToken({ access_token: result.token })
      setUser(profile)
      setAccessToken(result.token)
      setError(null)
      saveStoredAuth({ accessToken: result.token, user: profile, expiresAt: result.expiresAt })
      scheduleTokenRefresh(result.expiresAt)
    },
    [scheduleTokenRefresh],
  )

  // Keep the ref pointed at the latest installToken so the stable silentRefresh can call it.
  useEffect(() => {
    installTokenRef.current = installToken
  }, [installToken])

  useEffect(() => {
    let cancelled = false
    let unsubscribe = () => {}

    async function init() {
      try {
        await Promise.all([initGapi(), initGis(), setPersistence(auth, browserLocalPersistence)])
        if (cancelled) return

        // A rejected Sheets call refreshes the token silently and retries — no popup.
        registerTokenRefresher(async () => {
          await silentRefresh()
        })

        unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (cancelled) return
          userRef.current = firebaseUser

          if (!firebaseUser) {
            clearToken()
            setUser(null)
            setReady(true)
            return
          }

          const profile = toGoogleUser(firebaseUser)
          setUser(profile)
          setReady(true)

          const stored = loadStoredAuth()
          if (stored && stored.user.email === profile.email && isTokenLive(stored)) {
            window.gapi.client.setToken({ access_token: stored.accessToken })
            setAccessToken(stored.accessToken)
            scheduleTokenRefresh(stored.expiresAt)
          } else {
            // Persisted identity but no live token — recover it silently.
            silentRefresh().catch((err) => {
              console.info('[auth] silent token acquisition failed; interactive sign-in needed', err)
              clearToken()
            })
          }
        })
      } catch (err) {
        console.error('[auth] init failed', err)
        if (!cancelled) setError(t('googleLoadError'))
      }
    }

    init()
    return () => {
      cancelled = true
      unsubscribe()
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [clearToken, silentRefresh, scheduleTokenRefresh, t])

  const signIn = useCallback(() => {
    setError(null)
    ;(async () => {
      let firebaseUser = userRef.current
      if (!firebaseUser) {
        const result = await signInWithPopup(auth, googleProvider)
        firebaseUser = result.user
        userRef.current = firebaseUser
        // The Firebase popup already granted the Sheets scope — use that token so the
        // first sign-in stays a single popup. Later refreshes go through GIS silently.
        const credential = GoogleAuthProvider.credentialFromResult(result)
        if (credential?.accessToken) {
          installToken(
            { token: credential.accessToken, expiresAt: Date.now() + FALLBACK_TTL_MS },
            toGoogleUser(firebaseUser),
          )
          return
        }
      }
      const tokenResult = await requestSheetsToken(true, firebaseUser.email ?? undefined)
      installToken(tokenResult, toGoogleUser(firebaseUser))
    })().catch((err) => {
      console.warn('[auth] sign-in failed', err)
      setError(t('signInFailed'))
    })
  }, [installToken, t])

  const signOut = useCallback(() => {
    firebaseSignOut(auth).catch((err) => console.warn('[auth] firebase sign-out failed', err))
    clearToken()
    setUser(null)
  }, [clearToken])

  return { ready, user, accessToken, error, signIn, signOut }
}

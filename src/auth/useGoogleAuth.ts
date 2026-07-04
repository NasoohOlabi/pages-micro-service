import { useCallback, useEffect, useRef, useState } from 'react'
import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithPopup,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { config } from '../config'
import { registerTokenRefresher } from './token'
import { useLocale } from '../i18n/LocaleContext'

const GAPI_SRC = 'https://apis.google.com/js/api.js'
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const STORAGE_KEY = 'firebase-google-sheets-auth'
const TOKEN_TTL_MS = 55 * 60 * 1000
const REFRESH_MARGIN_MS = 5 * 60 * 1000

const firebaseApp = initializeApp(config.firebase)
const auth = getAuth(firebaseApp)
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

  const clearToken = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    window.gapi?.client?.setToken(null)
    clearStoredAuth()
    setAccessToken(null)
  }, [])

  const scheduleTokenExpiry = useCallback(
    (expiresAt: number) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      const delay = Math.max(expiresAt - Date.now() - REFRESH_MARGIN_MS, 0)
      refreshTimerRef.current = setTimeout(clearToken, delay)
    },
    [clearToken],
  )

  const installAccessToken = useCallback(
    (token: string, firebaseUser: User) => {
      const profile = toGoogleUser(firebaseUser)
      const expiresAt = Date.now() + TOKEN_TTL_MS
      window.gapi.client.setToken({ access_token: token })
      setUser(profile)
      setAccessToken(token)
      setError(null)
      saveStoredAuth({ accessToken: token, user: profile, expiresAt })
      scheduleTokenExpiry(expiresAt)
    },
    [scheduleTokenExpiry],
  )

  const getTokenFromPopup = useCallback(
    async (firebaseUser?: User) => {
      const result = firebaseUser
        ? await reauthenticateWithPopup(firebaseUser, googleProvider)
        : await signInWithPopup(auth, googleProvider)
      const credential = GoogleAuthProvider.credentialFromResult(result)
      if (!credential?.accessToken) throw new Error('Missing Google access token')
      installAccessToken(credential.accessToken, result.user)
    },
    [installAccessToken],
  )

  useEffect(() => {
    let cancelled = false
    let unsubscribe = () => {}

    async function init() {
      try {
        await Promise.all([initGapi(), setPersistence(auth, browserLocalPersistence)])
        if (cancelled) return

        registerTokenRefresher(async () => {
          if (!userRef.current) throw new Error('No Firebase user')
          await getTokenFromPopup(userRef.current)
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

          const stored = loadStoredAuth()
          if (stored && stored.user.email === profile.email && isTokenLive(stored)) {
            window.gapi.client.setToken({ access_token: stored.accessToken })
            setAccessToken(stored.accessToken)
            scheduleTokenExpiry(stored.expiresAt)
          } else {
            clearToken()
          }
          setReady(true)
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
  }, [clearToken, getTokenFromPopup, scheduleTokenExpiry, t])

  const signIn = useCallback(() => {
    setError(null)
    getTokenFromPopup(userRef.current ?? undefined).catch((err) => {
      console.warn('[auth] firebase sign-in failed', err)
      setError(t('signInFailed'))
    })
  }, [getTokenFromPopup, t])

  const signOut = useCallback(() => {
    firebaseSignOut(auth).catch((err) => console.warn('[auth] firebase sign-out failed', err))
    clearToken()
    setUser(null)
  }, [clearToken])

  return { ready, user, accessToken, error, signIn, signOut }
}

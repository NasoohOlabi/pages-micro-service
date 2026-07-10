// Token-refresh registry shared between the auth hook and the Sheets clients.
//
// A stored access token's `expiresAt` is only a hint: a token can be revoked or
// otherwise rejected by Google while its recorded expiry is still in the future.
// The server is the source of truth, so when a Sheets call comes back 401
// (invalid/expired credentials) we refresh the token once and retry.

type Refresher = () => Promise<void>

let refresher: Refresher | null = null
let refreshPromise: Promise<void> | null = null

export function registerTokenRefresher(fn: Refresher) {
  console.debug('[auth] token refresher registered')
  refresher = fn
}

function refreshToken(): Promise<void> {
  if (!refresher) return Promise.reject(new Error('No token refresher is registered'))
  if (!refreshPromise) {
    refreshPromise = refresher().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

function errorCode(err: unknown): number | undefined {
  const e = err as { status?: number; result?: { error?: { code?: number } } }
  return e?.status ?? e?.result?.error?.code
}

// Pull out whatever Google actually told us so a 401 isn't a black box.
function describeError(err: unknown) {
  const e = err as {
    status?: number
    statusText?: string
    result?: { error?: { code?: number; status?: string; message?: string } }
    body?: string
  }
  return {
    code: errorCode(err),
    status: e?.status,
    statusText: e?.statusText,
    apiStatus: e?.result?.error?.status,
    message: e?.result?.error?.message,
    body: e?.body,
  }
}

export async function withTokenRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const code = errorCode(err)
    console.warn('[auth] sheets call failed', describeError(err), err)
    if (code === 401 && refresher) {
      console.info('[auth] 401 — refreshing token and retrying once')
      try {
        await refreshToken()
      } catch (refreshErr) {
        console.error('[auth] token refresh failed; cannot retry', refreshErr)
        throw err
      }
      console.info('[auth] token refreshed — retrying the sheets call')
      return await fn()
    }
    if (code === 401 && !refresher) {
      console.error('[auth] got 401 but no token refresher is registered')
    }
    throw err
  }
}

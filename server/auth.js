import { Database } from 'bun:sqlite'
import { createHash, randomBytes } from 'node:crypto'
import { join } from 'node:path'

export const origin = process.env.APP_ORIGIN || 'http://localhost:5173'
const redirect = origin + '/auth/callback'
const client = { client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET }
const sessionMaxAge = 400 * 86400
const sessionRenewalAge = 30 * 86400 * 1000
const db = new Database(join(process.env.RAILWAY_VOLUME_MOUNT_PATH || '.', 'sessions.sqlite'), {
  create: true,
})
db.exec(
  'CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, profile TEXT, token TEXT, refresh TEXT, expiry INTEGER, deadline INTEGER)',
)
const hash = (value) => createHash('sha256').update(value).digest('hex')
const nonce = () => randomBytes(32).toString('base64url')
const cookie = (name, value, ttl) =>
  name +
  '=' +
  value +
  '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' +
  ttl +
  (origin.startsWith('https:') ? '; Secure' : '')
const cookies = (req) => new Bun.CookieMap(req.headers.get('cookie') || '')
function home(req, headers) {
  const saved = cookies(req).get('returnTo') ?? ''
  const query = new URLSearchParams(saved).toString()
  const response = new Response(null, {
    status: 303,
    headers: { location: query ? '/?' + query : '/', ...headers },
  })
  response.headers.append('set-cookie', cookie('returnTo', '', 0))
  response.headers.append('set-cookie', cookie('flow', '', 0))
  return response
}

export function login(returnTo) {
  const state = nonce()
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: redirect,
    response_type: 'code',
    state,
    scope: 'openid email profile https://www.googleapis.com/auth/spreadsheets',
    access_type: 'offline',
    prompt: 'consent',
  })
  const response = new Response(null, {
    status: 302,
    headers: { location: url.href, 'set-cookie': cookie('flow', state, 600) },
  })
  response.headers.append(
    'set-cookie',
    cookie('returnTo', encodeURIComponent(returnTo?.slice(0, 1500) ?? ''), 600),
  )
  return response
}

async function exchange(fields) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ ...client, ...fields }),
  })
  if (!r.ok) {
    const error = await r.json().catch(() => null)
    if (error?.error === 'invalid_grant')
      throw new Response('Google sign-in expired. Please sign in again.', { status: 401 })
    throw new Response('Google sign-in is temporarily unavailable.', { status: 502 })
  }
  return r.json()
}

export async function callback(req, url) {
  const state = url.searchParams.get('state')
  if (!state || state !== cookies(req).get('flow'))
    return new Response('Sign-in expired. Return to the app and try again.', { status: 400 })
  const code = url.searchParams.get('code')
  if (!code) return home(req)
  const tokens = await exchange({ grant_type: 'authorization_code', code, redirect_uri: redirect })
  const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: 'Bearer ' + tokens.access_token },
  })
  if (!r.ok) throw new Response('Could not verify your Google account.', { status: 502 })
  const profile = await r.json()
  if (!profile.email_verified || !profile.email)
    throw new Response('Verified Google email required.', { status: 403 })
  const id = nonce()
  db.query('DELETE FROM sessions WHERE deadline <= ? OR id = ?').run(
    Date.now(),
    hash(cookies(req).get('sid') || ''),
  )
  db.query('INSERT INTO sessions VALUES (?,?,?,?,?,?)').run(
    hash(id),
    JSON.stringify({ email: profile.email, name: profile.name || profile.email }),
    tokens.access_token,
    tokens.refresh_token || '',
    Date.now() + tokens.expires_in * 1000,
    Date.now() + sessionMaxAge * 1000,
  )
  return home(req, { 'set-cookie': cookie('sid', id, sessionMaxAge) })
}

export function session(req) {
  const id = cookies(req).get('sid')
  return id && db.query('SELECT * FROM sessions WHERE id = ? AND deadline > ?').get(hash(id), Date.now())
}

export function renewSession(req, res, s) {
  const now = Date.now()
  const deadline = now + sessionMaxAge * 1000
  if (s.deadline > deadline - sessionRenewalAge) return
  const { changes } = db
    .query('UPDATE sessions SET deadline = ? WHERE id = ? AND deadline = ? AND deadline > ?')
    .run(deadline, s.id, s.deadline, now)
  if (changes) res.headers.append('set-cookie', cookie('sid', cookies(req).get('sid'), sessionMaxAge))
}

export function logout(req) {
  db.query('DELETE FROM sessions WHERE id = ?').run(hash(cookies(req).get('sid') || ''))
  return Response.json(null, { headers: { 'set-cookie': cookie('sid', '', 0) } })
}

const pending = new Map()
async function refresh(s) {
  if (!s.refresh) throw new Response('Sign in again.', { status: 401 })
  const tokens = await exchange({ grant_type: 'refresh_token', refresh_token: s.refresh })
  db.query('UPDATE sessions SET token=?, expiry=?, refresh=? WHERE id=?').run(
    tokens.access_token,
    Date.now() + tokens.expires_in * 1000,
    tokens.refresh_token || s.refresh,
    s.id,
  )
  return tokens.access_token
}

export function access(s, rejectedToken) {
  if (rejectedToken === undefined && s.expiry > Date.now() + 60000) return s.token
  const current = db.query('SELECT * FROM sessions WHERE id = ? AND deadline > ?').get(s.id, Date.now())
  if (!current) throw new Response('Sign in again.', { status: 401 })
  if (current.token !== rejectedToken && current.expiry > Date.now() + 60000) return current.token
  if (!pending.has(s.id))
    pending.set(
      s.id,
      refresh(current).finally(() => pending.delete(s.id)),
    )
  return pending.get(s.id)
}

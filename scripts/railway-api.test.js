import { Database } from 'bun:sqlite'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'quran-railway-test-'))
const origin = 'http://localhost:5173'
const date = '2026-11-19'
const pages = [['Student', 'Teacher', 'Page', 'Date'], ['Amal', 'Teacher', '1', date]]
const attendance = [['Student'], ['Amal'], ['Noor']]
const calls = []
const fetchHttp = globalThis.fetch
const serve = Bun.serve
let server
let sessionCookie
let refreshes = 0
let tokenFailure

beforeAll(async () => {
  Object.assign(process.env, {
    APP_ORIGIN: origin,
    PORT: '0',
    RAILWAY_VOLUME_MOUNT_PATH: directory,
    SHEET_ID: 'logs-fixture',
    SHEET_RANGE: "'Reading Log'!A2:D",
    POINTS_SHEET_RANGE: 'Points!A2:E',
    CST_SHEET_RANGE: "'Sabr Log'!A2:D",
    ROSTER_SHEET_ID: 'roster-fixture',
    ROSTER_GID: '61',
    ROSTER_NAME_COLUMN: 'B',
    ATTENDANCE_SHEET_ID: 'attendance-fixture',
    ATTENDANCE_SHEET_NAME: 'Actual Attendance',
    TEACHERS_SHEET_ID: 'roster-fixture',
    TEACHERS_SHEET_NAME: 'Teachers',
    TEACHERS_NAME_COLUMN: 'B',
    TEACHERS_EMAIL_COLUMN: 'D',
  })
  Bun.serve = (options) => (server = serve(options))
  globalThis.fetch = async (url, { method, body, headers } = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      if (body.get('grant_type') === 'refresh_token') {
        refreshes++
        expect(body.get('refresh_token')).toBe('teacher-refresh')
        if (tokenFailure) return Response.json({ error: tokenFailure }, { status: 400 })
        return Response.json({ access_token: 'teacher-renewed', expires_in: 3600 })
      }
      return Response.json({ access_token: 'teacher-token', refresh_token: 'teacher-refresh', expires_in: 3600 })
    }
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
      return Response.json({ email_verified: true, email: 'teacher@example.com', name: 'Teacher' })
    }
    expect(url).toStartWith('https://sheets.googleapis.com/v4/spreadsheets/')
    expect(headers.authorization).toBe('Bearer teacher-renewed')
    const pathname = decodeURIComponent(new URL(url).pathname)
    const payload = body && JSON.parse(body)
    calls.push({ pathname, method, payload })
    if (pathname.endsWith('/roster-fixture'))
      return Response.json({ sheets: [{ properties: { sheetId: 61, title: "Teacher's Roster" } }] })
    if (pathname.endsWith('/values:batchGet'))
      return Response.json({ valueRanges: [{ values: [['ID', 'Name', 'حلقة']] }, { values: [['1', 'Amal', 'A']] }] })
    if (pathname.endsWith("!'")) throw new Error('Incorrect A1 range')
    if (pathname.endsWith("'Teachers'!B2:D"))
      return Response.json({ values: [['Teacher', 'Other field', 'teacher@example.com']] })
    if (pathname.endsWith("'Teacher''s Roster'!A:ZZ"))
      return Response.json({ values: [['ID', 'Name', 'حلقة'], ['1', 'Amal', 'A'], [], ['2', 'Noor', 'B']] })
    if (pathname.endsWith("'Reading Log'!A1:ZZ")) return Response.json({ values: pages })
    if (pathname.endsWith("'Sabr Log'!A1:ZZ")) return Response.json({ values: [['Student'], ['Amal']] })
    if (pathname.endsWith("'Actual Attendance'!A1:ZZ")) return Response.json({ values: attendance })
    if (pathname.endsWith('/values:batchUpdate')) {
      for (const { range, values } of payload.data) {
        const [, letters, number] = /([A-Z]+)(\d+)$/.exec(range)
        const column = [...letters].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1
        const row = attendance[Number(number) - 1]
        while (row.length < column) row.push('')
        row[column] = values[0][0]
      }
      return Response.json({})
    }
    if (pathname.endsWith(':append')) {
      if (pathname.includes('Reading Log')) pages.push(...payload.values)
      return Response.json({ updates: { updatedRange: "'Reading Log'!A3:D3", updatedData: payload } })
    }
    if (method === 'PUT') return Response.json({})
    throw new Error('Unexpected Sheets path: ' + pathname)
  }
  await import('../server/index.js')
})

afterAll(async () => {
  Bun.serve = serve
  globalThis.fetch = fetchHttp
  await server?.stop(true)
  try {
    rmSync(directory, { recursive: true, force: true })
  } catch (error) {
    if (error.code !== 'EBUSY' && error.code !== 'EPERM') throw error
  }
})

function request(path, options = {}) {
  return fetchHttp(new URL(path, server.url), { redirect: 'manual', ...options })
}

function sheets(operation, payload, cookie = sessionCookie) {
  return request('/api/sheets/' + operation, {
    method: 'POST',
    headers: { origin, cookie: cookie ?? '', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

test('Railway authenticates and renews sessions, and serves all configured Sheets features', async () => {
  expect((await sheets('read', { spreadsheetId: 'logs', range: 'Pages!A1:ZZ' })).status).toBe(401)
  const login = await request('/auth/login?returnTo=' + encodeURIComponent('?tab=finals&students=all'))
  const state = new URL(login.headers.get('location')).searchParams.get('state')
  const flow = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
  const callback = await request('/auth/callback?code=fixture&state=' + state, { headers: { cookie: flow } })
  expect(callback.status).toBe(303)
  expect(callback.headers.get('location')).toBe('/?tab=finals&students=all')
  const sid = callback.headers.getSetCookie().find((value) => value.startsWith('sid='))
  expect(sid).toContain('Max-Age=34560000')
  sessionCookie = sid.split(';')[0]
  const db = new Database(join(directory, 'sessions.sqlite'))
  const id = createHash('sha256').update(sessionCookie.slice(4)).digest('hex')
  db.query('UPDATE sessions SET expiry=0, deadline=? WHERE id=?').run(Date.now() + 86400000, id)
  db.close()
  const session = await request('/api/session', { headers: { cookie: sessionCookie } })
  expect((await session.json()).email).toBe('teacher@example.com')
  expect(session.headers.get('set-cookie')).toContain('Max-Age=34560000')

  const reads = await Promise.all([
    sheets('read', { spreadsheetId: 'logs', range: 'CST!A1:ZZ' }),
    sheets('read', { spreadsheetId: 'teachers', range: "'Teachers'!A2:B" }),
    sheets('metadata', { spreadsheetId: 'roster' }),
  ])
  expect(reads.map(({ status }) => status)).toEqual([200, 200, 200])
  expect(refreshes).toBe(1)
  expect(await reads[0].json()).toEqual({ result: { values: [['Student'], ['Amal']] } })
  expect(await reads[1].json()).toEqual({ result: { values: [['Teacher', 'teacher@example.com']] } })
  const title = (await reads[2].json()).result.sheets[0].properties.title
  expect(title).toBe("Teacher's Roster")
  const rosterTab = "'Teacher''s Roster'!"
  const roster = await (await sheets('read', { spreadsheetId: 'roster', range: rosterTab + 'A:ZZ' })).json()
  expect(roster.result.nameColumnIndex).toBe(1)
  expect(roster.result.values[2]).toEqual([])
  expect((await sheets('read', { spreadsheetId: 'roster', range: "'Private'!A:ZZ" })).status).toBe(409)
  expect((await sheets('read', { spreadsheetId: 'other-spreadsheet', range: 'Pages!A1:ZZ' })).status).toBe(400)

  const update = (range, valueInputOption, value) => sheets('update', {
    spreadsheetId: 'roster', range: rosterTab + range, valueInputOption, resource: { values: [[value]] },
  })
  expect((await update('F2', 'USER_ENTERED', 'TRUE')).status).toBe(200)
  expect((await sheets('read-batch', { spreadsheetId: 'roster', ranges: ['A1:ZZ1', 'A2:ZZ2'].map((r) => rosterTab + r) })).status).toBe(200)
  expect((await update('C2', 'RAW', 'B')).status).toBe(200)
  expect((await update('A2', 'RAW', 'Not a permitted group cell')).status).toBe(400)

  const append = (range, values) => sheets('append', { spreadsheetId: 'logs', range,
    valueInputOption: 'USER_ENTERED', resource: { values: [values] },
  })
  const duplicate = await append('Pages!A2:D', ['Amal', 'Teacher', '1', date])
  expect(await duplicate.json()).toEqual({ result: { duplicatePages: [1] } })
  const simultaneous = await Promise.all([2, 2].map((page) => append('Pages!A2:D', ['Amal', 'Teacher', String(page), date])))
  const results = await Promise.all(simultaneous.map((response) => response.json()))
  expect(results.filter(({ result }) => result.updates)).toHaveLength(1)
  expect(results.filter(({ result }) => result.duplicatePages?.[0] === 2)).toHaveLength(1)
  expect((await append('Points!A2:E', ['Amal', 'Teacher', '5', date, 'Example'])).status).toBe(200)
  expect((await append('CST!A2:D', ['Amal', 'Sabr', '10', date])).status).toBe(200)

  const before = calls.length
  const saved = await sheets('attendance', { date, updates: [{ rowNumber: 2, status: 'حاضر' }, { rowNumber: 3, status: 'غائب' }] })
  expect(saved.status).toBe(200)
  expect((await saved.json())[2][12]).toBe('غائب')
  expect(calls.slice(before).map(({ method }) => method)).toEqual(['GET', 'POST'])
  expect(calls.at(-1).payload.data).toHaveLength(3)

  const expiry = new Database(join(directory, 'sessions.sqlite'))
  expiry.query('UPDATE sessions SET expiry=0 WHERE id=?').run(id)
  expiry.close()
  tokenFailure = 'invalid_client'
  expect((await sheets('read', { spreadsheetId: 'logs', range: 'Pages!A1:ZZ' })).status).toBe(502)
  expect((await (await request('/api/session', { headers: { cookie: sessionCookie } })).json()).email).toBe('teacher@example.com')
  tokenFailure = 'invalid_grant'
  expect((await sheets('read', { spreadsheetId: 'logs', range: 'Pages!A1:ZZ' })).status).toBe(401)
  expect(await (await request('/api/session', { headers: { cookie: sessionCookie } })).json()).toBeNull()
})

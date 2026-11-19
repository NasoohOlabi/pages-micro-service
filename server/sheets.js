import { z } from 'zod'
import { access } from './auth'
import { ATTENDANCE_STATUSES, formatAttendanceDate } from '../src/sheets/attendance'
import { rowToValues } from '../src/sheets/schema'
import { createPointsSchema, pointsRowToValues } from '../src/sheets/pointsSchema'

const env = (name) => process.env[name] || process.env['VITE_' + name]
const tab = (title) => "'" + title.replaceAll("'", "''") + "'!"
const enc = encodeURIComponent
const text = z.string().trim().min(1).max(4096)
const date = z.iso.date()
const page = z.object({ student: text, teacher: text, page: z.number().int().min(1).max(604), date })
const status = z.enum(ATTENDANCE_STATUSES.map((item) => item.value))
const updates = z.union([
  z.object({ student: text, status, date }),
  z.object({ date, updates: z.array(z.object({ rowNumber: z.number().int().min(2), status })).min(1) }),
])
const points = createPointsSchema((key) => key)
let lastWrite = Promise.resolve()

export async function sheets(req, path, session) {
  async function google(id, suffix, body) {
    const call = async (token) =>
      fetch('https://sheets.googleapis.com/v4/spreadsheets/' + enc(id) + suffix, {
        method: body ? 'POST' : 'GET',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: body && JSON.stringify(body),
      })
    const token = await access(session)
    let r = await call(token)
    if (r.status === 401) r = await call(await access(session, token))
    if (!r.ok) throw new Response('Google Sheets request failed.', { status: r.status })
    return r.json()
  }
  const read = async (id, range) => (await google(id, '/values/' + enc(range))).values || []
  const append = (id, range, values) =>
    google(id, '/values/' + enc(range) + ':append?valueInputOption=USER_ENTERED', { values })
  const sheet = env('SHEET_ID')
  const attendance = env('ATTENDANCE_SHEET_ID')
  const attendanceTab = tab(env('ATTENDANCE_SHEET_NAME'))
  const roster = env('ROSTER_SHEET_ID')
  async function rosterTab() {
    const result = await google(roster, '?fields=sheets(properties(sheetId,title))')
    const match = result.sheets.find((s) => s.properties.sheetId === Number(env('ROSTER_GID')))
    if (!match) throw new Response('Roster tab missing.', { status: 502 })
    return tab(match.properties.title)
  }
  const colIndex = (col) => [...col.toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1
  if (req.method === 'GET') {
    switch (path) {
      case 'attendance':
        return read(attendance, attendanceTab + 'A1:ZZ')
      case 'teachers': {
        const first = env('TEACHERS_NAME_COLUMN'),
          last = env('TEACHERS_EMAIL_COLUMN')
        const rows = await read(
          env('TEACHERS_SHEET_ID'),
          tab(env('TEACHERS_SHEET_NAME')) + first + '2:' + last,
        )
        return rows
          .map((r) => ({ name: r[0]?.trim(), email: r[colIndex(last) - colIndex(first)]?.trim() || '' }))
          .filter((t) => t.name)
      }
      case 'names': {
        const col = env('ROSTER_NAME_COLUMN')
        return [
          ...new Set(
            (await read(roster, (await rosterTab()) + col + '2:' + col))
              .map((r) => r[0]?.trim())
              .filter(Boolean),
          ),
        ]
      }
      case 'roster': {
        const [headers = [], ...rows] = await read(roster, (await rosterTab()) + 'A:ZZ')
        return {
          headers,
          rows: rows.filter((r) => r.some(Boolean)),
          nameColumnIndex: colIndex(env('ROSTER_NAME_COLUMN')),
        }
      }
    }
  }
  if (req.method === 'POST') {
    const body = await req.json()
    const write = async () => {
      switch (path) {
        case 'points':
          await append(sheet, env('POINTS_SHEET_RANGE'), [pointsRowToValues(points.parse(body))])
          break
        case 'roster':
          await append(roster, (await rosterTab()) + 'A:ZZ', [
            z.array(z.string().max(4096)).min(1).max(702).parse(body),
          ])
          break
        case 'pages': {
          const entries = z.array(page).min(1).max(604).parse(body)
          const key = (student, page) => JSON.stringify([student.trim().toLowerCase(), String(page)])
          const seen = new Set((await read(sheet, env('SHEET_RANGE'))).map((r) => key(r[0] || '', r[2])))
          const duplicates = []
          for (const e of entries) {
            const k = key(e.student, e.page)
            if (seen.has(k)) duplicates.push(e.page)
            seen.add(k)
          }
          if (!duplicates.length) await append(sheet, env('SHEET_RANGE'), entries.map(rowToValues))
          return duplicates
        }
        case 'attendance': {
          const entry = updates.parse(body)
          const rows = await read(attendance, attendanceTab + 'A1:ZZ')
          const label = formatAttendanceDate(entry.date)
          const header = rows[0] || []
          let index = header.findIndex((v, i) => i >= 12 && v.trim().toLowerCase() === label.toLowerCase())
          const fresh = index < 0
          if (fresh) index = header.findIndex((v, i) => i >= 12 && !v.trim())
          if (index < 0) index = Math.max(12, header.length)
          let column = ''
          for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
            column = String.fromCharCode(65 + ((n - 1) % 26)) + column
          const list =
            'student' in entry
              ? [
                  {
                    rowNumber:
                      rows.findIndex(
                        (r, i) => i > 0 && r[0]?.trim().toLowerCase() === entry.student.toLowerCase(),
                      ) + 1,
                    status: entry.status,
                  },
                ]
              : entry.updates
          const cell = (row, value) => ({ range: attendanceTab + column + row, values: [[value]] })
          const data = fresh ? [cell(1, label)] : []
          for (const u of list) {
            if (u.rowNumber < 2 || !rows[u.rowNumber - 1]?.[0]?.trim())
              throw new Response('Student row missing.', { status: 409 })
            data.push(cell(u.rowNumber, u.status))
          }
          await google(attendance, '/values:batchUpdate', { valueInputOption: 'RAW', data })
          break
        }
        default:
          throw new Response('Unknown route', { status: 404 })
      }
      return null
    }
    const result = lastWrite.then(write)
    lastWrite = result.catch(() => {})
    return result
  }
  throw new Response('Unknown route', { status: 404 })
}

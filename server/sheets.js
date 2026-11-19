import { z } from 'zod'
import { access } from './auth'
import { config } from '../src/config'
import { saveAttendance } from './attendance'

const env = (name) => process.env[name] || process.env['VITE_' + name]
const tab = (title) => "'" + title.replaceAll("'", "''") + "'"
const encode = encodeURIComponent
const titleOf = (range) => range.slice(0, range.lastIndexOf('!'))
const columnIndex = (column) =>
  [...column.toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1
const invalid = () => new Response('Invalid sheet request.', { status: 400 })

const target = z.object({ spreadsheetId: z.enum(['logs', 'roster', 'attendance', 'teachers']) })
const a1 = z.string().min(1).max(300)
const ranged = target.extend({ range: a1 })
const rows = z
  .array(z.array(z.string().max(4096)).min(1).max(702))
  .min(1)
  .max(2000)
const write = ranged.extend({
  valueInputOption: z.enum(['RAW', 'USER_ENTERED']),
  resource: z.object({ values: rows }),
})
const batchRead = target.extend({ ranges: z.tuple([a1, a1]) })
let rosterTitle
let rosterGroupIndex = -1
let pageWrite = Promise.resolve()
let attendanceWrite = Promise.resolve()

export async function sheets(req, path, session) {
  if (req.method !== 'POST') throw new Response('Unknown route.', { status: 404 })

  async function google(id, suffix, { method = 'GET', body } = {}) {
    if (!id) throw new Response('Spreadsheet configuration missing.', { status: 502 })
    const call = (token) =>
      fetch('https://sheets.googleapis.com/v4/spreadsheets/' + encode(id) + suffix, {
        method,
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: body && JSON.stringify(body),
      })
    const token = await access(session)
    let response = await call(token)
    if (response.status === 401) response = await call(await access(session, token))
    if (!response.ok) throw new Response('Google Sheets request failed.', { status: response.status })
    return response.json()
  }

  const logs = env('SHEET_ID')
  const roster = env('ROSTER_SHEET_ID')
  const attendance = env('ATTENDANCE_SHEET_ID')
  const logRanges = [
    { range: config.sheetRange, actual: env('SHEET_RANGE'), columns: 4 },
    { range: config.pointsSheetRange, actual: env('POINTS_SHEET_RANGE'), columns: 5 },
    { range: config.cstSheetRange, actual: env('CST_SHEET_RANGE') || 'CST!A2:D', columns: 4 },
  ]
  const attendanceTab = tab(env('ATTENDANCE_SHEET_NAME'))
  const read = (id, range) => google(id, '/values/' + encode(range))
  const append = (id, range, values) =>
    google(
      id,
      '/values/' +
        encode(range) +
        ':append?valueInputOption=USER_ENTERED&includeValuesInResponse=true&responseValueRenderOption=FORMATTED_VALUE',
      {
        method: 'POST',
        body: { values },
      },
    )
  const update = (id, range, values, option) =>
    google(id, '/values/' + encode(range) + '?valueInputOption=' + option, {
      method: 'PUT',
      body: { values },
    })

  async function resolveRosterTitle() {
    const result = await google(roster, '?fields=sheets(properties(sheetId,title))')
    const match = result.sheets?.find(({ properties }) => properties.sheetId === Number(env('ROSTER_GID')))
    if (!match) throw new Response('Configured roster tab is missing.', { status: 502 })
    if (rosterTitle !== match.properties.title) rosterGroupIndex = -1
    rosterTitle = match.properties.title
    return rosterTitle
  }

  async function rosterRange(range) {
    const actualTitle = await (rosterTitle || resolveRosterTitle())
    if (titleOf(range) !== tab(actualTitle))
      throw new Response('Roster tab changed. Refresh data and try again.', { status: 409 })
    return range.slice(range.lastIndexOf('!') + 1)
  }

  const request = await req.json()
  switch (path) {
    case 'sheets/metadata': {
      if (target.parse(request).spreadsheetId !== 'roster') throw invalid()
      return {
        result: {
          sheets: [{ properties: { sheetId: Number(config.rosterGid), title: await resolveRosterTitle() } }],
        },
      }
    }
    case 'sheets/read': {
      const { spreadsheetId, range } = ranged.parse(request)
      if (spreadsheetId === 'logs') {
        const mapping = logRanges.find((entry) => range === titleOf(entry.range) + '!A1:ZZ')
        if (!mapping?.actual) throw invalid()
        return { result: await read(logs, titleOf(mapping.actual) + '!A1:ZZ') }
      }
      if (spreadsheetId === 'attendance' && range === tab(config.attendanceSheetName) + '!A1:ZZ')
        return { result: await read(attendance, attendanceTab + '!A1:ZZ') }
      if (spreadsheetId === 'roster') {
        const cells = await rosterRange(range)
        const row = /^A([2-9]|[1-9]\d+):ZZ\1$/.test(cells)
        if (cells !== 'A:ZZ' && !row) throw invalid()
        return {
          result: { ...(await read(roster, range)), nameColumnIndex: columnIndex(env('ROSTER_NAME_COLUMN')) },
        }
      }
      if (spreadsheetId === 'teachers' && range === tab(config.teachersSheetName) + '!A2:B') {
        const firstColumn = env('TEACHERS_NAME_COLUMN')
        const lastColumn = env('TEACHERS_EMAIL_COLUMN')
        const emailIndex = columnIndex(lastColumn) - columnIndex(firstColumn)
        const result = await read(
          env('TEACHERS_SHEET_ID'),
          tab(env('TEACHERS_SHEET_NAME')) + '!' + firstColumn + '2:' + lastColumn,
        )
        return { result: { values: result.values?.map((row) => [row[0] ?? '', row[emailIndex] ?? '']) } }
      }
      throw invalid()
    }
    case 'sheets/read-batch': {
      const { spreadsheetId, ranges } = batchRead.parse(request)
      if (
        spreadsheetId !== 'roster' ||
        (await rosterRange(ranges[0])) !== 'A1:ZZ1' ||
        !/^A([2-9]|[1-9]\d+):ZZ\1$/.test(await rosterRange(ranges[1]))
      )
        throw invalid()
      const query = new URLSearchParams()
      ranges.forEach((range) => query.append('ranges', range))
      const result = await google(roster, '/values:batchGet?' + query)
      const headers = result.valueRanges?.[0]?.values?.[0] ?? []
      const indexes = headers.flatMap((header, index) =>
        ['حلقة', 'الحلقة'].includes(header.trim()) ? [index] : [],
      )
      rosterGroupIndex = indexes.length === 1 ? indexes[0] : -1
      return { result }
    }
    case 'sheets/append': {
      const {
        spreadsheetId,
        range,
        resource: { values },
      } = write.parse(request)
      if (spreadsheetId === 'roster' && (await rosterRange(range)) === 'A:ZZ' && values.length === 1)
        return { result: await append(roster, range, values) }
      const mapping = logRanges.find((entry) => entry.range === range)
      if (
        spreadsheetId !== 'logs' ||
        !mapping?.actual ||
        values.some((row) => row.length !== mapping.columns)
      )
        throw invalid()
      if (range !== config.sheetRange) return { result: await append(logs, mapping.actual, values) }

      const result = pageWrite.then(async () => {
        const pageNumber = z.coerce.number().int().min(1).max(604)
        const pages = z
          .array(z.tuple([z.string().trim().min(1), z.string().trim().min(1), pageNumber, z.iso.date()]))
          .max(604)
          .parse(values)
        const existing = await read(logs, titleOf(mapping.actual) + '!A1:ZZ')
        const key = (name, page) => JSON.stringify([name.trim().toLowerCase(), Number(page)])
        const seen = new Set((existing.values ?? []).slice(1).map((row) => key(row[0] ?? '', row[2])))
        const duplicatePages = []
        for (const [name, , page] of pages) {
          const entry = key(name, page)
          if (seen.has(entry)) duplicatePages.push(page)
          seen.add(entry)
        }
        if (duplicatePages.length) return { duplicatePages }
        return append(logs, mapping.actual, values)
      })
      pageWrite = result.catch(() => {})
      return { result: await result }
    }
    case 'sheets/update': {
      const {
        spreadsheetId,
        range,
        valueInputOption,
        resource: { values },
      } = write.parse(request)
      if (spreadsheetId !== 'roster' || values.length !== 1 || values[0].length !== 1) throw invalid()
      const cell = /^([A-Z]{1,2})([2-9]|[1-9]\d+)$/.exec(await rosterRange(range))
      const activation =
        cell?.[1] === 'F' && valueInputOption === 'USER_ENTERED' && ['TRUE', 'FALSE'].includes(values[0][0])
      const group = cell && valueInputOption === 'RAW' && columnIndex(cell[1]) === rosterGroupIndex
      if (!activation && !group) throw invalid()
      return { result: await update(roster, range, values, valueInputOption) }
    }
    case 'sheets/attendance': {
      const write = attendanceWrite.then(() =>
        saveAttendance(
          request,
          attendanceTab,
          async () => (await read(attendance, attendanceTab + '!A1:ZZ')).values ?? [],
          (body) => google(attendance, '/values:batchUpdate', { method: 'POST', body }),
        ),
      )
      attendanceWrite = write.catch(() => {})
      return write
    }
    default:
      throw new Response('Unknown route.', { status: 404 })
  }
}

import { beforeEach, expect, mock, test } from 'bun:test'

mock.module('../src/config', () => ({ config: { rosterSheetId: 'roster', rosterGid: '42', rosterNameColumn: 'A', sheetId: 'logs', sheetRange: 'Pages!A2:D', pointsSheetRange: 'Points!A2:E', cstSheetRange: 'CST!A2:D', attendanceSheetId: 'attendance', attendanceSheetName: 'AutoAttendance' } }))
const { fetchActivationStudents, updateStudentActive, fetchRosterSheet, SheetsAccessError } = {
  ...await import('../src/sheets/rosterClient'),
  ...await import('../src/sheets/sheetsClient'),
}

const { queryClient } = await import('../src/queryClient')
beforeEach(() => queryClient.clear())

test('activation preserves physical rows and writes only F, refreshing the cached roster', async () => {
  const values = [['Name', '', '', '', '', 'Active'], ['Active', '', '', '', '', 'TRUE'], [], ['', '', 'summary'], ['Disabled', '', '', '', '', 'FALSE']]
  const writes = []
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: {
    get: async () => ({ result: { sheets: [{ properties: { sheetId: 42, title: "Roster's tab" } }] } }),
    values: {
      get: async ({ range }) => {
        const match = /!A(\d+):ZZ\d+$/.exec(range)
        const rows = match ? [values[Number(match[1]) - 1]] : values
        return { result: { values: rows.map((row) => [...row]) } }
      },
      update: async (request) => {
        writes.push(request)
        const row = Number(/F(\d+)$/.exec(request.range)[1]) - 1
        values[row][5] = request.resource.values[0][0]
      },
    },
  } } } } }
  expect((await fetchRosterSheet()).rows.at(-1)[5]).toBe('FALSE')
  const students = await fetchActivationStudents()
  expect(students).toEqual([{ rowNumber: 2, name: 'Active', active: true }, { rowNumber: 5, name: 'Disabled', active: false }])
  await updateStudentActive(students[1])
  expect(writes[0]).toEqual({ spreadsheetId: 'roster', range: "'Roster''s tab'!F5", valueInputOption: 'USER_ENTERED', resource: { values: [['TRUE']] } })
  expect((await fetchRosterSheet()).rows.at(-1)[5]).toBe('TRUE')
  const active = (await fetchActivationStudents())[0]
  await updateStudentActive(active)
  expect(writes[1].range).toBe("'Roster''s tab'!F2")
  expect(values[1][5]).toBe('FALSE')
  expect(values[1][0]).toBe('Active')
  expect(values[4][0]).toBe('Disabled')
  await expect(updateStudentActive(students[1])).rejects.toThrow('Roster changed')
  expect(writes).toHaveLength(2)
  const moved = (await fetchActivationStudents())[1]
  values[4][0] = 'Different student'
  await expect(updateStudentActive(moved)).rejects.toThrow('Roster changed')
  expect(writes).toHaveLength(2)
})

test('sheet access failures retain the friendly access error', async () => {
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: { get: async () => { throw { status: 403 } } } } } } }
  await expect(fetchActivationStudents()).rejects.toBeInstanceOf(SheetsAccessError)
})

const { QueryObserver } = await import('@tanstack/react-query')
const { rosterQueryOptions, rosterGroups, fetchGroupStudents, fetchRosterNames, updateStudentGroup, appendRosterStudent } = await import('../src/sheets/rosterClient')
const { setQueryUser } = await import('../src/queryClient')

function rosterApi() {
  const values = [['Name', 'ID', '', '', '', 'Active', '', 'Surname', '\u062d\u0644\u0642\u0629'], ['Alice', '1', '', '', '', 'TRUE', '', 'Family', 'A'], [], ['Bob', '2', '', '', '', 'FALSE', '', 'Other', 'B']]
  const calls = []
  const read = (range) => {
    const match = /!A(\d+):ZZ(\d+)$/.exec(range)
    return (match ? values.slice(Number(match[1]) - 1, Number(match[2])) : values).map((row) => [...row])
  }
  const api = {
    get: async (request) => { calls.push({ kind: 'metadata', ...request }); return { result: { sheets: [{ properties: { sheetId: 42, title: 'Info' } }] } } },
    values: {
      get: async (request) => { calls.push({ kind: 'read', ...request }); return { result: { values: read(request.range) } } },
      batchGet: async (request) => { calls.push({ kind: 'batch', ...request }); return { result: { valueRanges: request.ranges.map((range) => ({ values: read(range) })) } } },
      update: async (request) => {
        calls.push({ kind: 'write', ...request })
        const match = /!([FI])(\d+)$/.exec(request.range)
        values[Number(match[2]) - 1][match[1] === 'F' ? 5 : 8] = request.resource.values[0][0]
      },
      append: async (request) => { calls.push({ kind: 'append', ...request }); values.push(...request.resource.values) },
    },
  }
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: api } } } }
  return { values, calls, api }
}

test('all roster readers share one metadata lookup and one data request', async () => {
  const { calls } = rosterApi()
  const [sheet, groups, students, names] = await Promise.all([fetchRosterSheet(), fetchGroupStudents(), fetchActivationStudents(), fetchRosterNames()])
  expect(calls.map((call) => call.kind)).toEqual(['metadata', 'read'])
  expect(groups[1].rowNumber).toBe(4)
  expect(students[0].active).toBe(true)
  expect(names).toEqual(['Alice', 'Bob'])
  expect(sheet.rows).toHaveLength(3)
  await fetchGroupStudents()
  await fetchRosterNames()
  expect(calls).toHaveLength(2)
})

test('warm deactivation makes exactly two calls and updates every observer without reloading', async () => {
  const { calls, values } = rosterApi()
  await fetchRosterSheet()
  const observer = new QueryObserver(queryClient, { ...rosterQueryOptions, select: rosterGroups })
  const observed = []
  const unsubscribe = observer.subscribe((result) => { if (result.data) observed.push(result.data[0].active) })
  const student = (await fetchActivationStudents())[0]
  calls.length = 0
  await updateStudentActive(student)
  expect(calls.map((call) => [call.kind, call.range])).toEqual([['read', "'Info'!A2:ZZ2"], ['write', "'Info'!F2"]])
  expect(values[1][8]).toBe('A')
  expect((await fetchGroupStudents())[0].active).toBe(false)
  expect((await fetchActivationStudents())[0].active).toBe(false)
  expect(observed.at(-1)).toBe(false)
  expect(calls).toHaveLength(2)
  unsubscribe()
})

test('group moves validate header and student in one batch read and update the shared cache', async () => {
  const { calls, values } = rosterApi()
  const student = (await fetchGroupStudents())[0]
  calls.length = 0
  await updateStudentGroup(student, 'B')
  expect(calls.map((call) => call.kind)).toEqual(['batch', 'write'])
  expect(values[1][7]).toBe('Family')
  expect((await fetchGroupStudents())[0].group).toBe('B')
  expect(calls).toHaveLength(2)
})

test('failed status writes do not change cached state or retry the mutation', async () => {
  const { api, calls } = rosterApi()
  const student = (await fetchActivationStudents())[0]
  api.values.update = async (request) => { calls.push({ kind: 'write', ...request }); throw new Error('Network failed') }
  calls.length = 0
  await expect(updateStudentActive(student)).rejects.toThrow('Network failed')
  expect(calls.map((call) => call.kind)).toEqual(['read', 'write'])
  expect(queryClient.getQueryData(rosterQueryOptions.queryKey).rows[0][5]).toBe('TRUE')
  expect(queryClient.getQueryState(rosterQueryOptions.queryKey).isInvalidated).toBe(true)
})

test('expired roster refreshes data while metadata stays cached', async () => {
  const { calls, values } = rosterApi()
  const sheet = await fetchRosterSheet()
  values[1][5] = 'FALSE'
  queryClient.setQueryData(rosterQueryOptions.queryKey, sheet, { updatedAt: Date.now() - 6 * 60_000 })
  expect((await fetchActivationStudents())[0].active).toBe(false)
  expect(calls.map((call) => call.kind)).toEqual(['metadata', 'read', 'read'])
})

test('adding a student invalidates the roster and all projections see the new row', async () => {
  const { calls } = rosterApi()
  await fetchRosterSheet()
  await appendRosterStudent(['New', '3', '', '', '', 'TRUE', '', '', 'A'])
  expect((await fetchRosterNames()).at(-1)).toBe('New')
  expect((await fetchActivationStudents()).at(-1).active).toBe(true)
  expect(calls.map((call) => call.kind)).toEqual(['metadata', 'read', 'append', 'read'])
})

test('account changes clear caches and an old pending mutation cannot repopulate them', async () => {
  setQueryUser('first@example.com')
  const { api } = rosterApi()
  const student = (await fetchActivationStudents())[0]
  let finish
  const started = new Promise((resolve) => {
    api.values.update = () => { resolve(); return new Promise((done) => { finish = done }) }
  })
  const pending = updateStudentActive(student)
  await started
  setQueryUser('second@example.com')
  expect(queryClient.getQueryData(rosterQueryOptions.queryKey)).toBeUndefined()
  finish()
  await pending
  expect(queryClient.getQueryData(rosterQueryOptions.queryKey)).toBeUndefined()
  setQueryUser(null)
})

const { fetchExistingRows, appendRows, sheetValuesQueryOptions } = await import('../src/sheets/sheetsClient')
const { fetchAttendanceSheet, saveStudentAttendance, ATTENDANCE_STATUSES, getStudentAttendanceHistory } = await import('../src/sheets/attendanceClient')
const { fetchExistingPointRows, appendPointRow } = await import('../src/sheets/pointsClient')
const { memorizationQueryOptions, pagesQueryOptions } = await import('../src/sheets/logQueries')

test('pages and memorization share one request while archived rows and fresh duplicate checks stay correct', async () => {
  const values = [['Student', 'Teacher', 'Page', 'Date', 'Archived'], ['Alice', 'Teacher', '1', '2026-11-07', ''], ['Bob', 'Teacher', '2', '2026-11-07', 'yes']]
  let reads = 0
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: { values: {
    get: async () => { reads++; return { result: { values: values.map((row) => [...row]) } } },
    append: async (request) => { values.push(...request.resource.values) },
  } } } } } }
  const [active, archived] = await Promise.all([fetchExistingRows(), fetchExistingRows({ includeArchived: true })])
  expect(active).toHaveLength(1)
  expect(archived).toHaveLength(2)
  expect(reads).toBe(1)
  const raw = await queryClient.fetchQuery(sheetValuesQueryOptions('Pages!A2:D'))
  expect(pagesQueryOptions.select(raw)).toHaveLength(1)
  expect(memorizationQueryOptions.select(raw)).toHaveLength(2)
  values.push(['Other', 'Teacher', '3', '2026-11-07', ''])
  expect(await fetchExistingRows({ includeArchived: true, fresh: true })).toHaveLength(3)
  expect(reads).toBe(2)
  await appendRows([{ student: 'New', teacher: 'Teacher', page: 4, date: '2026-11-07' }])
  expect(await fetchExistingRows()).toHaveLength(3)
  expect(reads).toBe(3)
})

test('writing points invalidates only the points query, preserving the pages cache', async () => {
  const values = { Pages: [['Student'], ['Alice', 'Teacher', '1', '2026-11-07']], Points: [['Student'], ['Alice', 'Teacher', '5', '2026-11-07', 'Reason']] }
  const reads = []
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: { values: {
    get: async ({range}) => { const tab = range.split('!')[0]; reads.push(tab); return { result: { values: values[tab].map((row) => [...row]) } } },
    append: async ({range, resource}) => { values[range.split('!')[0]].push(...resource.values) },
  } } } } } }
  await Promise.all([fetchExistingRows(), fetchExistingPointRows()])
  await appendPointRow({ student: 'Bob', teacher: 'Teacher', points: 10, date: '2026-11-07', reason: 'Reason' })
  expect(await fetchExistingPointRows()).toHaveLength(2)
  await fetchExistingRows()
  expect(reads).toEqual(['Pages', 'Points', 'Points'])
})

test('attendance cache updates its cells and history after successful writes without a post-save reload', async () => {
  const header = Array.from({ length: 12 }, () => '')
  header[0] = 'Student'
  const row = Array.from({ length: 12 }, () => '')
  row[0] = 'Alice'
  row[7] = 'A'
  const values = [header, row]
  const calls = []
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: { values: {
    get: async () => { calls.push('read'); return { result: { values: values.map((row) => [...row]) } } },
    update: async (request) => {
      calls.push('write')
      const match = /!([A-Z]+)(\d+)$/.exec(request.range)
      const column = [...match[1]].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1
      values[Number(match[2]) - 1][column] = request.resource.values[0][0]
    },
  } } } } } }
  await fetchAttendanceSheet()
  await fetchAttendanceSheet()
  expect(calls).toEqual(['read'])
  await saveStudentAttendance('Alice', '2026-11-07', ATTENDANCE_STATUSES[0].value)
  const updated = await fetchAttendanceSheet()
  expect(getStudentAttendanceHistory(updated, 'Alice')).toEqual([{ date: 'Sat 7/11', status: ATTENDANCE_STATUSES[0].value }])
  expect(calls).toEqual(['read', 'read', 'write', 'write'])
})

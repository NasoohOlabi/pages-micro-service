import { beforeEach, expect, mock, test } from 'bun:test'

mock.module('../src/config', () => ({ config: { rosterSheetId: 'roster', rosterGid: '42', rosterNameColumn: 'A', sheetId: 'logs', sheetRange: 'Pages!A2:D', pointsSheetRange: 'Points!A2:E', cstSheetRange: 'CST!A2:D', attendanceSheetId: 'attendance', attendanceSheetName: 'AutoAttendance', teachersSheetId: 'teachers', teachersSheetName: 'Teachers', teachersNameColumn: 'A', teachersEmailColumn: 'B' } }))
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

test('roster stays cached indefinitely until explicitly refreshed', async () => {
  const { calls, values } = rosterApi()
  const sheet = await fetchRosterSheet()
  values[1][5] = 'FALSE'
  queryClient.setQueryData(rosterQueryOptions.queryKey, sheet, { updatedAt: Date.now() - 30 * 24 * 60 * 60_000 })
  expect((await fetchActivationStudents())[0].active).toBe(true)
  expect(calls.map((call) => call.kind)).toEqual(['metadata', 'read'])
  await queryClient.invalidateQueries({ queryKey: rosterQueryOptions.queryKey, refetchType: 'none' })
  expect((await fetchActivationStudents())[0].active).toBe(false)
  expect(calls.map((call) => call.kind)).toEqual(['metadata', 'read', 'read'])
})

test('roster, teachers and confirmed edits survive reloads, while account changes remove stored data', async () => {
  const { QueryClient } = await import('@tanstack/react-query')
  const { restoreReferenceCache } = await import('../src/referenceCache')
  const { fetchTeachers, teachersQueryOptions } = await import('../src/sheets/teachersClient')
  const { calls, api } = rosterApi()
  const stored = new Map()
  window.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) }
  const get = api.values.get
  api.values.get = async (request) => request.spreadsheetId === 'teachers'
    ? (calls.push({ kind: 'teachers' }), { result: { values: [['Teacher', 'teacher@example.com']] } })
    : get(request)
  const reloaded = new QueryClient()
  try {
    setQueryUser('persistent@example.com')
    const student = (await fetchActivationStudents())[1]
    await fetchTeachers()
    await updateStudentActive(student)
    restoreReferenceCache(reloaded, 'persistent@example.com')
    calls.length = 0
    expect(rosterGroups(await reloaded.fetchQuery(rosterQueryOptions))[1].active).toBe(true)
    expect((await reloaded.fetchQuery(teachersQueryOptions))[0].name).toBe('Teacher')
    expect(calls).toEqual([])
    expect(stored.size).toBe(1)
    expect(JSON.parse([...stored.values()][0]).entries.map((entry) => entry.queryKey[0]).sort()).toEqual(['roster', 'roster-title', 'teachers'])
    setQueryUser('another@example.com')
    expect(queryClient.getQueryData(rosterQueryOptions.queryKey)).toBeUndefined()
    expect(stored.size).toBe(0)
    await fetchRosterSheet()
    expect(stored.size).toBe(1)
    setQueryUser(null)
    expect(stored.size).toBe(0)
  } finally {
    setQueryUser(null)
    reloaded.clear()
  }
})

test('malformed, mismatched and inaccessible browser caches safely fall back to a fresh load', async () => {
  const { QueryClient } = await import('@tanstack/react-query')
  const { restoreReferenceCache, saveReferenceCache } = await import('../src/referenceCache')
  const client = new QueryClient()
  let removed = 0
  for (const value of ['{broken', JSON.stringify({ email: 'other@example.com', entries: [] }), JSON.stringify({ email: 'same@example.com', entries: [{ queryKey: ['roster', 'id', '42', 'A'], data: { rows: 12 }, dataUpdatedAt: 1, isInvalidated: false }] })]) {
    globalThis.window = { localStorage: { getItem: () => value, removeItem: () => removed++ } }
    restoreReferenceCache(client, 'same@example.com')
    expect(client.getQueryCache().getAll()).toHaveLength(0)
  }
  expect(removed).toBe(3)
  globalThis.window = { localStorage: { getItem: () => { throw new Error('Blocked') }, setItem: () => { throw new Error('Full') }, removeItem: () => { throw new Error('Blocked') } } }
  expect(() => restoreReferenceCache(client, 'same@example.com')).not.toThrow()
  expect(() => saveReferenceCache(client, 'same@example.com')).not.toThrow()
  client.clear()
})

test('deferred reference refresh remains invalidated after a reload', async () => {
  const { QueryClient } = await import('@tanstack/react-query')
  const { saveReferenceCache, restoreReferenceCache } = await import('../src/referenceCache')
  const source = new QueryClient()
  const reloaded = new QueryClient()
  const stored = new Map()
  globalThis.window = { localStorage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) } }
  const key = ['teachers', 'id', 'Teachers', 'A', 'B']
  source.setQueryData(key, [{ name: 'Old', email: 'old@example.com' }])
  await source.invalidateQueries({ queryKey: key, refetchType: 'none' })
  saveReferenceCache(source, 'same@example.com')
  restoreReferenceCache(reloaded, 'same@example.com')
  let reads = 0
  expect(await reloaded.fetchQuery({ queryKey: key, staleTime: Infinity, queryFn: async () => { reads++; return [{ name: 'New', email: 'new@example.com' }] } })).toEqual([{ name: 'New', email: 'new@example.com' }])
  expect(reads).toBe(1)
  source.clear()
  reloaded.clear()
})

test('adding a student patches the permanent roster cache from the server response', async () => {
  const { calls, api, values } = rosterApi()
  const append = api.values.append
  api.values.append = async (request) => {
    await append(request)
    return { result: { updates: { updatedRange: `'Info'!A${values.length}:I${values.length}`, updatedData: { values: request.resource.values } } } }
  }
  await fetchRosterSheet()
  const observer = new QueryObserver(queryClient, rosterQueryOptions)
  const unsubscribe = observer.subscribe(() => {})
  try {
    calls.length = 0
    await appendRosterStudent(['New', '3', '', '', '', 'TRUE', '', '', 'A'])
    expect((await fetchRosterNames()).at(-1)).toBe('New')
    expect(calls.map((call) => call.kind)).toEqual(['append'])
  } finally {
    unsubscribe()
  }
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

test('returning to a log after two minutes reuses the cached read', async () => {
  let reads = 0
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: { values: {
    get: async () => { reads++; return { result: { values: [['Student'], ['Alice']] } } },
  } } } } } }
  await fetchExistingRows()
  const options = sheetValuesQueryOptions('Pages!A2:D')
  queryClient.setQueryData(options.queryKey, queryClient.getQueryData(options.queryKey), { updatedAt: Date.now() - 2 * 60_000 })
  await fetchExistingRows()
  expect(reads).toBe(1)
  queryClient.setQueryData(options.queryKey, queryClient.getQueryData(options.queryKey), { updatedAt: Date.now() - 16 * 60_000 })
  await fetchExistingRows()
  expect(reads).toBe(2)
})

test('failed queries do not retry when another screen mounts, but explicit refresh retries', async () => {
  const { refreshActiveQueries } = await import('../src/queryClient')
  let reads = 0
  const options = { queryKey: ['failure'], queryFn: async () => { reads++; throw new Error('Quota') } }
  await expect(queryClient.fetchQuery(options)).rejects.toThrow('Quota')
  const observer = new QueryObserver(queryClient, options)
  const unsubscribe = observer.subscribe(() => {})
  try {
    await new Promise(setImmediate)
    expect(reads).toBe(1)
    await expect(refreshActiveQueries()).rejects.toThrow('Quota')
    expect(reads).toBe(2)
  } finally {
    unsubscribe()
  }
})

test('manual refresh reads active screens only and invalidates unused data for the next visit', async () => {
  const { refreshActiveQueries } = await import('../src/queryClient')
  const reads = []
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: { values: {
    get: async ({ range }) => { reads.push(range.split('!')[0]); return { result: { values: [['Student']] } } },
  } } } } } }
  await Promise.all([fetchExistingRows(), fetchExistingPointRows()])
  const observer = new QueryObserver(queryClient, sheetValuesQueryOptions('Pages!A2:D'))
  const unusedObserver = new QueryObserver(queryClient, { ...sheetValuesQueryOptions('Points!A2:E'), enabled: false })
  const unsubscribe = observer.subscribe(() => {})
  const unsubscribeUnused = unusedObserver.subscribe(() => {})
  try {
    reads.length = 0
    await refreshActiveQueries()
    expect(reads).toEqual(['Pages'])
    await fetchExistingPointRows()
    expect(reads).toEqual(['Pages', 'Points'])
  } finally {
    unsubscribe()
    unsubscribeUnused()
  }
})

test('reconnecting does not refetch stale active data', async () => {
  const { onlineManager } = await import('@tanstack/react-query')
  let reads = 0
  const options = { queryKey: ['reconnect'], queryFn: async () => ++reads }
  await queryClient.fetchQuery(options)
  const observer = new QueryObserver(queryClient, options)
  const unsubscribe = observer.subscribe(() => {})
  queryClient.setQueryData(options.queryKey, 1, { updatedAt: Date.now() - 16 * 60_000 })
  queryClient.mount()
  try {
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
    await new Promise(setImmediate)
    expect(reads).toBe(1)
  } finally {
    queryClient.unmount()
    unsubscribe()
  }
})

test('append responses update warm pages, points and CST caches without another read', async () => {
  const { appendCstRow, fetchExistingCstRows } = await import('../src/sheets/cstClient')
  const reads = []
  const requests = []
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: { values: {
    get: async ({ range }) => { reads.push(range); return { result: { values: [['Student']] } } },
    append: async (request) => {
      requests.push(request)
      return { result: { updates: { updatedRange: `${request.range.split('!')[0]}!A2:E2`, updatedData: { values: request.resource.values } } } }
    },
  } } } } } }
  await Promise.all([fetchExistingRows(), fetchExistingPointRows(), fetchExistingCstRows()])
  const observer = new QueryObserver(queryClient, sheetValuesQueryOptions('Pages!A2:D'))
  const unsubscribe = observer.subscribe(() => {})
  try {
    await appendRows([{ student: 'Alice', teacher: 'Teacher', page: 1, date: '2026-11-13' }])
    await appendPointRow({ student: 'Alice', teacher: 'Teacher', points: 10, date: '2026-11-13', reason: 'Reason' })
    await appendCstRow({ student: 'Alice', sabr: 'Test', mark: '10', date: '2026-11-13' })
    expect((await fetchExistingRows())[0][0]).toBe('Alice')
    expect((await fetchExistingPointRows())[0][2]).toBe('10')
    expect((await fetchExistingCstRows())[0][0]).toBe('Alice')
    expect(reads).toHaveLength(3)
    expect(requests.every((request) => request.includeValuesInResponse && request.responseValueRenderOption === 'FORMATTED_VALUE')).toBe(true)
  } finally {
    unsubscribe()
  }
})

test('append responses with external row gaps invalidate without an eager post-save read', async () => {
  let reads = 0
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: { values: {
    get: async () => { reads++; return { result: { values: [['Student']] } } },
    append: async () => ({ result: { updates: { updatedRange: 'Pages!A4:D4', updatedData: { values: [['Alice', 'Teacher', '1', '2026-11-13']] } } } }),
  } } } } } }
  await fetchExistingRows()
  const options = sheetValuesQueryOptions('Pages!A2:D')
  const observer = new QueryObserver(queryClient, options)
  const unsubscribe = observer.subscribe(() => {})
  try {
    await appendRows([{ student: 'Alice', teacher: 'Teacher', page: 1, date: '2026-11-13' }])
    expect(queryClient.getQueryState(options.queryKey).isInvalidated).toBe(true)
    expect(reads).toBe(1)
  } finally {
    unsubscribe()
  }
})

test('out-of-order appends keep the cache invalidated instead of losing a saved row', async () => {
  const pending = []
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: { values: {
    get: async () => ({ result: { values: [['Student']] } }),
    append: () => new Promise((resolve) => pending.push(resolve)),
  } } } } } }
  await fetchExistingRows()
  const first = appendRows([{ student: 'Alice', teacher: 'Teacher', page: 1, date: '2026-11-13' }])
  const second = appendRows([{ student: 'Bob', teacher: 'Teacher', page: 2, date: '2026-11-13' }])
  await new Promise(setImmediate)
  pending[1]({ result: { updates: { updatedRange: 'Pages!A3:D3', updatedData: { values: [['Bob', 'Teacher', '2', '2026-11-13']] } } } })
  await second
  pending[0]({ result: { updates: { updatedRange: 'Pages!A2:D2', updatedData: { values: [['Alice', 'Teacher', '1', '2026-11-13']] } } } })
  await first
  expect(queryClient.getQueryState(sheetValuesQueryOptions('Pages!A2:D').queryKey).isInvalidated).toBe(true)
})

test('group attendance uses one batch write for every student and skips unchanged cells', async () => {
  const { saveGroupAttendance } = await import('../src/sheets/attendanceClient')
  const status = ATTENDANCE_STATUSES[0].value
  const values = [Array.from({ length: 13 }, (_, i) => i === 12 ? 'Fri 13/11' : ''),
    ...Array.from({ length: 20 }, (_, i) => [String(i), ...Array(11).fill(''), i === 0 ? status : ''])]
  const calls = []
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: { values: {
    get: async () => { calls.push('read'); return { result: { values: values.map((row) => [...row]) } } },
    update: async () => { calls.push('write') },
    batchUpdate: async (request) => { calls.push(request) },
  } } } } } }
  await saveGroupAttendance('2026-11-13', Array.from({ length: 20 }, (_, i) => ({ rowNumber: i + 2, status })))
  expect(calls).toHaveLength(2)
  expect(calls[0]).toBe('read')
  expect(calls[1].resource.data).toHaveLength(19)
  expect(calls[1].resource.data[0]).toEqual({ range: "'AutoAttendance'!M3", values: [[status]] })
  const cached = await fetchAttendanceSheet()
  expect(getStudentAttendanceHistory(cached, '19')).toEqual([{ date: 'Fri 13/11', status }])
  expect(calls).toHaveLength(2)
})

test('new attendance dates and all statuses share one batch; unchanged saves make no writes', async () => {
  const { saveGroupAttendance } = await import('../src/sheets/attendanceClient')
  const status = ATTENDANCE_STATUSES[0].value
  const values = [Array(12).fill(''), ['Alice', ...Array(11).fill('')], ['Bob', ...Array(11).fill('')]]
  const calls = []
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: { values: {
    get: async () => { calls.push('read'); return { result: { values: values.map((row) => [...row]) } } },
    batchUpdate: async (request) => {
      calls.push(request)
      for (const cell of request.resource.data) values[Number(/M(\d+)$/.exec(cell.range)[1]) - 1][12] = cell.values[0][0]
    },
  } } } } } }
  const updates = [{ rowNumber: 2, status }, { rowNumber: 3, status }]
  await saveGroupAttendance('2026-11-13', updates)
  expect(calls).toHaveLength(2)
  expect(calls[1].resource.data).toHaveLength(3)
  expect(getStudentAttendanceHistory(await fetchAttendanceSheet(), 'Alice')).toEqual([{ date: 'Fri 13/11', status }])
  await saveGroupAttendance('2026-11-13', updates)
  expect(calls).toHaveLength(3)
  expect(calls[2]).toBe('read')
  await saveGroupAttendance('2026-11-13', [])
  expect(calls).toHaveLength(3)
})

test('failed attendance batches leave confirmed cached cells unchanged', async () => {
  const { saveGroupAttendance } = await import('../src/sheets/attendanceClient')
  const values = [Array(12).fill(''), ['Alice', ...Array(11).fill('')]]
  let writes = 0
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: { values: {
    get: async () => ({ result: { values } }),
    batchUpdate: async () => { writes++; throw new Error('Batch failed') },
  } } } } } }
  await expect(saveGroupAttendance('2026-11-13', [{ rowNumber: 2, status: ATTENDANCE_STATUSES[0].value }])).rejects.toThrow('Batch failed')
  expect(writes).toBe(1)
  expect(getStudentAttendanceHistory(await fetchAttendanceSheet(), 'Alice')).toEqual([])
})

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

const { savePageRows, PageStudentError } = await import('../src/sheets/pageLogging')
const { activateStudent } = await import('../src/sheets/rosterClient')

function pageLoggingApi() {
  const fixture = rosterApi()
  const pages = []
  fixture.api.values.append = async (request) => {
    fixture.calls.push({ kind: 'pages-append', ...request })
    pages.push(...request.resource.values)
  }
  return { ...fixture, pages }
}

const pageFor = (student) => [{ student, teacher: 'Teacher', page: 7, date: '2026-11-07' }]

test('saving pages for an inactive student activates column F and updates shared roster data', async () => {
  const { pages, calls, values } = pageLoggingApi()
  expect((await fetchActivationStudents())[1].active).toBe(false)
  calls.length = 0
  expect(await savePageRows(pageFor('Bob'))).toEqual({ kind: 'saved' })
  expect(pages).toHaveLength(1)
  expect(values[3][5]).toBe('TRUE')
  expect(values[3][8]).toBe('B')
  expect((await fetchGroupStudents())[1].active).toBe(true)
  expect(calls.map((call) => call.kind)).toEqual(['pages-append', 'read', 'write'])
})

test('page logging never toggles an already active student off and checks external status changes', async () => {
  const { calls, values, pages } = pageLoggingApi()
  await fetchRosterSheet()
  calls.length = 0
  await savePageRows(pageFor('Alice'))
  expect(values[1][5]).toBe('TRUE')
  expect(calls.map((call) => call.kind)).toEqual(['pages-append', 'read'])
  values[1][5] = 'FALSE'
  await savePageRows(pageFor('Alice'))
  expect(values[1][5]).toBe('TRUE')
  expect(pages).toHaveLength(2)
})

test('page append failures do not activate the student', async () => {
  const { api, calls, values } = pageLoggingApi()
  api.values.append = async () => { throw new Error('Append failed') }
  await expect(savePageRows(pageFor('Bob'))).rejects.toThrow('Append failed')
  expect(values[3][5]).toBe('FALSE')
  expect(calls.some((call) => call.kind === 'write')).toBe(false)
})

test('activation failure after a page save can be retried without appending pages again', async () => {
  const { api, pages } = pageLoggingApi()
  const update = api.values.update
  api.values.update = async () => { throw new Error('Activation failed') }
  const result = await savePageRows(pageFor('Bob'))
  expect(result.kind).toBe('activation-pending')
  expect(pages).toHaveLength(1)
  api.values.update = update
  await activateStudent(result.student)
  expect(pages).toHaveLength(1)
  expect((await fetchActivationStudents())[1].active).toBe(true)
})

test('page logging rejects missing, ambiguous, and mixed student names before inserting rows', async () => {
  const { values, pages } = pageLoggingApi()
  values.push([...values[1]])
  await expect(savePageRows(pageFor('Missing'))).rejects.toBeInstanceOf(PageStudentError)
  await expect(savePageRows(pageFor('Alice'))).rejects.toBeInstanceOf(PageStudentError)
  await expect(savePageRows([...pageFor('Bob'), ...pageFor('Other')])).rejects.toBeInstanceOf(PageStudentError)
  expect(pages).toHaveLength(0)
})

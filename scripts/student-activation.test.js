import { expect, mock, test } from 'bun:test'

mock.module('../src/config', () => ({ config: { rosterSheetId: 'roster', rosterGid: '42', rosterNameColumn: 'A' } }))
const { fetchActivationStudents, updateStudentActive, fetchRosterSheet, SheetsAccessError } = {
  ...await import('../src/sheets/rosterClient'),
  ...await import('../src/sheets/sheetsClient'),
}

test('activation preserves physical rows and writes only F, refreshing the cached roster', async () => {
  const values = [['Name', '', '', '', '', 'Active'], ['Active', '', '', '', '', 'TRUE'], [], ['', '', 'summary'], ['Disabled', '', '', '', '', 'FALSE']]
  const writes = []
  globalThis.window = { gapi: { client: { sheets: { spreadsheets: {
    get: async () => ({ result: { sheets: [{ properties: { sheetId: 42, title: "Roster's tab" } }] } }),
    values: {
      get: async () => ({ result: { values: values.map((row) => [...row]) } }),
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

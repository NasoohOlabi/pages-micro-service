import { queryOptions } from '@tanstack/react-query'
import { config } from '../config'
import { withTokenRetry } from '../auth/token'
import { SheetsAccessError } from './sheetsClient'
import { isActiveStudent } from '../students/visibility'
import { queryClient, cacheSession } from '../queryClient'

export interface RosterSheet {
  title: string
  headers: string[]
  // Keep blank rows so array offsets continue to identify physical sheet rows.
  rows: string[][]
  nameColumnIndex: number
}

export interface ActivationStudent {
  rowNumber: number
  name: string
  active: boolean
}

export interface GroupStudent extends ActivationStudent {
  group: string
}

const titleQuery = queryOptions({
  queryKey: ['roster-title', config.rosterSheetId, config.rosterGid],
  staleTime: 60 * 60_000,
  gcTime: 60 * 60_000,
  queryFn: async () => {
    const response = await withTokenRetry(() => window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: config.rosterSheetId,
      fields: 'sheets.properties',
    }))
    const sheet = response.result.sheets?.find((item) => item.properties.sheetId === Number(config.rosterGid))
    if (!sheet) throw new Error(`Roster tab with gid ${config.rosterGid} not found.`)
    return sheet.properties.title
  },
})

export const rosterQueryOptions = queryOptions({
  queryKey: ['roster', config.rosterSheetId, config.rosterGid, config.rosterNameColumn],
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<RosterSheet> => {
    try {
      const title = await queryClient.fetchQuery(titleQuery)
      const response = await withTokenRetry(() => window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: config.rosterSheetId,
        range: `${quoteSheetTitle(title)}!A:ZZ`,
      }))
      const values = response.result.values ?? []
      return {
        title,
        headers: (values[0] ?? []).map((value) => String(value ?? '').trim()),
        rows: values.slice(1).map((row) => row.map((value) => String(value ?? '').trim())),
        nameColumnIndex: columnLetterToIndex(config.rosterNameColumn),
      }
    } catch (err) {
      handleRosterAccessError(err)
    }
  },
})

export function fetchRosterSheet(): Promise<RosterSheet> {
  return queryClient.fetchQuery(rosterQueryOptions)
}

export function rosterStudents(sheet: RosterSheet): ActivationStudent[] {
  return sheet.rows.map((row, index) => ({
    rowNumber: index + 2,
    name: row[sheet.nameColumnIndex]?.trim() ?? '',
    active: isActiveStudent(row[5]),
  })).filter((student) => student.name)
}

export function rosterGroups(sheet: RosterSheet): GroupStudent[] {
  const groupIndex = rosterGroupColumnIndex(sheet.headers)
  return rosterStudents(sheet).map((student) => ({
    ...student, group: sheet.rows[student.rowNumber - 2][groupIndex]?.trim() ?? '',
  }))
}

export async function fetchActivationStudents(): Promise<ActivationStudent[]> {
  return rosterStudents(await fetchRosterSheet())
}

export async function fetchGroupStudents(): Promise<GroupStudent[]> {
  return rosterGroups(await fetchRosterSheet())
}

export async function fetchRosterNames(): Promise<string[]> {
  return [...new Set(rosterStudents(await fetchRosterSheet()).map((student) => student.name))]
}

async function patchRosterCell(session: number, rowNumber: number, column: number, value: string) {
  if (session !== cacheSession) return
  await queryClient.cancelQueries({ queryKey: rosterQueryOptions.queryKey })
  if (session !== cacheSession) return
  const updatedAt = queryClient.getQueryState(rosterQueryOptions.queryKey)?.dataUpdatedAt
  queryClient.setQueryData(rosterQueryOptions.queryKey, (sheet) => sheet && ({
    ...sheet,
    rows: sheet.rows.map((row, index) => {
      if (index !== rowNumber - 2) return row
      const next = [...row]
      next[column] = value
      return next
    }),
  }), { updatedAt })
}

export async function updateStudentActive(student: ActivationStudent): Promise<void> {
  const session = cacheSession
  try {
    const sheet = await fetchRosterSheet()
    const response = await withTokenRetry(() => window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: config.rosterSheetId,
      range: `${quoteSheetTitle(sheet.title)}!A${student.rowNumber}:ZZ${student.rowNumber}`,
    }))
    const row = response.result.values?.[0]
    if (!row || String(row[sheet.nameColumnIndex] ?? '').trim() !== student.name || isActiveStudent(String(row[5] ?? '')) !== student.active) throw new Error('Roster changed')
    if (session !== cacheSession) throw new Error('Session changed')
    await queryClient.cancelQueries({ queryKey: rosterQueryOptions.queryKey })
    const value = student.active ? 'FALSE' : 'TRUE'
    await withTokenRetry(() => window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: config.rosterSheetId,
      range: `${quoteSheetTitle(sheet.title)}!F${student.rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[value]] },
    }))
    await patchRosterCell(session, student.rowNumber, 5, value)
  } catch (err) {
    if (session === cacheSession) void queryClient.invalidateQueries({ queryKey: rosterQueryOptions.queryKey, refetchType: 'none' })
    handleRosterAccessError(err)
  }
}

export async function updateStudentGroup(student: GroupStudent, group: string): Promise<void> {
  const session = cacheSession
  try {
    const sheet = await fetchRosterSheet()
    const response = await withTokenRetry(() => window.gapi.client.sheets.spreadsheets.values.batchGet({
      spreadsheetId: config.rosterSheetId,
      ranges: [`${quoteSheetTitle(sheet.title)}!A1:ZZ1`, `${quoteSheetTitle(sheet.title)}!A${student.rowNumber}:ZZ${student.rowNumber}`],
    }))
    const headers = response.result.valueRanges?.[0]?.values?.[0] ?? []
    const row = response.result.valueRanges?.[1]?.values?.[0]
    const column = rosterGroupColumnIndex(headers)
    if (column !== rosterGroupColumnIndex(sheet.headers) || !row || String(row[sheet.nameColumnIndex] ?? '').trim() !== student.name || String(row[column] ?? '').trim() !== student.group) throw new Error('Roster changed')
    if (session !== cacheSession) throw new Error('Session changed')
    await queryClient.cancelQueries({ queryKey: rosterQueryOptions.queryKey })
    await withTokenRetry(() => window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: config.rosterSheetId,
      range: `${quoteSheetTitle(sheet.title)}!${indexToColumnLetter(column)}${student.rowNumber}`,
      valueInputOption: 'RAW',
      resource: { values: [[group]] },
    }))
    await patchRosterCell(session, student.rowNumber, column, group)
  } catch (err) {
    if (session === cacheSession) void queryClient.invalidateQueries({ queryKey: rosterQueryOptions.queryKey, refetchType: 'none' })
    handleRosterAccessError(err)
  }
}

export async function appendRosterStudent(values: string[]): Promise<void> {
  const session = cacheSession
  try {
    const title = await queryClient.fetchQuery(titleQuery)
    await withTokenRetry(() => window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: config.rosterSheetId,
      range: `${quoteSheetTitle(title)}!A:ZZ`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [values] },
    }))
    if (session === cacheSession) await queryClient.invalidateQueries({ queryKey: rosterQueryOptions.queryKey })
  } catch (err) {
    handleRosterAccessError(err)
  }
}

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`
}

function columnLetterToIndex(column: string): number {
  const index = column
    .trim()
    .toUpperCase()
    .split('')
    .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1
  return Math.max(index, 0)
}

function handleRosterAccessError(err: unknown): never {
  const status = (err as { status?: number; result?: { error?: { code?: number } } })?.status
  const code = status ?? (err as { result?: { error?: { code?: number } } })?.result?.error?.code
  if (code === 403) {
    throw new SheetsAccessError(
      "You don't have access to the roster sheet — ask an admin to share it with you.",
    )
  }
  throw err
}

export function rosterGroupColumnIndex(headers: string[]): number {
  const matches = headers.map((header, index) => ({ header: header.trim(), index }))
    .filter(({ header }) => header === '\u062d\u0644\u0642\u0629' || header === '\u0627\u0644\u062d\u0644\u0642\u0629')
  if (matches.length !== 1) throw new Error('Roster group column not found or ambiguous')
  return matches[0].index
}

function indexToColumnLetter(index: number): string {
  let value = index + 1
  let result = ''
  while (value > 0) {
    value -= 1
    result = String.fromCharCode(65 + value % 26) + result
    value = Math.floor(value / 26)
  }
  return result
}

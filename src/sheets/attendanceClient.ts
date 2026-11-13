import { queryOptions } from '@tanstack/react-query'
import { queryClient, cacheSession } from '../queryClient'
import { config } from '../config'
import { withSheetsAccessErrorHandling } from './sheetsClient'

const STUDENT_COLUMN_INDEX = 0
const GROUP_COLUMN_INDEX = 7
const FIRST_DATE_COLUMN_INDEX = 12
const SHEET_RANGE = 'A1:ZZ'
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const ATTENDANCE_STATUSES = [
  { value: 'مبكر', labelKey: 'attendanceEarly' },
  { value: 'حاضر', labelKey: 'attendancePresent' },
  { value: 'غائب', labelKey: 'attendanceAbsent' },
  { value: 'متأخر', labelKey: 'attendanceLate' },
  { value: 'معذور', labelKey: 'attendanceExcused' },
] as const

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]['value']

export interface AttendanceStudentRow {
  rowNumber: number
  student: string
  group: string
  values: string[]
}

export interface AttendanceSheet {
  rows: string[][]
  students: AttendanceStudentRow[]
  groups: string[]
}

export interface AttendanceUpdate {
  rowNumber: number
  status: AttendanceStatus
}

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`
}

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function columnToLetter(index: number): string {
  let value = index + 1
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

function cellRange(rowNumber: number, columnIndex: number): string {
  const column = columnToLetter(columnIndex)
  return `${quoteSheetTitle(config.attendanceSheetName)}!${column}${rowNumber}`
}

function dateFromInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatAttendanceDate(value: string): string {
  const date = dateFromInput(value)
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`
}

function attendanceFromRows(rows: string[][]): AttendanceSheet {
  const students = rows.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    student: row[STUDENT_COLUMN_INDEX]?.trim() ?? '',
    group: row[GROUP_COLUMN_INDEX]?.trim() ?? '',
    values: row,
  })).filter((row) => row.student)
  const groups = [...new Set(students.map((row) => row.group).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  return { rows, students, groups }
}

export const attendanceQueryOptions = queryOptions({
  queryKey: ['attendance', config.attendanceSheetId, config.attendanceSheetName],
  queryFn: () => withSheetsAccessErrorHandling(async () => {
    const response = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: config.attendanceSheetId,
      range: `${quoteSheetTitle(config.attendanceSheetName)}!${SHEET_RANGE}`,
    })
    return attendanceFromRows(response.result.values ?? [])
  }),
})

export function fetchAttendanceSheet(fresh = false): Promise<AttendanceSheet> {
  return queryClient.fetchQuery({ ...attendanceQueryOptions, ...(fresh ? { staleTime: 0 } : {}) })
}

function patchAttendanceCell(session: number, rowNumber: number, column: number, value: string) {
  if (session !== cacheSession) return
  const updatedAt = queryClient.getQueryState(attendanceQueryOptions.queryKey)?.dataUpdatedAt
  queryClient.setQueryData(attendanceQueryOptions.queryKey, (sheet) => {
    if (!sheet) return sheet
    const rows = [...sheet.rows]
    const row = [...(rows[rowNumber - 1] ?? [])]
    row[column] = value
    rows[rowNumber - 1] = row
    return attendanceFromRows(rows)
  }, { updatedAt })
}

function findDateColumn(rows: string[][], dateLabel: string): number | null {
  const header = rows[0] ?? []
  for (let index = FIRST_DATE_COLUMN_INDEX; index < header.length; index += 1) {
    if (normalize(header[index]) === normalize(dateLabel)) return index
  }
  return null
}

function nextDateColumn(rows: string[][]): number {
  const header = rows[0] ?? []
  for (let index = FIRST_DATE_COLUMN_INDEX; index < header.length; index += 1) {
    if (!header[index]?.trim()) return index
  }
  return Math.max(header.length, FIRST_DATE_COLUMN_INDEX)
}

async function ensureDateColumn(sheet: AttendanceSheet, dateLabel: string): Promise<number> {
  const session = cacheSession
  const existingColumn = findDateColumn(sheet.rows, dateLabel)
  if (existingColumn !== null) return existingColumn

  const columnIndex = nextDateColumn(sheet.rows)
  await withSheetsAccessErrorHandling(() =>
    window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: config.attendanceSheetId,
      range: cellRange(1, columnIndex),
      valueInputOption: 'RAW',
      resource: { values: [[dateLabel]] },
    }),
  )
  patchAttendanceCell(session, 1, columnIndex, dateLabel)
  return columnIndex
}

async function updateAttendanceCell(
  rowNumber: number,
  columnIndex: number,
  status: AttendanceStatus,
): Promise<void> {
  const session = cacheSession
  await withSheetsAccessErrorHandling(() =>
    window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: config.attendanceSheetId,
      range: cellRange(rowNumber, columnIndex),
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[status]] },
    }),
  )
  patchAttendanceCell(session, rowNumber, columnIndex, status)
}

export function findAttendanceStudent(
  sheet: AttendanceSheet,
  student: string,
): AttendanceStudentRow | undefined {
  const target = normalize(student)
  return sheet.students.find((row) => normalize(row.student) === target)
}

export interface AttendanceHistoryEntry {
  date: string
  status: string
}

export function getStudentAttendanceHistory(
  sheet: AttendanceSheet,
  student: string,
): AttendanceHistoryEntry[] {
  const row = findAttendanceStudent(sheet, student)
  if (!row) return []
  const header = sheet.rows[0] ?? []
  const history: AttendanceHistoryEntry[] = []
  for (let index = FIRST_DATE_COLUMN_INDEX; index < header.length; index += 1) {
    const date = header[index]?.trim()
    const status = row.values[index]?.trim()
    if (date && status) history.push({ date, status })
  }
  return history
}

export function attendanceStatusForDate(
  row: AttendanceStudentRow,
  sheet: AttendanceSheet,
  dateLabel: string,
): AttendanceStatus | '' {
  const columnIndex = findDateColumn(sheet.rows, dateLabel)
  if (columnIndex === null) return ''
  const value = row.values[columnIndex]?.trim() ?? ''
  return ATTENDANCE_STATUSES.some((status) => status.value === value)
    ? (value as AttendanceStatus)
    : ''
}

export async function saveStudentAttendance(
  student: string,
  date: string,
  status: AttendanceStatus,
): Promise<void> {
  const sheet = await fetchAttendanceSheet(true)
  const row = findAttendanceStudent(sheet, student)
  if (!row) throw new Error('Student was not found in the attendance sheet.')

  const columnIndex = await ensureDateColumn(sheet, formatAttendanceDate(date))
  if (row.values[columnIndex]?.trim() === status) return
  await updateAttendanceCell(row.rowNumber, columnIndex, status)
}

export async function saveGroupAttendance(
  date: string,
  updates: AttendanceUpdate[],
): Promise<void> {
  if (updates.length === 0) return
  const session = cacheSession
  const sheet = await fetchAttendanceSheet(true)
  const dateLabel = formatAttendanceDate(date)
  const existingColumn = findDateColumn(sheet.rows, dateLabel)
  const columnIndex = existingColumn ?? nextDateColumn(sheet.rows)
  const changed = updates.filter((update) => sheet.rows[update.rowNumber - 1]?.[columnIndex]?.trim() !== update.status)
  const data: Parameters<typeof window.gapi.client.sheets.spreadsheets.values.batchUpdate>[0]['resource']['data'] =
    changed.map((update) => ({ range: cellRange(update.rowNumber, columnIndex), values: [[update.status]] }))
  if (existingColumn === null) data.unshift({ range: cellRange(1, columnIndex), values: [[dateLabel]] })
  if (data.length === 0) return
  if (session !== cacheSession) throw new Error('Session changed')
  await queryClient.cancelQueries({ queryKey: attendanceQueryOptions.queryKey })
  await withSheetsAccessErrorHandling(() => window.gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.attendanceSheetId,
    resource: {
      valueInputOption: 'USER_ENTERED',
      data,
    },
  }))
  if (existingColumn === null) patchAttendanceCell(session, 1, columnIndex, dateLabel)
  for (const update of changed) {
    patchAttendanceCell(session, update.rowNumber, columnIndex, update.status)
  }
}

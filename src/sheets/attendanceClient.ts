import { saveAttendance, spreadsheets } from './transport'
import {
  ATTENDANCE_STATUSES,
  FIRST_DATE_COLUMN_INDEX,
  type AttendanceSave,
  type AttendanceStatus,
  type AttendanceUpdate,
} from './attendance'
export {
  ATTENDANCE_STATUSES,
  formatAttendanceDate,
  type AttendanceStatus,
  type AttendanceUpdate,
} from './attendance'
import { queryOptions } from '@tanstack/react-query'
import { queryClient, cacheSession } from '../queryClient'
import { config } from '../config'

const STUDENT_COLUMN_INDEX = 0
const GROUP_COLUMN_INDEX = 7
const SHEET_RANGE = 'A1:ZZ'
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

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`
}

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function attendanceFromRows(rows: string[][]): AttendanceSheet {
  const students = rows
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      student: row[STUDENT_COLUMN_INDEX]?.trim() ?? '',
      group: row[GROUP_COLUMN_INDEX]?.trim() ?? '',
      values: row,
    }))
    .filter((row) => row.student)
  const groups = [...new Set(students.map((row) => row.group).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
  return { rows, students, groups }
}

export const attendanceQueryOptions = queryOptions({
  queryKey: ['attendance', config.attendanceSheetId, config.attendanceSheetName],
  queryFn: async () => {
    const response = await spreadsheets.values.get({
      spreadsheetId: config.attendanceSheetId,
      range: `${quoteSheetTitle(config.attendanceSheetName)}!${SHEET_RANGE}`,
    })
    return attendanceFromRows(response.result.values ?? [])
  },
})

export function fetchAttendanceSheet(fresh = false): Promise<AttendanceSheet> {
  return queryClient.fetchQuery({ ...attendanceQueryOptions, ...(fresh ? { staleTime: 0 } : {}) })
}

function findDateColumn(rows: string[][], dateLabel: string): number | null {
  const header = rows[0] ?? []
  for (let index = FIRST_DATE_COLUMN_INDEX; index < header.length; index += 1) {
    if (normalize(header[index]) === normalize(dateLabel)) return index
  }
  return null
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
  return ATTENDANCE_STATUSES.some((status) => status.value === value) ? (value as AttendanceStatus) : ''
}

async function persistAttendance(entry: AttendanceSave) {
  const session = cacheSession
  const { queryKey } = attendanceQueryOptions
  await queryClient.cancelQueries({ queryKey })
  if (session !== cacheSession) return
  const snapshot = queryClient.getQueryData(queryKey)
  const rows = await saveAttendance(entry)
  if (session !== cacheSession) return
  if (queryClient.getQueryData(queryKey) !== snapshot) {
    await queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
    return
  }
  queryClient.setQueryData(queryKey, attendanceFromRows(rows))
}

export async function saveStudentAttendance(student: string, date: string, status: AttendanceStatus) {
  await persistAttendance({ student, date, status })
}

export async function saveGroupAttendance(date: string, updates: AttendanceUpdate[]) {
  if (updates.length) await persistAttendance({ date, updates })
}

import { api } from '../api'

const STUDENT_COLUMN_INDEX = 0
const GROUP_COLUMN_INDEX = 7
const FIRST_DATE_COLUMN_INDEX = 12
import { ATTENDANCE_STATUSES, type AttendanceStatus } from './attendance'
export { ATTENDANCE_STATUSES, formatAttendanceDate, type AttendanceStatus } from './attendance'

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

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export async function fetchAttendanceSheet(): Promise<AttendanceSheet> {
  const rows = await api<string[][]>('attendance')
  const students = rows
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      student: row[STUDENT_COLUMN_INDEX]?.trim() ?? '',
      group: row[GROUP_COLUMN_INDEX]?.trim() ?? '',
      values: row,
    }))
    .filter((row) => row.student)
  const groups = Array.from(new Set(students.map((row) => row.group).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
  return { rows, students, groups }
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
  return ATTENDANCE_STATUSES.some((status) => status.value === value)
    ? (value as AttendanceStatus)
    : ''
}

export async function saveStudentAttendance(
  student: string,
  date: string,
  status: AttendanceStatus,
): Promise<void> {
  await api('attendance', { student, date, status })
}

export async function saveGroupAttendance(
  date: string,
  updates: AttendanceUpdate[],
): Promise<void> {
  await api('attendance', { date, updates })
}

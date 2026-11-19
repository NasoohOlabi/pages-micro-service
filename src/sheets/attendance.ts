const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const ATTENDANCE_STATUSES = [
  { value: 'مبكر', labelKey: 'attendanceEarly' },
  { value: 'حاضر', labelKey: 'attendancePresent' },
  { value: 'غائب', labelKey: 'attendanceAbsent' },
  { value: 'متأخر', labelKey: 'attendanceLate' },
  { value: 'معذور', labelKey: 'attendanceExcused' },
] as const

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]['value']

function dateFromInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatAttendanceDate(value: string): string {
  const date = dateFromInput(value)
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`
}


export const FIRST_DATE_COLUMN_INDEX = 12

export interface AttendanceUpdate {
  rowNumber: number
  status: AttendanceStatus
}

export type AttendanceSave =
  | { date: string; student: string; status: AttendanceStatus }
  | { date: string; updates: AttendanceUpdate[] }

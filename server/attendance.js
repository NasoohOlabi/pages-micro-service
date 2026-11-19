import { z } from 'zod'
import { ATTENDANCE_STATUSES, FIRST_DATE_COLUMN_INDEX, formatAttendanceDate } from '../src/sheets/attendance'

const status = z.enum(ATTENDANCE_STATUSES.map(({ value }) => value))
const date = z.iso.date()
const attendanceRequest = z.union([
  z.object({ date, student: z.string().trim().min(1), status }),
  z.object({ date, updates: z.array(z.object({ rowNumber: z.number().int().min(2), status })).max(2000) }),
])

function columnLetter(index) {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

export async function saveAttendance(request, title, read, batchUpdate) {
  const entry = attendanceRequest.parse(request)
  const rows = await read()
  const dateLabel = formatAttendanceDate(entry.date)
  const header = rows[0] ?? []
  const existingColumn = header.findIndex(
    (value, index) =>
      index >= FIRST_DATE_COLUMN_INDEX && value.trim().toLowerCase() === dateLabel.toLowerCase(),
  )
  const openColumn = header.findIndex((value, index) => index >= FIRST_DATE_COLUMN_INDEX && !value.trim())
  const column =
    existingColumn >= 0
      ? existingColumn
      : openColumn >= 0
        ? openColumn
        : Math.max(FIRST_DATE_COLUMN_INDEX, header.length)
  if (column >= 702) throw new Response('Attendance date columns are full.', { status: 409 })

  const updates =
    'student' in entry
      ? [
          {
            rowNumber:
              rows.findIndex(
                (row, i) => i > 0 && row[0]?.trim().toLowerCase() === entry.student.toLowerCase(),
              ) + 1,
            status: entry.status,
          },
        ]
      : entry.updates
  if (updates.length === 0) return rows

  const writes = new Map()
  for (const { rowNumber, status } of updates) {
    if (rowNumber < 2 || !rows[rowNumber - 1]?.[0]?.trim())
      throw new Response('Student was not found in the attendance sheet.', { status: 409 })
    writes.set(rowNumber, status)
  }
  for (const [rowNumber, value] of writes) {
    if (rows[rowNumber - 1][column]?.trim() === value) writes.delete(rowNumber)
  }
  if (existingColumn < 0) writes.set(1, dateLabel)
  if (!writes.size) return rows

  const letter = columnLetter(column)
  const data = [...writes].map(([rowNumber, value]) => ({
    range: title + '!' + letter + rowNumber,
    values: [[value]],
  }))
  await batchUpdate({ valueInputOption: 'RAW', data })
  return rows.map((row, index) => {
    if (!writes.has(index + 1)) return row
    const updated = [...row]
    while (updated.length < column) updated.push('')
    updated[column] = writes.get(index + 1)
    return updated
  })
}

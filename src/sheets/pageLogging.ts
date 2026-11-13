import { appendRows } from './sheetsClient'
import { activateStudent, fetchRosterSheet, rosterStudents, type ActivationStudent } from './rosterClient'
import type { SheetRowValues } from './schema'
import { studentKey } from '../students/visibility'
import { cacheSession } from '../queryClient'

export class PageStudentError extends Error {}

export type PageSaveResult = { kind: 'saved' } | { kind: 'activation-pending'; student: ActivationStudent }

export async function savePageRows(rows: SheetRowValues[]): Promise<PageSaveResult> {
  const session = cacheSession
  const name = rows[0]?.student
  if (!name || rows.some((row) => studentKey(row.student) !== studentKey(name))) throw new PageStudentError()
  const sheet = await fetchRosterSheet()
  const matches = rosterStudents(sheet).filter((student) => studentKey(student.name) === studentKey(name))
  if (matches.length !== 1) throw new PageStudentError()
  const student = matches[0]
  if (session !== cacheSession) throw new Error('Session changed')
  await appendRows(rows)
  if (session !== cacheSession) return { kind: 'activation-pending', student }
  try {
    await activateStudent(student)
    return { kind: 'saved' }
  } catch {
    return { kind: 'activation-pending', student }
  }
}

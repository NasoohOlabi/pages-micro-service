import { config } from '../config'
import { withTokenRetry } from '../auth/token'
import { SheetsAccessError } from './sheetsClient'

export interface Teacher {
  name: string
  email: string
}

let teachersPromise: Promise<Teacher[]> | null = null

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`
}

async function loadTeachers(): Promise<Teacher[]> {
  try {
    const range = `${quoteSheetTitle(config.teachersSheetName)}!${config.teachersNameColumn}2:${config.teachersEmailColumn}`
    const response = await withTokenRetry(() =>
      window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: config.teachersSheetId,
        range,
      }),
    )
    const nameIdx = 0
    const emailIdx = config.teachersEmailColumn.charCodeAt(0) - config.teachersNameColumn.charCodeAt(0)
    const rows = response.result.values ?? []
    const teachers = rows
      .map((row) => ({ name: row[nameIdx]?.trim() ?? '', email: row[emailIdx]?.trim() ?? '' }))
      .filter((teacher) => teacher.name)
    return teachers
  } catch (err) {
    const status = (err as { status?: number; result?: { error?: { code?: number } } })?.status
    const code = status ?? (err as { result?: { error?: { code?: number } } })?.result?.error?.code
    if (code === 403) {
      throw new SheetsAccessError(
        "You don't have access to the teachers sheet — ask an admin to share it with you.",
      )
    }
    throw err
  }
}

// Cached for the session: the teacher list rarely changes mid-session and is fetched on first use.
export function fetchTeachers(): Promise<Teacher[]> {
  if (!teachersPromise) {
    teachersPromise = loadTeachers().catch((err) => {
      teachersPromise = null
      throw err
    })
  }
  return teachersPromise
}

export function findTeacherByEmail(teachers: Teacher[], email: string): Teacher | undefined {
  const normalized = email.trim().toLowerCase()
  return teachers.find((teacher) => teacher.email.trim().toLowerCase() === normalized)
}

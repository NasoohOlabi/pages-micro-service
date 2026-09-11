import { z } from 'zod'
import type { TranslationKey } from '../i18n/translations'

type Translate = (key: TranslationKey) => string

export function createCstSchema(t: Translate) {
  return z.object({
    student: z.string().trim().min(1, t('studentRequired')),
    sabr: z.string().trim().min(1, t('sabrRequired')),
    mark: z.string().trim(),
    date: z.string().min(1, t('dateRequired')),
  })
}

export type CstSchema = ReturnType<typeof createCstSchema>
export type CstFormInput = z.input<CstSchema>
export type CstFormValues = z.output<CstSchema>

export interface CstRowValues {
  student: string
  sabr: string
  mark: string
  date: string
}

// Order must match the CST sheet columns (and VITE_CST_SHEET_RANGE).
export const CST_COLUMN_ORDER: (keyof CstRowValues)[] = ['student', 'sabr', 'mark', 'date']

export function cstRowToValues(values: CstRowValues): string[] {
  return CST_COLUMN_ORDER.map((key) => String(values[key]))
}

export function formValuesToCstRow(values: CstFormValues): CstRowValues {
  return {
    student: values.student,
    sabr: values.sabr,
    mark: values.mark,
    date: values.date,
  }
}

export function parseCstRows(raw: string[][]): CstRowValues[] {
  const studentIndex = CST_COLUMN_ORDER.indexOf('student')
  const sabrIndex = CST_COLUMN_ORDER.indexOf('sabr')
  const markIndex = CST_COLUMN_ORDER.indexOf('mark')
  const dateIndex = CST_COLUMN_ORDER.indexOf('date')

  const parsed: CstRowValues[] = []
  for (const row of raw) {
    const student = (row[studentIndex] ?? '').trim()
    if (!student) continue
    parsed.push({
      student,
      sabr: (row[sabrIndex] ?? '').trim(),
      mark: (row[markIndex] ?? '').trim(),
      date: (row[dateIndex] ?? '').trim(),
    })
  }
  return parsed
}

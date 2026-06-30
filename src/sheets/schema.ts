import { z } from 'zod'
import type { TranslationKey } from '../i18n/translations'

type Translate = (key: TranslationKey) => string

export function createEntrySchema(t: Translate) {
  const pageNumber = z.coerce
    .number()
    .int(t('pageMustBeWhole'))
    .min(1, t('pageMustBeInRange'))
    .max(604, t('pageMustBeInRange'))

  return z
    .object({
      student: z.string().trim().min(1, t('studentRequired')),
      teacher: z.string().trim().min(1, t('teacherRequired')),
      startPage: pageNumber,
      endPage: pageNumber,
      date: z.string().min(1, t('dateRequired')),
    })
    .refine((values) => values.startPage <= values.endPage, {
      message: t('startPageLessThanEnd'),
      path: ['endPage'],
    })
}

export type EntrySchema = ReturnType<typeof createEntrySchema>
export type EntryFormInput = z.input<EntrySchema>
export type EntryFormValues = z.output<EntrySchema>

export interface SheetRowValues {
  student: string
  teacher: string
  page: number
  date: string
}

// Order must match the sheet's columns (and VITE_SHEET_RANGE), e.g. Sheet1!A2:D -> student, teacher, page, date
export const COLUMN_ORDER: (keyof SheetRowValues)[] = ['student', 'teacher', 'page', 'date']

// A student shouldn't log the same page twice.
export const UNIQUE_KEY: (keyof SheetRowValues)[] = ['student', 'page']

export function rowToValues(values: SheetRowValues): string[] {
  return COLUMN_ORDER.map((key) => String(values[key]))
}

export function expandPageRange(values: EntryFormValues): SheetRowValues[] {
  const rows: SheetRowValues[] = []
  for (let page = values.startPage; page <= values.endPage; page += 1) {
    rows.push({ student: values.student, teacher: values.teacher, page, date: values.date })
  }
  return rows
}

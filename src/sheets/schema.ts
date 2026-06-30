import { z } from 'zod'

const pageNumber = z.coerce
  .number()
  .int('Page must be a whole number')
  .min(1, 'Page must be between 1 and 604')
  .max(604, 'Page must be between 1 and 604')

export const entrySchema = z
  .object({
    student: z.string().trim().min(1, 'Student is required'),
    teacher: z.string().trim().min(1, 'Teacher is required'),
    startPage: pageNumber,
    endPage: pageNumber,
    date: z.string().min(1, 'Date is required'),
  })
  .refine((values) => values.startPage <= values.endPage, {
    message: 'Start page must be less than or equal to end page',
    path: ['endPage'],
  })

export type EntryFormInput = z.input<typeof entrySchema>
export type EntryFormValues = z.output<typeof entrySchema>

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

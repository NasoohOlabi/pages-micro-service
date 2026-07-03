import { z } from 'zod'
import type { TranslationKey } from '../i18n/translations'

type Translate = (key: TranslationKey) => string

export function createPointsSchema(t: Translate) {
  const points = z.coerce
    .number()
    .int(t('pointsMustBeWhole'))
    .min(1, t('pointsMustBePositive'))

  return z.object({
    student: z.string().trim().min(1, t('studentRequired')),
    teacher: z.string().trim().min(1, t('teacherRequired')),
    points,
    date: z.string().min(1, t('dateRequired')),
    reason: z.string().trim().min(1, t('reasonRequired')),
  })
}

export type PointsSchema = ReturnType<typeof createPointsSchema>
export type PointsFormInput = z.input<PointsSchema>
export type PointsFormValues = z.output<PointsSchema>

export interface PointsRowValues {
  student: string
  teacher: string
  points: number
  date: string
  reason: string
}

// Order must match the Points sheet columns (and VITE_POINTS_SHEET_RANGE).
export const POINTS_COLUMN_ORDER: (keyof PointsRowValues)[] = [
  'student',
  'teacher',
  'points',
  'date',
  'reason',
]

export function pointsRowToValues(values: PointsRowValues): string[] {
  return POINTS_COLUMN_ORDER.map((key) => String(values[key]))
}

export function formValuesToPointsRow(values: PointsFormValues): PointsRowValues {
  return {
    student: values.student,
    teacher: values.teacher,
    points: values.points,
    date: values.date,
    reason: values.reason,
  }
}

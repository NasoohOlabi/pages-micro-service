import type { EntryFormValues } from '../sheets/schema'
import type { TranslationKey } from '../i18n/translations'

export interface FieldConfig {
  name: keyof EntryFormValues
  labelKey: TranslationKey
  type: 'text' | 'number' | 'date' | 'select'
  min?: number
  max?: number
  inputMode?: 'text' | 'numeric'
}

export const FIELDS: FieldConfig[] = [
  { name: 'student', labelKey: 'studentLabel', type: 'text' },
  { name: 'teacher', labelKey: 'teacherLabel', type: 'select' },
  { name: 'startPage', labelKey: 'startPageLabel', type: 'number', min: 1, max: 604, inputMode: 'numeric' },
  { name: 'endPage', labelKey: 'endPageLabel', type: 'number', min: 1, max: 604, inputMode: 'numeric' },
  { name: 'date', labelKey: 'dateLabel', type: 'date' },
]

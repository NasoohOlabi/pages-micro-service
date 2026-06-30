import type { EntryFormValues } from '../sheets/schema'

export interface FieldConfig {
  name: keyof EntryFormValues
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  min?: number
  max?: number
  inputMode?: 'text' | 'numeric'
}

export const FIELDS: FieldConfig[] = [
  { name: 'student', label: 'Student', type: 'text' },
  { name: 'teacher', label: 'Teacher', type: 'select' },
  { name: 'startPage', label: 'Start page', type: 'number', min: 1, max: 604, inputMode: 'numeric' },
  { name: 'endPage', label: 'End page', type: 'number', min: 1, max: 604, inputMode: 'numeric' },
  { name: 'date', label: 'Date', type: 'date' },
]

import { api } from '../api'
import type { SheetRowValues } from './schema'
export { SheetsAccessError } from '../api'

export const appendRows = (rows: SheetRowValues[]) => api<number[]>('pages', rows)

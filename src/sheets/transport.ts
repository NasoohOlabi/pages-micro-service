import { api } from '../api'
import type { AttendanceSave } from './attendance'

interface SheetsTransport {
  get(params: {
    spreadsheetId: string
    fields: string
  }): Promise<{ result: { sheets?: { properties: { sheetId: number; title: string } }[] } }>
  values: {
    batchGet(params: {
      spreadsheetId: string
      ranges: string[]
    }): Promise<{ result: { valueRanges?: { values?: string[][] }[] } }>
    get(params: {
      spreadsheetId: string
      range: string
    }): Promise<{ result: { values?: string[][]; nameColumnIndex?: number } }>
    append(params: {
      spreadsheetId: string
      range: string
      valueInputOption: string
      includeValuesInResponse?: boolean
      responseValueRenderOption?: string
      resource: { values: string[][] }
    }): Promise<{
      result: {
        duplicatePages?: number[]
        updates?: { updatedRange?: string; updatedData?: { values?: string[][] } }
      }
    }>
    update(params: {
      spreadsheetId: string
      range: string
      valueInputOption: string
      resource: { values: string[][] }
    }): Promise<unknown>
  }
}

export const spreadsheets: SheetsTransport = {
  get: (request) => api('sheets/metadata', request),
  values: {
    get: (request) => api('sheets/read', request),
    batchGet: (request) => api('sheets/read-batch', request),
    append: (request) => api('sheets/append', request),
    update: (request) => api('sheets/update', request),
  },
}

export const saveAttendance = (request: AttendanceSave) => api<string[][]>('sheets/attendance', request)

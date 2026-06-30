import { config } from '../config'
import { COLUMN_ORDER, UNIQUE_KEY, rowToValues, type SheetRowValues } from './schema'

export class SheetsAccessError extends Error {}

async function withAccessErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const status = (err as { status?: number; result?: { error?: { code?: number } } })?.status
    const code = status ?? (err as { result?: { error?: { code?: number } } })?.result?.error?.code
    if (code === 403) {
      throw new SheetsAccessError(
        "You don't have access to this sheet — ask an admin to share it with you.",
      )
    }
    throw err
  }
}

export async function fetchExistingRows(): Promise<string[][]> {
  return withAccessErrorHandling(async () => {
    const response = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: config.sheetRange,
    })
    return response.result.values ?? []
  })
}

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function isDuplicate(rows: string[][], values: SheetRowValues): boolean {
  const keyIndexes = UNIQUE_KEY.map((key) => COLUMN_ORDER.indexOf(key))
  const newKey = UNIQUE_KEY.map((key) => normalize(String(values[key])))
  return rows.some((row) => keyIndexes.every((idx, i) => normalize(row[idx]) === newKey[i]))
}

export function findDuplicatePages(rows: string[][], values: SheetRowValues[]): number[] {
  return values.filter((value) => isDuplicate(rows, value)).map((value) => value.page)
}

export async function appendRows(rows: SheetRowValues[]): Promise<void> {
  await withAccessErrorHandling(() =>
    window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: config.sheetRange,
      valueInputOption: 'USER_ENTERED',
      resource: { values: rows.map(rowToValues) },
    }),
  )
}

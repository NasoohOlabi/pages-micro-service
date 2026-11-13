import { queryOptions } from '@tanstack/react-query'
import { queryClient, cacheSession } from '../queryClient'
import { config } from '../config'
import { withTokenRetry } from '../auth/token'
import { COLUMN_ORDER, UNIQUE_KEY, rowToValues, type SheetRowValues } from './schema'
import { sheetDataRows } from './archivedRows'

export class SheetsAccessError extends Error {}

export async function withSheetsAccessErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await withTokenRetry(fn)
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

export function sheetValuesQueryOptions(range: string) {
  const title = range.slice(0, range.lastIndexOf('!'))
  return queryOptions({
    queryKey: ['sheet-values', config.sheetId, title],
    queryFn: () => withSheetsAccessErrorHandling(async () => {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: `${title}!A1:ZZ`,
      })
      return response.result.values ?? []
    }),
  })
}

export async function fetchSheetDataRows(range: string, includeArchived = false, fresh = false): Promise<string[][]> {
  const options = sheetValuesQueryOptions(range)
  const values = await queryClient.fetchQuery({ ...options, ...(fresh ? { staleTime: 0 } : {}) })
  return sheetDataRows(values, includeArchived)
}

export async function fetchExistingRows({ includeArchived = false, fresh = false }: { includeArchived?: boolean; fresh?: boolean } = {}): Promise<string[][]> {
  return fetchSheetDataRows(config.sheetRange, includeArchived, fresh)
}

export async function invalidateSheetRows(range: string, session: number) {
  if (session === cacheSession) await queryClient.invalidateQueries({ queryKey: sheetValuesQueryOptions(range).queryKey, refetchType: 'none' })
}

export async function appendSheetValues(range: string, values: string[][]): Promise<void> {
  const session = cacheSession
  const { queryKey } = sheetValuesQueryOptions(range)
  await queryClient.cancelQueries({ queryKey })
  const snapshot = queryClient.getQueryData(queryKey)
  const response = await withSheetsAccessErrorHandling(() => window.gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: config.sheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    includeValuesInResponse: true,
    responseValueRenderOption: 'FORMATTED_VALUE',
    resource: { values },
  }))
  if (session !== cacheSession) return
  const cached = queryClient.getQueryData(queryKey)
  const appended = response?.result.updates?.updatedData?.values
  const match = /!A(\d+):[A-Z]+(\d+)$/.exec(response?.result.updates?.updatedRange ?? '')
  if (!cached || cached !== snapshot || queryClient.getQueryState(queryKey)?.isInvalidated || !appended || !match ||
    Number(match[1]) !== cached.length + 1 || Number(match[2]) !== cached.length + appended.length || appended.length !== values.length) {
    await invalidateSheetRows(range, session)
    return
  }
  const updatedAt = queryClient.getQueryState(queryKey)?.dataUpdatedAt
  queryClient.setQueryData(queryKey, [...cached, ...appended], { updatedAt })
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
  await appendSheetValues(config.sheetRange, rows.map(rowToValues))
}

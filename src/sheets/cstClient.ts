import { cacheSession } from '../queryClient'
import { config } from '../config'
import { cstRowToValues, type CstRowValues } from './cstSchema'
import { fetchSheetDataRows, invalidateSheetRows, withSheetsAccessErrorHandling } from './sheetsClient'

export async function fetchExistingCstRows(): Promise<string[][]> {
  return fetchSheetDataRows(config.cstSheetRange)
}

export async function appendCstRow(row: CstRowValues): Promise<void> {
  const session = cacheSession
  await withSheetsAccessErrorHandling(() =>
    window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: config.cstSheetRange,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [cstRowToValues(row)] },
    }),
  )
  await invalidateSheetRows(config.cstSheetRange, session)
}

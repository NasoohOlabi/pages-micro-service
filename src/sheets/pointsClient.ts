import { cacheSession } from '../queryClient'
import { config } from '../config'
import { pointsRowToValues, type PointsRowValues } from './pointsSchema'
import { fetchSheetDataRows, invalidateSheetRows, withSheetsAccessErrorHandling } from './sheetsClient'

export async function fetchExistingPointRows(): Promise<string[][]> {
  return fetchSheetDataRows(config.pointsSheetRange)
}

export async function appendPointRow(row: PointsRowValues): Promise<void> {
  const session = cacheSession
  await withSheetsAccessErrorHandling(() =>
    window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: config.pointsSheetRange,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [pointsRowToValues(row)] },
    }),
  )
  await invalidateSheetRows(config.pointsSheetRange, session)
}

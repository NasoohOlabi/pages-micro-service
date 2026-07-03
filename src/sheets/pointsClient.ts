import { config } from '../config'
import { pointsRowToValues, type PointsRowValues } from './pointsSchema'
import { withSheetsAccessErrorHandling } from './sheetsClient'

export async function appendPointRow(row: PointsRowValues): Promise<void> {
  await withSheetsAccessErrorHandling(() =>
    window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: config.pointsSheetRange,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [pointsRowToValues(row)] },
    }),
  )
}

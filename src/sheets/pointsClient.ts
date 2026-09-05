import { config } from '../config'
import { pointsRowToValues, type PointsRowValues } from './pointsSchema'
import { withSheetsAccessErrorHandling } from './sheetsClient'

export async function fetchExistingPointRows(): Promise<string[][]> {
  return withSheetsAccessErrorHandling(async () => {
    const response = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: config.pointsSheetRange,
    })
    return response.result.values ?? []
  })
}

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

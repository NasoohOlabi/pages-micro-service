import { config } from '../config'
import { cstRowToValues, type CstRowValues } from './cstSchema'
import { withSheetsAccessErrorHandling } from './sheetsClient'

export async function appendCstRow(row: CstRowValues): Promise<void> {
  await withSheetsAccessErrorHandling(() =>
    window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: config.cstSheetRange,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [cstRowToValues(row)] },
    }),
  )
}

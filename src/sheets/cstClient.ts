import { config } from '../config'
import { cstRowToValues, type CstRowValues } from './cstSchema'
import { fetchSheetDataRows, appendSheetValues } from './sheetsClient'

export async function fetchExistingCstRows(): Promise<string[][]> {
  return fetchSheetDataRows(config.cstSheetRange)
}

export async function appendCstRow(row: CstRowValues): Promise<void> {
  await appendSheetValues(config.cstSheetRange, [cstRowToValues(row)])
}

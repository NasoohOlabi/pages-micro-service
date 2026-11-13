import { config } from '../config'
import { pointsRowToValues, type PointsRowValues } from './pointsSchema'
import { fetchSheetDataRows, appendSheetValues } from './sheetsClient'

export async function fetchExistingPointRows(): Promise<string[][]> {
  return fetchSheetDataRows(config.pointsSheetRange)
}

export async function appendPointRow(row: PointsRowValues): Promise<void> {
  await appendSheetValues(config.pointsSheetRange, [pointsRowToValues(row)])
}

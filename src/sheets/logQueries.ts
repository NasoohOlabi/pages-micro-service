import { config } from '../config'
import { sheetValuesQueryOptions } from './sheetsClient'
import { sheetDataRows } from './archivedRows'
import { parseSheetRows } from './schema'
import { parsePointsRows } from './pointsSchema'
import { parseCstRows } from './cstSchema'

export const pagesQueryOptions = {
  ...sheetValuesQueryOptions(config.sheetRange),
  select: (values: string[][]) => parseSheetRows(sheetDataRows(values, false)),
}

export const memorizationQueryOptions = {
  ...pagesQueryOptions,
  select: (values: string[][]) => parseSheetRows(sheetDataRows(values, true)),
}

export const pointsQueryOptions = {
  ...sheetValuesQueryOptions(config.pointsSheetRange),
  select: (values: string[][]) => parsePointsRows(sheetDataRows(values, false)),
}

export const cstQueryOptions = {
  ...sheetValuesQueryOptions(config.cstSheetRange),
  select: (values: string[][]) => parseCstRows(sheetDataRows(values, false)),
}

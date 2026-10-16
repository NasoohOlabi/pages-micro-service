import assert from 'node:assert/strict'
import { sheetDataRows } from '../src/sheets/archivedRows'
import { parseSheetRows } from '../src/sheets/schema'
import { parsePointsRows } from '../src/sheets/pointsSchema'
import { parseCstRows } from '../src/sheets/cstSchema'
import { computeFinalsStandings } from '../src/stats/finals'

const pages = [
  ['Student', 'Teacher', 'Page', 'Date', ' Archived '],
  ['Student', 'Teacher', '1', '2026-10-16', ''],
  ['Student', 'Teacher', '2', '2026-10-16', 'yes'],
  ['Student', 'Teacher', '3', '2026-10-16', 'no'],
  ['Student', 'Teacher', '4', '2026-10-16', ' YES '],
]
const points = [
  ['Student', 'Teacher', 'Points', 'Date', 'Reason', 'Archived'],
  ['Student', 'Teacher', '5', '2026-10-16', 'yes'],
  ['Student', 'Teacher', '100', '2026-10-16', 'Reason', 'yes'],
]
const cst = [
  ['Student', 'Sabr', 'Mark', 'Date', 'Archived'],
  ['Student', 'Sabr', 'Mark', '2026-10-16'],
  ['Student', 'Sabr', 'Mark', '2026-10-16', 'Yes'],
]

assert.deepEqual(sheetDataRows([]), [])
assert.deepEqual(sheetDataRows([['Student'], ['Student']]), [['Student']])
assert.deepEqual(sheetDataRows(pages, true), pages.slice(1))
assert.deepEqual(sheetDataRows([
  ['الطالب', 'مؤرشفة'],
  ['Archived student', 'YES'],
  ['Active student', ''],
]), [['Active student', '']])
assert.deepEqual(parseSheetRows(sheetDataRows(pages)).map((row) => row.page), [1, 3])
assert.deepEqual(computeFinalsStandings({
  names: ['Student'],
  groups: new Map(),
  pageRows: parseSheetRows(sheetDataRows(pages)),
  pointRows: parsePointsRows(sheetDataRows(points)),
  cstRows: parseCstRows(sheetDataRows(cst)),
  pageFactor: 2,
  cstFactor: 3,
}), [{ name: 'Student', group: '', pages: 2, cst: 1, score: 12 }])

console.log('Archived-row filtering and final points checks passed')

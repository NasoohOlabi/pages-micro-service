import assert from 'node:assert/strict'
import { buildMemorizationHistory } from '../src/stats/memorization'
import { sheetDataRows } from '../src/sheets/archivedRows'
import { parseSheetRows } from '../src/sheets/schema'
import { hrefFor, parseQueryState } from '../src/url/queryState'

const rows = parseSheetRows(sheetDataRows([
  ['Student', 'Teacher', 'Page', 'Date', 'مؤرشفة'],
  ['Student', 'Teacher', '4', '2026-10-10', 'YES'],
  ['Student', 'Teacher', '2', '2026-10-09', 'yes'],
  ['Student', 'Teacher', '1', '2026-10-08', ''],
  ['Student', 'Teacher', '2', '2026-10-10', ''],
  [' student ', 'Teacher', '2', '2026-10-10', ''],
  ['Student', 'Teacher', '604', '', ''],
  ['Other student', 'Teacher', '3', '2026-10-11', 'yes'],
], true))
const history = buildMemorizationHistory(rows)
const student = history.find((entry) => entry.student === 'Student')
assert.deepEqual(student, {
  student: 'Student',
  pages: [
    { page: 1, dates: ['2026-10-08'] },
    { page: 2, dates: ['2026-10-09', '2026-10-10'] },
    { page: 4, dates: ['2026-10-10'] },
    { page: 604, dates: [] },
  ],
  ranges: [{ start: 1, end: 2 }, { start: 4, end: 4 }, { start: 604, end: 604 }],
})
assert.equal(history.length, 2)
assert.deepEqual(buildMemorizationHistory([]), [])

Object.defineProperty(globalThis, 'window', { value: { location: { pathname: '/' } } })
const state = { tab: 'memorization', q: 'سارية حوري' } satisfies ReturnType<typeof parseQueryState>
assert.deepEqual(parseQueryState(hrefFor(state).slice(1)), state)
assert.equal(hrefFor({ tab: 'memorization', q: '' }), '/?tab=memorization')
assert.deepEqual(parseQueryState('?tab=points&q=Student'), { tab: 'points' })
console.log('Memorization ranges, dates, archived history, and URL checks passed')

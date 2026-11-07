import { expect, test } from 'bun:test'
import { studentVisibility } from '../src/students/visibility'
import { buildMemorizationHistory } from '../src/stats/memorization'
import { computeFinalsStandings } from '../src/stats/finals'
import { APP_TABS, hrefFor, parseQueryState, setQuery } from '../src/url/queryState'
import { translations } from '../src/i18n/translations'

const roster = [
  ['Active', '', '', '', '', 'TRUE'],
  ['Disabled', '', '', '', '', 'FALSE'],
  ['Blank', '', '', '', '', ''],
]

test('column F controls visibility, with all mode restoring disabled and historical names', () => {
  const names = [' Active ', 'DISABLED', 'Blank', 'Historical']
  expect(names.filter(studentVisibility(roster, 0, false))).toEqual([' Active '])
  expect(names.filter(studentVisibility(roster, 0, true))).toEqual(names)
})

test('memorization and finals totals exclude inactive historical records and restore them in all mode', () => {
  const rows = ['Active', 'Disabled', 'Historical'].map((student, i) => ({ student, page: i + 1, teacher: 'Teacher', date: '2026-11-07' }))
  for (const all of [false, true]) {
    const visible = studentVisibility(roster, 0, all)
    const filtered = rows.filter((row) => visible(row.student))
    expect(buildMemorizationHistory(filtered).length).toBe(all ? 3 : 1)
    const finals = computeFinalsStandings({ names: roster.map((row) => row[0]).filter(visible), groups: new Map(), pageRows: filtered, pointRows: rows.map((row) => ({ student: row.student, points: 10 })).filter((row) => visible(row.student)), cstRows: filtered, pageFactor: 1, cstFactor: 1 })
    expect(finals.length).toBe(all ? 3 : 1)
    expect(finals.reduce((sum, row) => sum + row.score, 0)).toBe(all ? 36 : 12)
  }
})

test('global filter survives every tab change and round trips in links', () => {
  const location = { pathname: '/', search: '?students=all' }
  const navigate = (_state, _title, href) => { location.search = new URL(href, 'https://example.com').search }
  globalThis.window = { location, history: { pushState: navigate, replaceState: navigate } }
  for (const tab of APP_TABS) {
    setQuery({ tab }, 'push')
    const parsed = parseQueryState(location.search)
    expect(parsed.tab).toBe(tab)
    expect(parsed.allStudents).toBe(true)
    expect(hrefFor(parsed)).toContain('students=all')
  }
  setQuery({ allStudents: false })
  expect(location.search).not.toContain('students=all')
  expect(parseQueryState(location.search).allStudents).toBe(false)
})

test('new Arabic toggle labels contain Arabic text without encoding replacements', () => {
  for (const key of ['activeStudentsOnly', 'allStudents', 'studentHidden']) {
    expect(translations.ar[key]).toMatch(/[\u0600-\u06ff]/)
    expect(translations.ar[key]).not.toContain('?')
  }
})

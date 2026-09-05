import type { SheetRowValues } from '../sheets/schema'

export interface StatsFilters {
  from: string | null
  to: string | null
  student: string | null
}

export interface NamedCount {
  name: string
  count: number
}

export interface TimeBucket {
  key: string
  count: number
}

export interface TimeSeries {
  grain: 'day' | 'week'
  buckets: TimeBucket[]
}

export interface JuzRange {
  juz: number
  start: number
  end: number
}

// Standard Madani 604-page mushaf juz start pages.
export const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322,
  342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
] as const

export const QURAN_PAGES = 604
const WEEKLY_BUCKET_AFTER_DAYS = 31

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function localIsoDate(date = new Date()): string {
  return toIso(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  return localIsoDate(date)
}

export function startOfIsoWeek(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const weekday = date.getDay()
  const offset = weekday === 0 ? -6 : 1 - weekday
  date.setDate(date.getDate() + offset)
  return localIsoDate(date)
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function parseLogDate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    return isValidYmd(year, month, day) ? toIso(year, month, day) : null
  }

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (!slash) return null

  const first = Number(slash[1])
  const second = Number(slash[2])
  const year = Number(slash[3])
  const asMonthDay = isValidYmd(year, first, second)
  const asDayMonth = isValidYmd(year, second, first)

  if (first > 12) return asDayMonth ? toIso(year, second, first) : null
  if (second > 12) return asMonthDay ? toIso(year, first, second) : null
  if (first === second) return asMonthDay ? toIso(year, first, second) : null
  if (asMonthDay && !asDayMonth) return toIso(year, first, second)
  if (asDayMonth && !asMonthDay) return toIso(year, second, first)
  return null
}

export function filterRows(rows: SheetRowValues[], filters: StatsFilters): SheetRowValues[] {
  const student = filters.student
  const from = filters.from
  const to = filters.to
  const dateFilterOn = Boolean(from || to)

  return rows.filter((row) => {
    if (student && row.student !== student) return false
    if (!dateFilterOn) return true
    const iso = parseLogDate(row.date)
    if (!iso) return false
    if (from && iso < from) return false
    if (to && iso > to) return false
    return true
  })
}

export function uniqueStudentNames(rows: SheetRowValues[]): string[] {
  const names = new Set<string>()
  for (const row of rows) names.add(row.student)
  return [...names].sort((a, b) => a.localeCompare(b))
}

export function uniquePageSet(rows: SheetRowValues[]): Set<number> {
  const pages = new Set<number>()
  for (const row of rows) pages.add(row.page)
  return pages
}

export function countByField(rows: SheetRowValues[], field: 'student' | 'teacher'): NamedCount[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const name = row[field]
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function countPagesInCurrentWeek(rows: SheetRowValues[], today = localIsoDate()): number {
  const from = startOfIsoWeek(today)
  const to = addDays(from, 6)
  let count = 0
  for (const row of rows) {
    const iso = parseLogDate(row.date)
    if (iso && iso >= from && iso <= to) count += 1
  }
  return count
}

function daysInclusive(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  const start = Date.UTC(fromYear, fromMonth - 1, fromDay)
  const end = Date.UTC(toYear, toMonth - 1, toDay)
  return Math.round((end - start) / 86_400_000) + 1
}

function spanFromRows(rows: SheetRowValues[]): { from: string; to: string } | null {
  let from: string | null = null
  let to: string | null = null
  for (const row of rows) {
    const iso = parseLogDate(row.date)
    if (!iso) continue
    if (!from || iso < from) from = iso
    if (!to || iso > to) to = iso
  }
  if (!from || !to) return null
  return { from, to }
}

export function buildTimeSeries(
  rows: SheetRowValues[],
  range: { from: string | null; to: string | null },
): TimeSeries {
  const span = range.from && range.to
    ? { from: range.from, to: range.to }
    : range.from
      ? { from: range.from, to: spanFromRows(rows)?.to ?? range.from }
      : range.to
        ? { from: spanFromRows(rows)?.from ?? range.to, to: range.to }
        : spanFromRows(rows)

  if (!span || span.from > span.to) return { grain: 'day', buckets: [] }

  const grain: TimeSeries['grain'] =
    daysInclusive(span.from, span.to) > WEEKLY_BUCKET_AFTER_DAYS ? 'week' : 'day'
  const counts = new Map<string, number>()
  for (const row of rows) {
    const iso = parseLogDate(row.date)
    if (!iso) continue
    const key = grain === 'week' ? startOfIsoWeek(iso) : iso
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const buckets: TimeBucket[] = []
  if (grain === 'week') {
    let cursor = startOfIsoWeek(span.from)
    const last = startOfIsoWeek(span.to)
    while (cursor <= last) {
      buckets.push({ key: cursor, count: counts.get(cursor) ?? 0 })
      cursor = addDays(cursor, 7)
    }
  } else {
    let cursor = span.from
    while (cursor <= span.to) {
      buckets.push({ key: cursor, count: counts.get(cursor) ?? 0 })
      cursor = addDays(cursor, 1)
    }
  }

  return { grain, buckets }
}

export function juzPageRanges(): JuzRange[] {
  return JUZ_START_PAGES.map((start, index) => {
    const next = JUZ_START_PAGES[index + 1]
    return {
      juz: index + 1,
      start,
      end: next === undefined ? QURAN_PAGES : next - 1,
    }
  })
}

import type { SheetRowValues } from '../sheets/schema'
import { parseLogDate } from './aggregations'
import { surahPages } from './surahPages'

export function surahsForPages(start: number, end = start): string[] {
  return surahPages
    .filter((surah) => surah.firstPage <= end && surah.lastPage >= start)
    .map((surah) => surah.name)
}

export interface MemorizedPage {
  page: number
  dates: string[]
}

export interface MemorizationHistory {
  student: string
  pages: MemorizedPage[]
  ranges: { start: number; end: number }[]
}

export function buildMemorizationHistory(rows: SheetRowValues[]): MemorizationHistory[] {
  const students = new Map<string, { name: string; pages: Map<number, Set<string>> }>()
  for (const row of rows) {
    const name = row.student.trim()
    const key = name.toLowerCase()
    let student = students.get(key)
    if (!student) {
      student = { name, pages: new Map() }
      students.set(key, student)
    }
    let dates = student.pages.get(row.page)
    if (!dates) {
      dates = new Set()
      student.pages.set(row.page, dates)
    }
    if (row.date.trim()) dates.add(parseLogDate(row.date) ?? row.date.trim())
  }

  return Array.from(students.values(), (student) => {
    const pages = Array.from(student.pages, ([page, dates]) => ({ page, dates: [...dates].sort() }))
      .sort((a, b) => a.page - b.page)
    const ranges: MemorizationHistory['ranges'] = []
    for (const { page } of pages) {
      const last = ranges.at(-1)
      if (last && page === last.end + 1) last.end = page
      else ranges.push({ start: page, end: page })
    }
    return { student: student.name, pages, ranges }
  }).sort((a, b) => a.student.localeCompare(b.student))
}

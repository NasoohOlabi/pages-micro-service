import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  appendRosterStudent,
  fetchRosterSheet,
  type RosterSheet,
} from '../sheets/rosterClient'
import {
  fetchAttendanceSheet,
  getStudentAttendanceHistory,
  type AttendanceHistoryEntry,
} from '../sheets/attendanceClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { useLocale } from '../i18n/LocaleContext'
import type { Locale, TranslationKey } from '../i18n/translations'

interface RosterViewProps {
  ready: boolean
}

const ROSTER_COLUMN_LABELS: Partial<Record<number, TranslationKey>> = {
  0: 'rosterFullName',
  1: 'rosterParentNumber',
  2: 'rosterStudentNumber',
  3: 'rosterSecondParentNumber',
  4: 'rosterRequired',
  5: 'rosterFirstName',
  6: 'rosterLastName',
  7: 'rosterGroup',
  8: 'rosterClass',
}
const ROSTER_TABLE_COLUMNS = [1, 2, 3, 7, 8]

type RosterMode = 'list' | 'add'

const DATE_HEADER_PATTERN = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+\d{1,2}\/\d{1,2}$/i
const SKIPPED_FORM_HEADERS = new Set(['attendance', 'classified', 'attendance %', 'الحضور', 'مصنف', 'نسبة الحضور'])

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function readRosterModeFromUrl(): RosterMode {
  return new URLSearchParams(window.location.search).get('sub') === 'add' ? 'add' : 'list'
}

function hasNonAscii(value: string | undefined): boolean {
  return Array.from(value ?? '').some((char) => char.charCodeAt(0) > 127)
}

function rosterColumnLabel(
  index: number,
  header: string | undefined,
  locale: Locale,
  t: (key: TranslationKey) => string,
): string {
  const labelKey = ROSTER_COLUMN_LABELS[index]
  if (labelKey) return t(labelKey)
  if (locale === 'en' && hasNonAscii(header)) return `Column ${index + 1}`
  return header || `Column ${index + 1}`
}

export function RosterView({ ready }: RosterViewProps) {
  const { locale, t } = useLocale()
  const [mode, setMode] = useState<RosterMode>(readRosterModeFromUrl)
  const [sheet, setSheet] = useState<RosterSheet | null>(null)
  const [query, setQuery] = useState('')
  const [formValues, setFormValues] = useState<Record<number, string>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [historyByStudent, setHistoryByStudent] = useState<
    Record<string, AttendanceHistoryEntry[] | 'loading' | 'error'>
  >({})

  useEffect(() => {
    const handlePopState = () => setMode(readRosterModeFromUrl())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setIsLoading(true)
    fetchRosterSheet()
      .then((result) => {
        if (cancelled) return
        setSheet(result)
        setLoadError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(
          err instanceof SheetsAccessError ? err.message : t('rosterLoadError'),
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ready, t])

  const rows = useMemo(() => {
    if (!sheet) return []
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return sheet.rows
    return sheet.rows.filter((row) =>
      row.some((value) => value.toLowerCase().includes(normalizedQuery)),
    )
  }, [query, sheet])

  const columnIndexes = useMemo(() => {
    if (!sheet) return []
    const columnCount = Math.max(sheet.headers.length, ...sheet.rows.map((row) => row.length), 1)
    return Array.from({ length: columnCount }, (_, index) => index)
  }, [sheet])

  const editableColumnIndexes = useMemo(() => {
    if (!sheet) return []
    const firstDateIndex = sheet.headers.findIndex((header) => DATE_HEADER_PATTERN.test(header))
    const limit = firstDateIndex === -1 ? Math.min(sheet.headers.length, 12) : firstDateIndex
    const indexes = Array.from({ length: limit }, (_, index) => index).filter((index) => {
      const header = sheet.headers[index]?.trim()
      return header && !SKIPPED_FORM_HEADERS.has(header.toLowerCase())
    })
    return indexes.includes(sheet.nameColumnIndex)
      ? indexes
      : [sheet.nameColumnIndex, ...indexes].sort((a, b) => a - b)
  }, [sheet])

  const tableColumnIndexes = useMemo(() => {
    if (!sheet) return []
    return Array.from(new Set([sheet.nameColumnIndex, ...ROSTER_TABLE_COLUMNS]))
  }, [sheet])

  const selectMode = (nextMode: RosterMode) => {
    const url = new URL(window.location.href)
    if (nextMode === 'add') {
      url.searchParams.set('sub', 'add')
    } else {
      url.searchParams.delete('sub')
    }
    window.history.pushState(null, '', url)
    setMode(nextMode)
    setSubmitError(null)
    setSuccessMessage(null)
  }

  const toggleHistory = async (student: string) => {
    if (expandedStudent === student) {
      setExpandedStudent(null)
      return
    }
    setExpandedStudent(student)
    if (historyByStudent[student] !== undefined) return

    setHistoryByStudent((current) => ({ ...current, [student]: 'loading' }))
    try {
      const attendanceSheet = await fetchAttendanceSheet()
      const history = getStudentAttendanceHistory(attendanceSheet, student)
      setHistoryByStudent((current) => ({ ...current, [student]: history }))
    } catch {
      setHistoryByStudent((current) => ({ ...current, [student]: 'error' }))
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!sheet) return

    setSubmitError(null)
    setSuccessMessage(null)

    const studentName = formValues[sheet.nameColumnIndex]?.trim() ?? ''
    if (!studentName) {
      setSubmitError(t('studentNameRequired'))
      return
    }

    const duplicate = sheet.rows.some(
      (row) => normalize(row[sheet.nameColumnIndex]) === normalize(studentName),
    )
    if (duplicate) {
      setSubmitError(t('duplicateStudent', { student: studentName }))
      return
    }

    setIsSubmitting(true)
    try {
      const values = Array.from({ length: columnIndexes.length }, (_, index) =>
        formValues[index]?.trim() ?? '',
      )
      await appendRosterStudent(values)
      const nextSheet = await fetchRosterSheet()
      setSheet(nextSheet)
      setFormValues({})
      setSuccessMessage(t('studentCreated', { student: studentName }))
      const url = new URL(window.location.href)
      url.searchParams.delete('sub')
      window.history.pushState(null, '', url)
      setMode('list')
    } catch (err) {
      setSubmitError(
        err instanceof SheetsAccessError ? err.message : t('rosterCreateError'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-3 sm:p-6">
      {sheet && mode === 'add' && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">{t('createStudentTitle')}</h2>
            <button
              type="button"
              onClick={() => selectMode('list')}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {t('backToStudents')}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {editableColumnIndexes.map((index) => (
              <div key={index} className="flex flex-col gap-1 text-start">
                <label htmlFor={`roster-field-${index}`} className="text-sm font-medium text-gray-700">
                  {rosterColumnLabel(index, sheet.headers[index], locale, t)}
                </label>
                <input
                  id={`roster-field-${index}`}
                  type="text"
                  value={formValues[index] ?? ''}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      [index]: event.target.value,
                    }))
                  }
                  required={index === sheet.nameColumnIndex}
                  className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 rounded-md bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t('saving') : t('addStudent')}
          </button>
        </form>
      )}

      {mode === 'list' && (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="roster-search" className="text-sm font-medium text-gray-700">
                {t('rosterSearchLabel')}
              </label>
              <input
                id="roster-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none sm:py-3"
              />
            </div>
            <button
              type="button"
              onClick={() => selectMode('add')}
              className="min-h-11 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {t('addStudent')}
            </button>
          </div>
          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
        </>
      )}

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {isLoading && <p className="text-sm text-gray-500">{t('rosterLoading')}</p>}

      {sheet && mode === 'list' && (
        <div className="max-h-[70svh] overflow-auto rounded-md border border-gray-200 bg-white">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                {tableColumnIndexes.map((index) => (
                  <th
                    key={index}
                    scope="col"
                    className="border-b border-gray-200 px-3 py-2 text-start font-semibold text-gray-700"
                  >
                    {rosterColumnLabel(index, sheet.headers[index], locale, t)}
                  </th>
                ))}
                <th scope="col" className="border-b border-gray-200 px-3 py-2 text-start font-semibold text-gray-700" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnIndexes.length + 1} className="px-3 py-4 text-center text-gray-500">
                    {query.trim() ? t('rosterNoMatches') : t('rosterNoRows')}
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => {
                  const studentName = row[sheet.nameColumnIndex] || ''
                  const history = historyByStudent[studentName]
                  const isExpanded = expandedStudent === studentName
                  return (
                    <Fragment key={`${row.join('|')}-${rowIndex}`}>
                      <tr className="odd:bg-white even:bg-gray-50">
                        {tableColumnIndexes.map((index) => (
                          <td key={index} className="border-b border-gray-100 px-3 py-2 text-start text-gray-800">
                            {row[index] || '-'}
                          </td>
                        ))}
                        <td className="border-b border-gray-100 px-3 py-2 text-end">
                          <button
                            type="button"
                            onClick={() => toggleHistory(studentName)}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                          >
                            {isExpanded ? t('hideAttendanceHistory') : t('viewAttendanceHistory')}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="odd:bg-white even:bg-gray-50">
                          <td colSpan={tableColumnIndexes.length + 1} className="border-b border-gray-100 px-3 py-2 text-start text-gray-800">
                            {history === 'loading' && (
                              <p className="text-sm text-gray-500">{t('rosterLoading')}</p>
                            )}
                            {history === 'error' && (
                              <p className="text-sm text-red-600">{t('attendanceLoadError')}</p>
                            )}
                            {Array.isArray(history) && history.length === 0 && (
                              <p className="text-sm text-gray-500">{t('attendanceHistoryEmpty')}</p>
                            )}
                            {Array.isArray(history) && history.length > 0 && (
                              <ul className="flex flex-col gap-1">
                                {history.map((entry) => (
                                  <li key={entry.date} className="flex justify-between gap-4 text-sm">
                                    <span className="text-gray-600">{entry.date}</span>
                                    <span className="font-medium text-gray-900">{entry.status}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

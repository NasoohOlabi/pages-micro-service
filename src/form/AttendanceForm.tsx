import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ATTENDANCE_STATUSES,
  attendanceStatusForDate,
  fetchAttendanceSheet,
  findAttendanceStudent,
  formatAttendanceDate,
  saveGroupAttendance,
  saveStudentAttendance,
  type AttendanceSheet,
  type AttendanceStatus,
  type AttendanceStudentRow,
} from '../sheets/attendanceClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { StudentAutocomplete } from './StudentAutocomplete'
import { useLocale } from '../i18n/LocaleContext'
import type { TranslationKey } from '../i18n/translations'

interface AttendanceFormProps {
  ready: boolean
}

type AttendanceMode = 'student' | 'group'

const DEFAULT_STATUS: AttendanceStatus = 'غائب'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function StatusSelect({
  value,
  onChange,
  labelledBy,
}: {
  value: AttendanceStatus
  onChange: (status: AttendanceStatus) => void
  labelledBy?: string
}) {
  const { t } = useLocale()

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-2 gap-1 rounded-md border border-gray-200 bg-white p-1 sm:grid-cols-5"
    >
      {ATTENDANCE_STATUSES.map((status) => (
        <button
          key={status.value}
          type="button"
          role="radio"
          aria-checked={value === status.value}
          onClick={() => onChange(status.value)}
          className={`min-h-10 rounded px-2 text-sm font-semibold ${
            value === status.value
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {t(status.labelKey as TranslationKey)}
        </button>
      ))}
    </div>
  )
}

export function AttendanceForm({ ready }: AttendanceFormProps) {
  const { t } = useLocale()
  const [mode, setMode] = useState<AttendanceMode>('student')
  const [date, setDate] = useState(today)
  const [sheet, setSheet] = useState<AttendanceSheet | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [student, setStudent] = useState('')
  const [studentStatus, setStudentStatus] = useState<AttendanceStatus>(DEFAULT_STATUS)
  const [group, setGroup] = useState('')
  const [groupStatuses, setGroupStatuses] = useState<Record<number, AttendanceStatus>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const studentInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    fetchAttendanceSheet()
      .then((result) => {
        if (cancelled) return
        setSheet(result)
        setLoadError(null)
        setGroup((current) => current || result.groups[0] || '')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(
          err instanceof SheetsAccessError ? err.message : t('attendanceLoadError'),
        )
      })
    return () => {
      cancelled = true
    }
  }, [ready, t])

  const groupRows = useMemo<AttendanceStudentRow[]>(() => {
    if (!sheet || !group) return []
    return sheet.students.filter((row) => row.group === group)
  }, [sheet, group])

  useEffect(() => {
    if (!sheet) return
    const dateLabel = formatAttendanceDate(date)
    const nextStatuses: Record<number, AttendanceStatus> = {}
    for (const row of groupRows) {
      nextStatuses[row.rowNumber] =
        attendanceStatusForDate(row, sheet, dateLabel) || DEFAULT_STATUS
    }
    setGroupStatuses(nextStatuses)
  }, [date, groupRows, sheet])

  useEffect(() => {
    if (!sheet || !student.trim()) return
    const row = findAttendanceStudent(sheet, student)
    if (!row) return
    const existingStatus = attendanceStatusForDate(row, sheet, formatAttendanceDate(date))
    if (existingStatus) setStudentStatus(existingStatus)
  }, [date, sheet, student])

  const refreshSheet = async () => {
    const nextSheet = await fetchAttendanceSheet()
    setSheet(nextSheet)
  }

  const handleStudentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)
    try {
      await saveStudentAttendance(student, date, studentStatus)
      await refreshSheet()
      setSuccessMessage(t('attendanceStudentSaved', { student }))
      setStudent('')
      setStudentStatus(DEFAULT_STATUS)
      studentInputRef.current?.focus()
    } catch (err) {
      setSubmitError(
        err instanceof SheetsAccessError ? err.message : t('attendanceSaveError'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGroupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)
    try {
      await saveGroupAttendance(
        date,
        groupRows.map((row) => ({
          rowNumber: row.rowNumber,
          status: groupStatuses[row.rowNumber] ?? DEFAULT_STATUS,
        })),
      )
      await refreshSheet()
      setSuccessMessage(t('attendanceGroupSaved', { count: groupRows.length }))
    } catch (err) {
      setSubmitError(
        err instanceof SheetsAccessError ? err.message : t('attendanceSaveError'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <div className="grid w-full grid-cols-2 gap-1 rounded-md border border-gray-200 bg-white p-1">
        {(['student', 'group'] as const).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => {
              setMode(nextMode)
              setSubmitError(null)
              setSuccessMessage(null)
            }}
            aria-current={mode === nextMode ? 'page' : undefined}
            className={`min-h-10 rounded px-3 text-sm font-semibold ${
              mode === nextMode
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {nextMode === 'student' ? t('attendanceStudentMode') : t('attendanceGroupMode')}
          </button>
        ))}
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {mode === 'student' ? (
        <form onSubmit={handleStudentSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-start">
            <label htmlFor="attendance-date" className="text-sm font-medium text-gray-700">
              {t('dateLabel')}
            </label>
            <input
              id="attendance-date"
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1 text-start">
            <label htmlFor="attendance-student" className="text-sm font-medium text-gray-700">
              {t('studentLabel')}
            </label>
            <StudentAutocomplete
              ref={studentInputRef}
              id="attendance-student"
              value={student}
              onChange={setStudent}
              onBlur={() => undefined}
              ready={ready}
            />
          </div>

          <div className="flex flex-col gap-1 text-start">
            <span id="attendance-status" className="text-sm font-medium text-gray-700">
              {t('attendanceStatusLabel')}
            </span>
            <StatusSelect
              value={studentStatus}
              onChange={setStudentStatus}
              labelledBy="attendance-status"
            />
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

          <button
            type="submit"
            disabled={isSubmitting || !student.trim()}
            className="min-h-11 rounded-md bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t('saving') : t('saveAttendance')}
          </button>
        </form>
      ) : (
        <form onSubmit={handleGroupSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 text-start">
              <label htmlFor="attendance-group-date" className="text-sm font-medium text-gray-700">
                {t('dateLabel')}
              </label>
              <input
                id="attendance-group-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1 text-start">
              <label htmlFor="attendance-group" className="text-sm font-medium text-gray-700">
                {t('attendanceGroupLabel')}
              </label>
              <select
                id="attendance-group"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
              >
                {sheet?.groups.map((groupName) => (
                  <option key={groupName} value={groupName}>
                    {groupName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex max-h-[55svh] flex-col gap-3 overflow-auto rounded-md border border-gray-200 bg-white p-3">
            {groupRows.length === 0 ? (
              <p className="text-sm text-gray-500">{t('attendanceNoStudents')}</p>
            ) : (
              groupRows.map((row) => (
                <div key={row.rowNumber} className="flex flex-col gap-2 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                  <span className="text-sm font-semibold text-gray-800">{row.student}</span>
                  <StatusSelect
                    value={groupStatuses[row.rowNumber] ?? DEFAULT_STATUS}
                    onChange={(status) =>
                      setGroupStatuses((current) => ({
                        ...current,
                        [row.rowNumber]: status,
                      }))
                    }
                  />
                </div>
              ))
            )}
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

          <button
            type="submit"
            disabled={isSubmitting || groupRows.length === 0}
            className="min-h-11 rounded-md bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t('saving') : t('saveAttendance')}
          </button>
        </form>
      )}
    </div>
  )
}

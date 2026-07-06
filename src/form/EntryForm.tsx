import { useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createEntrySchema,
  expandPageRange,
  type EntryFormInput,
  type EntryFormValues,
  type SheetRowValues,
} from '../sheets/schema'
import {
  appendRows,
  fetchExistingRows,
  findDuplicatePages,
  SheetsAccessError,
} from '../sheets/sheetsClient'
import { FIELDS } from './fields'
import { StudentAutocomplete } from './StudentAutocomplete'
import { TeacherSelect } from './TeacherSelect'
import { DateLabel } from './DateLabel'
import type { GoogleUser } from '../auth/useGoogleAuth'
import { useLocale } from '../i18n/LocaleContext'

interface EntryFormProps {
  user: GoogleUser
  ready: boolean
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function EntryForm({ user, ready }: EntryFormProps) {
  const { t } = useLocale()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingInsert, setPendingInsert] = useState<{
    rows: SheetRowValues[]
    values: EntryFormValues
  } | null>(null)
  const [isInsertingRemaining, setIsInsertingRemaining] = useState(false)
  const studentInputRef = useRef<HTMLInputElement>(null)
  const teacherTouchedRef = useRef(false)

  const entrySchema = useMemo(() => createEntrySchema(t), [t])

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EntryFormInput, unknown, EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: { student: '', teacher: '', startPage: '', endPage: '', date: today() },
  })

  const handleStartPageBlur = () => {
    const { startPage, endPage } = getValues()
    const endPageEmpty = endPage === undefined || endPage === null || endPage === ('' as never)
    const startPageEmpty = startPage === undefined || startPage === null || startPage === ('' as never)
    if (endPageEmpty && !startPageEmpty) {
      setValue('endPage', startPage)
    }
  }

  const finishSubmit = (rows: SheetRowValues[], values: EntryFormValues) => {
    const isContiguous = rows.every(
      (row, i) => i === 0 || row.page === rows[i - 1].page + 1,
    )
    setSuccessMessage(
      rows.length === 1
        ? t('loggedSinglePage', { page: rows[0].page, student: values.student })
        : isContiguous
          ? t('loggedPageRange', {
              start: rows[0].page,
              end: rows[rows.length - 1].page,
              student: values.student,
            })
          : t('loggedPages', {
              pages: rows.map((row) => row.page).join(', '),
              student: values.student,
            }),
    )
    setPendingInsert(null)
    reset({
      student: '',
      teacher: values.teacher,
      startPage: '',
      endPage: '',
      date: values.date,
    })
    studentInputRef.current?.focus()
  }

  const onSubmit = async (values: EntryFormValues) => {
    setSubmitError(null)
    setSuccessMessage(null)
    setPendingInsert(null)
    try {
      const rows = expandPageRange(values)
      const existingRows = await fetchExistingRows()
      const duplicatePages = findDuplicatePages(existingRows, rows)
      if (duplicatePages.length > 0) {
        const newRows = rows.filter((row) => !duplicatePages.includes(row.page))
        setSubmitError(
          t('duplicatePagesFound', {
            student: values.student,
            pages: duplicatePages.join(', '),
          }),
        )
        if (newRows.length > 0) {
          setPendingInsert({ rows: newRows, values })
        }
        return
      }
      await appendRows(rows)
      finishSubmit(rows, values)
    } catch (err) {
      setSubmitError(
        err instanceof SheetsAccessError ? err.message : t('saveError'),
      )
    }
  }

  const handleInsertRemaining = async () => {
    if (!pendingInsert) return
    setIsInsertingRemaining(true)
    try {
      await appendRows(pendingInsert.rows)
      setSubmitError(null)
      finishSubmit(pendingInsert.rows, pendingInsert.values)
    } catch (err) {
      setSubmitError(
        err instanceof SheetsAccessError ? err.message : t('saveError'),
      )
    } finally {
      setIsInsertingRemaining(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto flex w-full max-w-md flex-col gap-4 p-6"
    >
      {FIELDS.filter((field) => field.name !== 'endPage').map((field) => (
        <div key={field.name} className="flex flex-col gap-1 text-start">
          {field.name === 'startPage' ? (
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="startPage" className="text-sm font-medium text-gray-700">
                  {t('startPageLabel')}
                </label>
                <input
                  id="startPage"
                  type="number"
                  min={1}
                  max={604}
                  inputMode="numeric"
                  {...register('startPage', { onBlur: handleStartPageBlur })}
                  className="rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
                />
                {errors.startPage && (
                  <p className="text-sm text-red-600">{errors.startPage.message}</p>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="endPage" className="text-sm font-medium text-gray-700">
                  {t('endPageLabel')}
                </label>
                <input
                  id="endPage"
                  type="number"
                  min={1}
                  max={604}
                  inputMode="numeric"
                  {...register('endPage')}
                  className="rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
                />
                {errors.endPage && (
                  <p className="text-sm text-red-600">{errors.endPage.message}</p>
                )}
              </div>
            </div>
          ) : (
            <>
              {field.name === 'date' ? (
                <DateLabel htmlFor={field.name} />
              ) : (
                <label htmlFor={field.name} className="text-sm font-medium text-gray-700">
                  {t(field.labelKey)}
                </label>
              )}
              {field.name === 'student' ? (
                <Controller
                  name="student"
                  control={control}
                  render={({ field: { value, onChange, onBlur } }) => (
                    <StudentAutocomplete
                      ref={studentInputRef}
                      id={field.name}
                      value={typeof value === 'string' ? value : ''}
                      onChange={onChange}
                      onBlur={onBlur}
                      ready={ready}
                    />
                  )}
                />
              ) : field.name === 'teacher' ? (
                <Controller
                  name="teacher"
                  control={control}
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TeacherSelect
                      id={field.name}
                      value={typeof value === 'string' ? value : ''}
                      onChange={(next) => {
                        teacherTouchedRef.current = true
                        onChange(next)
                      }}
                      onBlur={onBlur}
                      userEmail={user.email}
                      hasUserSetValue={teacherTouchedRef.current}
                      ready={ready}
                    />
                  )}
                />
              ) : (
                <input
                  id={field.name}
                  type={field.type}
                  min={field.min}
                  max={field.max}
                  inputMode={field.inputMode}
                  {...register(field.name)}
                  className="rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
                />
              )}
              {errors[field.name] && (
                <p className="text-sm text-red-600">{errors[field.name]?.message}</p>
              )}
            </>
          )}
        </div>
      ))}

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      {pendingInsert && (
        <button
          type="button"
          onClick={handleInsertRemaining}
          disabled={isInsertingRemaining}
          className="min-h-11 rounded-md border border-indigo-600 px-4 py-3 text-base font-semibold text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isInsertingRemaining
            ? t('saving')
            : t('insertRemainingPages', { count: pendingInsert.rows.length })}
        </button>
      )}
      {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-11 rounded-md bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? t('saving') : t('logPage')}
      </button>
    </form>
  )
}

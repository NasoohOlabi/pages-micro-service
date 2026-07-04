import { useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createPointsSchema,
  formValuesToPointsRow,
  type PointsFormInput,
  type PointsFormValues,
} from '../sheets/pointsSchema'
import { appendPointRow } from '../sheets/pointsClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { StudentAutocomplete } from './StudentAutocomplete'
import { TeacherSelect } from './TeacherSelect'
import { DateLabel } from './DateLabel'
import type { GoogleUser } from '../auth/useGoogleAuth'
import { useLocale } from '../i18n/LocaleContext'

interface PointsFormProps {
  user: GoogleUser
  ready: boolean
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PointsForm({ user, ready }: PointsFormProps) {
  const { t } = useLocale()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const studentInputRef = useRef<HTMLInputElement>(null)
  const teacherTouchedRef = useRef(false)

  const pointsSchema = useMemo(() => createPointsSchema(t), [t])

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PointsFormInput, unknown, PointsFormValues>({
    resolver: zodResolver(pointsSchema),
    defaultValues: { student: '', teacher: '', points: undefined, date: today(), reason: '' },
  })

  const onSubmit = async (values: PointsFormValues) => {
    setSubmitError(null)
    setSuccessMessage(null)
    try {
      await appendPointRow(formValuesToPointsRow(values))
      setSuccessMessage(t('loggedPoints', { points: values.points, student: values.student }))
      reset({
        student: '',
        teacher: values.teacher,
        points: undefined,
        date: values.date,
        reason: '',
      })
      studentInputRef.current?.focus()
    } catch (err) {
      setSubmitError(
        err instanceof SheetsAccessError ? err.message : t('saveError'),
      )
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto flex w-full max-w-md flex-col gap-4 p-6"
    >
      <div className="flex flex-col gap-1 text-start">
        <label htmlFor="points-student" className="text-sm font-medium text-gray-700">
          {t('studentLabel')}
        </label>
        <Controller
          name="student"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <StudentAutocomplete
              ref={studentInputRef}
              id="points-student"
              value={typeof value === 'string' ? value : ''}
              onChange={onChange}
              onBlur={onBlur}
              ready={ready}
            />
          )}
        />
        {errors.student && <p className="text-sm text-red-600">{errors.student.message}</p>}
      </div>

      <div className="flex flex-col gap-1 text-start">
        <label htmlFor="points-teacher" className="text-sm font-medium text-gray-700">
          {t('teacherLabel')}
        </label>
        <Controller
          name="teacher"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <TeacherSelect
              id="points-teacher"
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
        {errors.teacher && <p className="text-sm text-red-600">{errors.teacher.message}</p>}
      </div>

      <div className="flex flex-col gap-1 text-start">
        <label htmlFor="points" className="text-sm font-medium text-gray-700">
          {t('pointsLabel')}
        </label>
        <input
          id="points"
          type="number"
          min={1}
          inputMode="numeric"
          {...register('points')}
          className="rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
        />
        {errors.points && <p className="text-sm text-red-600">{errors.points.message}</p>}
      </div>

      <div className="flex flex-col gap-1 text-start">
        <DateLabel htmlFor="points-date" />
        <input
          id="points-date"
          type="date"
          {...register('date')}
          className="rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
        />
        {errors.date && <p className="text-sm text-red-600">{errors.date.message}</p>}
      </div>

      <div className="flex flex-col gap-1 text-start">
        <label htmlFor="reason" className="text-sm font-medium text-gray-700">
          {t('reasonLabel')}
        </label>
        <textarea
          id="reason"
          rows={3}
          {...register('reason')}
          className="resize-none rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
        />
        {errors.reason && <p className="text-sm text-red-600">{errors.reason.message}</p>}
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-11 rounded-md bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? t('saving') : t('logPoints')}
      </button>
    </form>
  )
}

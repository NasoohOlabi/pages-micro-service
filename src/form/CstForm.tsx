import { useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createCstSchema,
  formValuesToCstRow,
  type CstFormInput,
  type CstFormValues,
} from '../sheets/cstSchema'
import { appendCstRow } from '../sheets/cstClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { StudentAutocomplete } from './StudentAutocomplete'
import { DateLabel } from './DateLabel'
import { useLocale } from '../i18n/LocaleContext'

interface CstFormProps {
  ready: boolean
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function CstForm({ ready }: CstFormProps) {
  const { t } = useLocale()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const studentInputRef = useRef<HTMLInputElement>(null)

  const cstSchema = useMemo(() => createCstSchema(t), [t])

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CstFormInput, unknown, CstFormValues>({
    resolver: zodResolver(cstSchema),
    defaultValues: { student: '', sabr: '', mark: '', date: today() },
  })

  const onSubmit = async (values: CstFormValues) => {
    setSubmitError(null)
    setSuccessMessage(null)
    try {
      await appendCstRow(formValuesToCstRow(values))
      setSuccessMessage(t('loggedCst', { student: values.student }))
      reset({
        student: '',
        sabr: '',
        mark: '',
        date: values.date,
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
        <label htmlFor="cst-student" className="text-sm font-medium text-gray-700">
          {t('studentLabel')}
        </label>
        <Controller
          name="student"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <StudentAutocomplete
              ref={studentInputRef}
              id="cst-student"
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
        <label htmlFor="cst-sabr" className="text-sm font-medium text-gray-700">
          {t('sabrLabel')}
        </label>
        <input
          id="cst-sabr"
          type="text"
          {...register('sabr')}
          className="rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
        />
        {errors.sabr && <p className="text-sm text-red-600">{errors.sabr.message}</p>}
      </div>

      <div className="flex flex-col gap-1 text-start">
        <label htmlFor="cst-mark" className="text-sm font-medium text-gray-700">
          {t('markLabel')}
        </label>
        <input
          id="cst-mark"
          type="text"
          inputMode="decimal"
          {...register('mark')}
          className="rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
        />
        {errors.mark && <p className="text-sm text-red-600">{errors.mark.message}</p>}
      </div>

      <div className="flex flex-col gap-1 text-start">
        <DateLabel htmlFor="cst-date" />
        <input
          id="cst-date"
          type="date"
          {...register('date')}
          className="rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
        />
        {errors.date && <p className="text-sm text-red-600">{errors.date.message}</p>}
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-11 rounded-md bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? t('saving') : t('logCst')}
      </button>
    </form>
  )
}

import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { rosterQueryOptions, rosterStudents, updateStudentActive, type ActivationStudent } from '../sheets/rosterClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { useQueryState } from '../url/queryState'

export function ActivationView({ ready }: { ready: boolean }) {
  const { t } = useLocale()
  const [state, setQuery] = useQueryState()
  const query = state.tab === 'activation' ? state.q : ''
  const rosterQuery = useQuery({ ...rosterQueryOptions, enabled: ready, select: rosterStudents })
  const students = rosterQuery.data ?? null
  const mutation = useMutation({ mutationFn: updateStudentActive })
  const saving = mutation.isPending ? mutation.variables.rowNumber : null
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  async function toggle(student: ActivationStudent) {
    setError('')
    setSuccess('')
    try {
      await mutation.mutateAsync(student)
      setSuccess(t('activationSaved', { student: student.name }))
    } catch (err) {
      setError(err instanceof SheetsAccessError ? err.message : t('activationSaveError'))
    }
  }

  const matches = (students ?? []).filter((student) => student.name.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <section aria-label={t('activationTab')} className="flex w-full max-w-2xl flex-col gap-4 rounded-md border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-600">{t('activationDescription')}</p>
      <label htmlFor="activation-search" className="text-sm font-medium text-gray-700">{t('rosterSearchLabel')}</label>
      <input id="activation-search" type="search" value={query} onChange={(event) => setQuery({ q: event.target.value }, 'replace')} className="w-full rounded-md border border-gray-300 px-3 py-2" />
      {rosterQuery.error && <p role="alert" className="text-sm text-red-600">{rosterQuery.error instanceof SheetsAccessError ? rosterQuery.error.message : t('rosterLoadError')}</p>}
      {(error || rosterQuery.error) && <div className="flex items-center gap-3"><p role="alert" className="text-sm text-red-600">{error}</p><button type="button" disabled={saving !== null} onClick={() => void rosterQuery.refetch()} className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">{t('retryLoad')}</button></div>}
      {success && <p role="status" className="text-sm text-green-700">{success}</p>}
      {!students && !error && !rosterQuery.error ? <p role="status" className="text-sm text-gray-500">{t('rosterLoading')}</p> : students && (
        matches.length === 0 ? <p className="text-sm text-gray-500">{t('rosterNoMatches')}</p> :
        <ul className="divide-y divide-gray-200">{matches.map((student) => (
          <li key={student.rowNumber} className="flex items-center justify-between gap-3 py-3">
            <div><p className="font-medium text-gray-900">{student.name}</p><p className={`text-sm ${student.active ? 'text-green-700' : 'text-gray-500'}`}>{student.active ? t('studentActive') : t('studentInactive')}</p></div>
            <button type="button" role="switch" aria-checked={student.active} aria-label={`${t('studentActive')}: ${student.name}`} aria-busy={saving === student.rowNumber} disabled={saving !== null} onClick={() => void toggle(student)} className="flex min-h-11 w-14 shrink-0 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50">
              <span aria-hidden="true" dir="ltr" className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${student.active ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                <span className={`flex size-5 items-center justify-center rounded-full bg-white shadow-sm motion-safe:transition-transform ${student.active ? 'translate-x-5' : ''}`}>
                  {saving === student.rowNumber && <span className="size-3 rounded-full border-2 border-indigo-200 border-t-indigo-600 motion-safe:animate-spin" />}
                </span>
              </span>
            </button>
          </li>
        ))}</ul>
      )}
    </section>
  )
}

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchRosterSheet, type RosterSheet } from '../sheets/rosterClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { useLocale } from '../i18n/LocaleContext'
import { useQueryState } from '../url/queryState'
import { studentVisibility } from './visibility'
import { StudentFilterContext } from './StudentFilterContext'

export function StudentFilter({ children, ready }: { children: ReactNode; ready: boolean }) {
  const { t } = useLocale()
  const [state, setQuery] = useQueryState()
  const allStudents = state.allStudents ?? false
  const [roster, setRoster] = useState<RosterSheet | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setError('')
    fetchRosterSheet().then((sheet) => {
      if (!cancelled) setRoster(sheet)
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof SheetsAccessError ? err.message : t('rosterLoadError'))
    })
    return () => { cancelled = true }
  }, [ready, t, attempt])
  const visible = useMemo(() => studentVisibility(roster?.rows ?? [], roster?.nameColumnIndex ?? 0, allStudents), [roster, allStudents])
  return (
    <StudentFilterContext.Provider value={{ visible, refresh: setRoster }}>
      <button type="button" role="switch" aria-label={t('activeStudentsOnly')} aria-checked={!allStudents} onClick={() => setQuery({ allStudents: !allStudents }, 'replace')} className="fixed top-2 right-14 z-20 flex min-h-10 max-w-[calc(100vw-9rem)] items-center gap-2 rounded-md border border-indigo-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-800 shadow-sm sm:right-16 print:hidden">
        <span className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 ${allStudents ? 'bg-gray-300' : 'bg-indigo-600'}`} dir="ltr"><span className={`h-4 w-4 rounded-full bg-white transition-transform ${allStudents ? '' : 'translate-x-4'}`} /></span>
        {allStudents ? t('allStudents') : t('activeStudentsOnly')}
      </button>
      {allStudents || roster ? <div key={String(allStudents)} className="contents">{children}</div> : <div className="flex flex-col items-center gap-3">
        <p role={error ? 'alert' : 'status'} className="text-sm text-gray-600">{error || t('rosterLoading')}</p>
        {error && <button type="button" disabled={!ready} onClick={() => setAttempt((value) => value + 1)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t('retryLoad')}</button>}
      </div>}
    </StudentFilterContext.Provider>
  )
}

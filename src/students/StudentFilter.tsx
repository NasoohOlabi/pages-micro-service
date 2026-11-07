import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchRosterSheet, type RosterSheet } from '../sheets/rosterClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { useLocale } from '../i18n/LocaleContext'
import { useQueryState } from '../url/queryState'
import { studentVisibility } from './visibility'
import { StudentFilterContext } from './StudentFilterContext'

export function StudentFilter({ children }: { children: ReactNode }) {
  const { t } = useLocale()
  const [state, setQuery] = useQueryState()
  const allStudents = state.allStudents ?? false
  const [roster, setRoster] = useState<RosterSheet | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    fetchRosterSheet().then((sheet) => {
      if (!cancelled) setRoster(sheet)
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof SheetsAccessError ? err.message : t('rosterLoadError'))
    })
    return () => { cancelled = true }
  }, [t])
  const visible = useMemo(() => studentVisibility(roster?.rows ?? [], roster?.nameColumnIndex ?? 0, allStudents), [roster, allStudents])
  return (
    <StudentFilterContext.Provider value={{ visible, refresh: setRoster }}>
      <button type="button" role="switch" aria-label={t('activeStudentsOnly')} aria-checked={!allStudents} onClick={() => setQuery({ allStudents: !allStudents }, 'replace')} className="fixed top-12 left-2 z-20 flex min-h-12 items-center gap-3 rounded-lg border border-indigo-300 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 shadow-sm sm:left-4 print:hidden">
        <span className={`flex h-7 w-12 items-center rounded-full p-1 ${allStudents ? 'bg-gray-300' : 'bg-indigo-600'}`} dir="ltr"><span className={`h-5 w-5 rounded-full bg-white transition-transform ${allStudents ? '' : 'translate-x-5'}`} /></span>
        {allStudents ? t('allStudents') : t('activeStudentsOnly')}
      </button>
      {allStudents || roster ? <div key={String(allStudents)} className="contents">{children}</div> : <p role={error ? 'alert' : 'status'} className="text-sm text-gray-600">{error || t('rosterLoading')}</p>}
    </StudentFilterContext.Provider>
  )
}

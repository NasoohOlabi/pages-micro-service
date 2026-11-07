import { useQuery, useMutation } from '@tanstack/react-query'
import { useStudentFilter } from '../students/StudentFilterContext'
import { useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { rosterQueryOptions, rosterGroups, updateStudentActive, updateStudentGroup, type GroupStudent } from '../sheets/rosterClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { useQueryState } from '../url/queryState'

export function GroupView({ ready }: { ready: boolean }) {
  const visibleStudent = useStudentFilter()
  const { t } = useLocale()
  const [state, setQuery] = useQueryState()
  const group = state.tab === 'groups' ? state.group : ''
  const { data: students = null, error: loadError, refetch } = useQuery({ ...rosterQueryOptions, enabled: ready, select: rosterGroups })
  const mutation = useMutation({ mutationFn: (action: { kind: 'active'; student: GroupStudent } | { kind: 'group'; student: GroupStudent; group: string }) => action.kind === 'active' ? updateStudentActive(action.student) : updateStudentGroup(action.student, action.group) })
  const saving = mutation.isPending
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [move, setMove] = useState<{ rowNumber: number; destination: string } | null>(null)

  const groups = [...new Set((students ?? []).filter((student) => visibleStudent(student.name)).map((student) => student.group).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  if (group && !groups.includes(group)) groups.push(group)
  const members = (students ?? []).filter((student) => student.group === group && group && visibleStudent(student.name))
  const candidates = (students ?? []).filter((student) => student.group !== group && visibleStudent(student.name))
  const destinations = [...new Set((students ?? []).map((student) => student.group).filter((name) => name && name !== group))].sort((a, b) => a.localeCompare(b))

  async function changeGroup(student: GroupStudent, nextGroup: string) {
    setError('')
    setSuccess('')
    try {
      await mutation.mutateAsync({ kind: 'group', student, group: nextGroup })
      setSelected('')
      setMove(null)
    } catch (err) {
      setError(err instanceof SheetsAccessError ? err.message : t('groupSaveError'))
    }
  }

  async function toggleActive(student: GroupStudent) {
    setError('')
    setSuccess('')
    try {
      await mutation.mutateAsync({ kind: 'active', student })
      setMove(null)
      setSelected('')
      setSuccess(t('activationSaved', { student: student.name }))
    } catch (err) {
      setError(err instanceof SheetsAccessError ? err.message : t('activationSaveError'))
    }
  }

  return (
    <section className="flex w-full max-w-2xl flex-col gap-4 rounded-md border border-gray-200 bg-white p-4">
      <label htmlFor="group-select" className="text-sm font-medium text-gray-700">{t('rosterGroup')}</label>
      <select id="group-select" value={group} disabled={saving} onChange={(event) => { setQuery({ group: event.target.value }, 'replace'); setSelected(''); setMove(null) }} className="rounded-md border border-gray-300 p-2">
        <option value="">{t('groupSelect')}</option>
        {groups.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
      {loadError && <p role="alert" className="text-sm text-red-600">{loadError instanceof SheetsAccessError ? loadError.message : t('rosterLoadError')}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {success && <p role="status" className="text-sm text-green-700">{success}</p>}
      {(loadError || error) && <button type="button" disabled={saving} onClick={() => void refetch()} className="self-start rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">{t('retryLoad')}</button>}
      {!students && !error && !loadError && <p className="text-sm text-gray-500">{t('rosterLoading')}</p>}
      {students && groups.length === 0 && <p className="text-sm text-gray-500">{t('groupNoGroups')}</p>}
      {group && students && <>
        {members.length === 0 ? <p className="text-sm text-gray-500">{t('attendanceNoStudents')}</p> :
          <ul className="divide-y divide-gray-200">{members.map((student) => (
            <li key={student.rowNumber} className="py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 break-words">{student.name}</span>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label={t(student.active ? 'deactivateStudent' : 'activateStudent', { student: student.name })} title={t(student.active ? 'deactivateStudent' : 'activateStudent', { student: student.name })} disabled={saving} onClick={() => void toggleActive(student)} className={`flex size-11 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-40 ${student.active ? 'text-amber-700 hover:bg-amber-50' : 'text-green-700 hover:bg-green-50'}`}>
                    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3v9m-6.36-7.36a9 9 0 1 0 12.72 0" /></svg>
                  </button>
                  <button type="button" aria-label={t('moveStudent', { student: student.name })} title={t('moveStudent', { student: student.name })} aria-expanded={move?.rowNumber === student.rowNumber} aria-controls={`move-student-${student.rowNumber}`} disabled={saving || destinations.length === 0} onClick={() => setMove(move?.rowNumber === student.rowNumber ? null : { rowNumber: student.rowNumber, destination: '' })} className="flex size-11 items-center justify-center rounded-md text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-40">
                    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" /></svg>
                  </button>
                  <button type="button" aria-label={t('removeStudent', { student: student.name })} title={t('removeStudent', { student: student.name })} disabled={saving} onClick={() => void changeGroup(student, '')} className="flex size-11 items-center justify-center rounded-md text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-40">
                    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6" /></svg>
                  </button>
                </div>
              </div>
              {move?.rowNumber === student.rowNumber && <form id={`move-student-${student.rowNumber}`} onSubmit={(event) => { event.preventDefault(); if (move.destination && !saving) void changeGroup(student, move.destination) }} className="mt-2 flex items-center gap-1 rounded-md bg-gray-50 p-2">
                <label htmlFor={`destination-${student.rowNumber}`} className="sr-only">{t('moveToGroup')}</label>
                <select autoFocus id={`destination-${student.rowNumber}`} required value={move.destination} disabled={saving} onChange={(event) => setMove({ rowNumber: student.rowNumber, destination: event.target.value })} className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white p-2 text-sm">
                  <option value="">{t('moveToGroup')}</option>
                  {destinations.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <button type="submit" aria-label={t('confirmMove')} title={t('confirmMove')} disabled={saving || !move.destination} className="flex size-11 shrink-0 items-center justify-center rounded-md text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"><svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg></button>
                <button type="button" aria-label={t('cancelMove')} title={t('cancelMove')} disabled={saving} onClick={() => setMove(null)} className="flex size-11 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-40"><svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
              </form>}
            </li>
          ))}</ul>}
        <label htmlFor="group-student" className="text-sm font-medium text-gray-700">{t('groupAddSelect')}</label>
        <div className="flex gap-2">
          <select id="group-student" value={selected} onChange={(event) => setSelected(event.target.value)} className="min-w-0 flex-1 rounded-md border border-gray-300 p-2">
            <option value="">{candidates.length ? t('groupAddSelect') : t('groupNoCandidates')}</option>
            {candidates.map((student) => <option key={student.rowNumber} value={student.rowNumber}>{student.group ? t('groupMoveFrom', { student: student.name, group: student.group }) : student.name}</option>)}
          </select>
          <button type="button" disabled={saving || !selected} onClick={() => {
            const student = candidates.find((item) => String(item.rowNumber) === selected)
            if (student) void changeGroup(student, group)
          }} className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? t('saving') : t('groupAdd')}</button>
        </div>
      </>}
    </section>
  )
}

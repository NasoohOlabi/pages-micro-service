import { useEffect, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { fetchGroupStudents, updateStudentGroup, type GroupStudent } from '../sheets/rosterClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { useQueryState } from '../url/queryState'

export function GroupView({ ready }: { ready: boolean }) {
  const { t } = useLocale()
  const [state, setQuery] = useQueryState()
  const group = state.tab === 'groups' ? state.group : ''
  const [students, setStudents] = useState<GroupStudent[] | null>(null)
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    fetchGroupStudents().then((rows) => {
      if (!cancelled) setStudents(rows)
    }).catch((err) => {
      if (!cancelled) setError(err instanceof SheetsAccessError ? err.message : t('rosterLoadError'))
    })
    return () => { cancelled = true }
  }, [ready, t])

  const groups = [...new Set((students ?? []).map((student) => student.group).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  if (group && !groups.includes(group)) groups.push(group)
  const members = (students ?? []).filter((student) => student.group === group && group)
  const candidates = (students ?? []).filter((student) => student.group !== group)

  async function changeGroup(student: GroupStudent, nextGroup: string) {
    setSaving(true)
    setError('')
    try {
      await updateStudentGroup(student, nextGroup)
      setStudents(await fetchGroupStudents())
      setSelected('')
    } catch (err) {
      setError(err instanceof SheetsAccessError ? err.message : t('groupSaveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex w-full max-w-2xl flex-col gap-4 rounded-md border border-gray-200 bg-white p-4">
      <label htmlFor="group-select" className="text-sm font-medium text-gray-700">{t('rosterGroup')}</label>
      <select id="group-select" value={group} onChange={(event) => { setQuery({ group: event.target.value }, 'replace'); setSelected('') }} className="rounded-md border border-gray-300 p-2">
        <option value="">{t('groupSelect')}</option>
        {groups.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!students && !error && <p className="text-sm text-gray-500">{t('rosterLoading')}</p>}
      {students && groups.length === 0 && <p className="text-sm text-gray-500">{t('groupNoGroups')}</p>}
      {group && students && <>
        {members.length === 0 ? <p className="text-sm text-gray-500">{t('attendanceNoStudents')}</p> :
          <ul className="divide-y divide-gray-200">{members.map((student) => (
            <li key={student.rowNumber} className="flex items-center justify-between gap-3 py-2">
              <span>{student.name}</span>
              <button type="button" disabled={saving} onClick={() => void changeGroup(student, '')} className="rounded border border-gray-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50">{t('removeStudent', { student: student.name })}</button>
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

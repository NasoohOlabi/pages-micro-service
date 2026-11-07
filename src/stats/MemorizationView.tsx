import { useQuery } from '@tanstack/react-query'
import { memorizationQueryOptions } from '../sheets/logQueries'
import { useStudentFilter } from '../students/StudentFilterContext'
import { useMemo } from 'react'
import Fuse from 'fuse.js'
import { useLocale } from '../i18n/LocaleContext'
import { rosterQueryOptions, rosterGroups } from '../sheets/rosterClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { useQueryState } from '../url/queryState'
import { englishKeysToArabic } from '../utils/keymap'
import { buildMemorizationHistory, surahsForPages } from './memorization'

export function MemorizationView({ ready }: { ready: boolean }) {
  const visibleStudent = useStudentFilter()
  const { t } = useLocale()
  const [state, setQuery] = useQueryState()
  const query = state.tab === 'memorization' ? state.q : ''
  const group = state.tab === 'memorization' ? state.group : ''
  const rosterQuery = useQuery({ ...rosterQueryOptions, enabled: ready, select: rosterGroups })
  const pagesQuery = useQuery({ ...memorizationQueryOptions, enabled: ready })
  const roster = rosterQuery.data ?? null
  const rows = pagesQuery.data ?? null
  const rosterError = rosterQuery.error ? rosterQuery.error instanceof SheetsAccessError ? rosterQuery.error.message : t('rosterLoadError') : null
  const error = pagesQuery.error ? pagesQuery.error instanceof SheetsAccessError ? pagesQuery.error.message : t('statsLoadError') : null

  const history = useMemo(() => buildMemorizationHistory((rows ?? []).filter((row) => visibleStudent(row.student))), [rows, visibleStudent])
  const groups = useMemo(() => [...new Set((roster ?? []).map((student) => visibleStudent(student.name) ? student.group : '').filter(Boolean))].sort((a, b) => a.localeCompare(b)), [roster, visibleStudent])
  const filteredHistory = useMemo(() => {
    if (!group) return history
    const names = new Set((roster ?? []).filter((student) => student.group === group).map((student) => student.name.toLowerCase()))
    return history.filter((student) => names.has(student.student.trim().toLowerCase()))
  }, [group, history, roster])
  const fuse = useMemo(() => new Fuse(filteredHistory, {
    keys: ['student'], threshold: 0.4, ignoreLocation: true,
  }), [filteredHistory])
  const matches = useMemo(() => {
    const search = query.trim()
    if (!search) return filteredHistory
    const keys = new Set([search, englishKeysToArabic(search)])
    const results = new Map<string, (typeof history)[number]>()
    for (const key of keys) {
      for (const { item } of fuse.search(key)) results.set(item.student, item)
    }
    return [...results.values()]
  }, [fuse, filteredHistory, query])

  return (
    <section className="w-full max-w-4xl space-y-4" aria-label={t('memorizationTab')}>
      <p className="text-sm text-gray-600">{t('memorizationDescription')}</p>
      <div>
        <label htmlFor="memorization-search" className="mb-1 block text-sm font-medium text-gray-700">
          {t('rosterSearchLabel')}
        </label>
        <input
          id="memorization-search"
          type="search"
          value={query}
          onChange={(event) => setQuery({ q: event.target.value }, 'replace')}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="memorization-group" className="mb-1 block text-sm font-medium text-gray-700">{t('rosterGroup')}</label>
        <select id="memorization-group" value={group} onChange={(event) => setQuery({ group: event.target.value }, 'replace')} disabled={!roster} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2">
          <option value="">{t('memorizationAllGroups')}</option>
          {group && !groups.includes(group) && <option value={group}>{group}</option>}
          {groups.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        {rosterError && <p role="alert" className="mt-1 text-sm text-red-600">{rosterError}</p>}
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p>
        : rows === null || (group && !roster && !rosterError) ? <p role="status" className="text-sm text-gray-500">{t('memorizationLoading')}</p>
          : group && !roster ? null
          : matches.length === 0 ? <p className="text-sm text-gray-500">{t('rosterNoMatches')}</p>
            : matches.map((student) => (
              <details key={student.student} className="rounded-lg border border-gray-200 bg-white">
                <summary className="cursor-pointer rounded-lg px-4 py-3 focus-visible:outline-2 focus-visible:outline-indigo-600">
                  <span className="font-semibold text-gray-900">{student.student}</span>
                  <span className="ms-3 text-sm text-gray-500">{t('memorizationCount', { count: student.pages.length })}</span>
                  <span className="mt-2 flex flex-wrap gap-2">
                    {student.ranges.map((range) => {
                      const surahs = surahsForPages(range.start, range.end)
                      const names = surahs.length > 3
                        ? t('memorizationSurahRange', { first: surahs[0], last: surahs[surahs.length - 1] })
                        : surahs.join('، ')
                      return (
                        <span key={range.start} className="rounded bg-indigo-50 px-2 py-1 text-sm text-indigo-700">
                          {range.start === range.end
                            ? t('memorizationPage', { page: range.start })
                            : t('memorizationRange', range)}
                          <span dir="auto" className="mt-0.5 block text-xs">{names}</span>
                        </span>
                      )
                    })}
                  </span>
                </summary>
                <div className="max-h-96 overflow-auto border-t border-gray-100">
                  <table className="w-full text-start text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-gray-700">
                      <tr><th className="px-4 py-2 text-start">{t('finalsPages')}</th><th className="px-4 py-2 text-start">{t('memorizationSurahs')}</th><th className="px-4 py-2 text-start">{t('memorizationDates')}</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {student.pages.map(({ page, dates }) => (
                        <tr key={page}>
                          <td className="px-4 py-2 tabular-nums">{page}</td>
                          <td dir="auto" className="px-4 py-2">{surahsForPages(page).join('، ')}</td>
                          <td className="px-4 py-2">{dates.length ? dates.join(', ') : t('memorizationMissingDate')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
      <p className="text-xs text-gray-500">
        <a href="https://tanzil.net/docs/Quran_Metadata" target="_blank" rel="noreferrer" className="underline">
          {t('memorizationMappingSource')}
        </a>
      </p>
    </section>
  )
}

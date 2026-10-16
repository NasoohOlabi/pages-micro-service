import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import { useLocale } from '../i18n/LocaleContext'
import { fetchExistingRows, SheetsAccessError } from '../sheets/sheetsClient'
import { parseSheetRows, type SheetRowValues } from '../sheets/schema'
import { useQueryState } from '../url/queryState'
import { englishKeysToArabic } from '../utils/keymap'
import { buildMemorizationHistory } from './memorization'

export function MemorizationView({ ready }: { ready: boolean }) {
  const { t } = useLocale()
  const [state, setQuery] = useQueryState()
  const query = state.tab === 'memorization' ? state.q : ''
  const [rows, setRows] = useState<SheetRowValues[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    fetchExistingRows({ includeArchived: true })
      .then((raw) => {
        if (!cancelled) setRows(parseSheetRows(raw))
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof SheetsAccessError ? err.message : t('statsLoadError'))
      })
    return () => { cancelled = true }
  }, [ready, t])

  const history = useMemo(() => buildMemorizationHistory(rows ?? []), [rows])
  const fuse = useMemo(() => new Fuse(history, {
    keys: ['student'], threshold: 0.4, ignoreLocation: true,
  }), [history])
  const matches = useMemo(() => {
    const search = query.trim()
    if (!search) return history
    const keys = new Set([search, englishKeysToArabic(search)])
    const results = new Map<string, (typeof history)[number]>()
    for (const key of keys) {
      for (const { item } of fuse.search(key)) results.set(item.student, item)
    }
    return [...results.values()]
  }, [fuse, history, query])

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
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p>
        : rows === null ? <p role="status" className="text-sm text-gray-500">{t('memorizationLoading')}</p>
          : matches.length === 0 ? <p className="text-sm text-gray-500">{t('rosterNoMatches')}</p>
            : matches.map((student) => (
              <details key={student.student} className="rounded-lg border border-gray-200 bg-white">
                <summary className="cursor-pointer rounded-lg px-4 py-3 focus-visible:outline-2 focus-visible:outline-indigo-600">
                  <span className="font-semibold text-gray-900">{student.student}</span>
                  <span className="ms-3 text-sm text-gray-500">{t('memorizationCount', { count: student.pages.length })}</span>
                  <span className="mt-2 flex flex-wrap gap-2">
                    {student.ranges.map((range) => (
                      <span key={range.start} className="rounded bg-indigo-50 px-2 py-1 text-sm text-indigo-700">
                        {range.start === range.end
                          ? t('memorizationPage', { page: range.start })
                          : t('memorizationRange', range)}
                      </span>
                    ))}
                  </span>
                </summary>
                <div className="max-h-96 overflow-auto border-t border-gray-100">
                  <table className="w-full text-start text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-gray-700">
                      <tr><th className="px-4 py-2 text-start">{t('finalsPages')}</th><th className="px-4 py-2 text-start">{t('memorizationDates')}</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {student.pages.map(({ page, dates }) => (
                        <tr key={page}>
                          <td className="px-4 py-2 tabular-nums">{page}</td>
                          <td className="px-4 py-2">{dates.length ? dates.join(', ') : t('memorizationMissingDate')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
    </section>
  )
}

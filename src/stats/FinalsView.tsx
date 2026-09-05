import { useEffect, useMemo, useState } from 'react'
import { parseSheetRows, type SheetRowValues } from '../sheets/schema'
import { parsePointsRows, type PointsRowValues } from '../sheets/pointsSchema'
import { fetchExistingRows, SheetsAccessError } from '../sheets/sheetsClient'
import { fetchExistingPointRows } from '../sheets/pointsClient'
import { fetchRosterNames } from '../sheets/rosterClient'
import { useLocale } from '../i18n/LocaleContext'
import { computeFinalsStandings } from './finals'
import { useQueryState } from '../url/queryState'

interface FinalsViewProps {
  ready: boolean
}

function parsePageFactor(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(2)
}

export function FinalsView({ ready }: FinalsViewProps) {
  const { t } = useLocale()
  const [state, setQuery] = useQueryState()
  const pageFactor = state.tab === 'finals' ? state.factor : '1'
  const [names, setNames] = useState<string[] | null>(null)
  const [pageRows, setPageRows] = useState<SheetRowValues[] | null>(null)
  const [pointRows, setPointRows] = useState<PointsRowValues[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setIsLoading(true)
    Promise.all([fetchRosterNames(), fetchExistingRows(), fetchExistingPointRows()])
      .then(([rosterNames, rawPages, rawPoints]) => {
        if (cancelled) return
        setNames(rosterNames)
        setPageRows(parseSheetRows(rawPages))
        setPointRows(parsePointsRows(rawPoints))
        setLoadError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(
          err instanceof SheetsAccessError ? err.message : t('finalsLoadError'),
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ready, t])

  const standings = useMemo(() => {
    if (!names || !pageRows || !pointRows) return []
    return computeFinalsStandings({
      names,
      pageRows,
      pointRows,
      pageFactor: parsePageFactor(pageFactor),
    })
  }, [names, pageFactor, pageRows, pointRows])

  const totals = useMemo(
    () =>
      standings.reduce(
        (acc, row) => ({
          pages: acc.pages + row.pages,
          score: acc.score + row.score,
        }),
        { pages: 0, score: 0 },
      ),
    [standings],
  )

  const loaded = names !== null && pageRows !== null && pointRows !== null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-3 sm:p-6">
      <div className="flex flex-col gap-1 rounded-md border border-gray-200 bg-white p-3 text-start sm:max-w-xs">
        <label htmlFor="finals-page-factor" className="text-sm font-medium text-gray-700">
          {t('finalsPageFactor')}
        </label>
        <input
          id="finals-page-factor"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={pageFactor}
          onChange={(event) => setQuery({ factor: event.target.value }, 'replace')}
          className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {isLoading && <p className="text-sm text-gray-500">{t('finalsLoading')}</p>}

      {loaded && (
        <div className="max-h-[70svh] overflow-auto rounded-md border border-gray-200 bg-white">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th scope="col" className="border-b border-gray-200 px-3 py-2 text-start font-semibold text-gray-700">
                  {t('finalsRank')}
                </th>
                <th scope="col" className="border-b border-gray-200 px-3 py-2 text-start font-semibold text-gray-700">
                  {t('finalsStudentName')}
                </th>
                <th scope="col" className="border-b border-gray-200 px-3 py-2 text-end font-semibold text-gray-700">
                  {t('finalsPages')}
                </th>
                <th scope="col" className="border-b border-gray-200 px-3 py-2 text-end font-semibold text-gray-700">
                  {t('finalsScore')}
                </th>
              </tr>
            </thead>
            <tbody>
              {standings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                    {t('finalsEmpty')}
                  </td>
                </tr>
              ) : (
                standings.map((row, index) => (
                  <tr key={row.name} className="odd:bg-white even:bg-gray-50">
                    <td className="border-b border-gray-100 px-3 py-2 text-start tabular-nums text-gray-800">
                      {index + 1}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 text-start text-gray-800">
                      {row.name}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 text-end tabular-nums text-gray-800">
                      {row.pages}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 text-end tabular-nums font-medium text-gray-900">
                      {formatScore(row.score)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {standings.length > 0 && (
              <tfoot className="sticky bottom-0 bg-gray-50">
                <tr>
                  <td className="border-t border-gray-200 px-3 py-2" />
                  <td className="border-t border-gray-200 px-3 py-2 text-start font-semibold text-gray-900">
                    {t('finalsTotal')}
                  </td>
                  <td className="border-t border-gray-200 px-3 py-2 text-end tabular-nums font-semibold text-gray-900">
                    {totals.pages}
                  </td>
                  <td className="border-t border-gray-200 px-3 py-2 text-end tabular-nums font-semibold text-gray-900">
                    {formatScore(totals.score)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

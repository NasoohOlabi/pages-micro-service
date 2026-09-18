import { useEffect, useMemo, useState } from 'react'
import { parseSheetRows, type SheetRowValues } from '../sheets/schema'
import { parsePointsRows, type PointsRowValues } from '../sheets/pointsSchema'
import { parseCstRows, type CstRowValues } from '../sheets/cstSchema'
import { fetchExistingRows, SheetsAccessError } from '../sheets/sheetsClient'
import { fetchExistingPointRows } from '../sheets/pointsClient'
import { fetchExistingCstRows } from '../sheets/cstClient'
import { fetchRosterSheet, type RosterSheet } from '../sheets/rosterClient'
import { useLocale } from '../i18n/LocaleContext'
import type { TranslationKey } from '../i18n/translations'
import { localIsoDate } from './aggregations'
import { computeFinalsStandings, type FinalsStanding } from './finals'
import { useQueryState, type FinalsSort } from '../url/queryState'

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

function sortByPages(rows: FinalsStanding[]): FinalsStanding[] {
  return [...rows].sort((a, b) => b.pages - a.pages || a.name.localeCompare(b.name, 'ar'))
}

function sortByName(rows: FinalsStanding[]): FinalsStanding[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

function printPdf() {
  const previous = document.title
  document.title = `نتائج-${localIsoDate()}`
  const restore = () => {
    document.title = previous
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  window.print()
}

function totalsFor(rows: FinalsStanding[]) {
  return rows.reduce(
    (acc, row) => ({
      pages: acc.pages + row.pages,
      cst: acc.cst + row.cst,
      score: acc.score + row.score,
    }),
    { pages: 0, cst: 0, score: 0 },
  )
}

function groupTables(rows: FinalsStanding[]): { key: string; rows: FinalsStanding[] }[] {
  const groups = new Map<string, FinalsStanding[]>()
  for (const row of rows) {
    const list = groups.get(row.group)
    if (list) list.push(row)
    else groups.set(row.group, [row])
  }
  const named = [...groups.keys()]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'ar'))
    .map((key) => ({ key, rows: groups.get(key)! }))
  named.push({ key: '', rows: groups.get('') ?? [] })
  return named
}

function StandingsTable({
  rows,
  t,
  scrollable = false,
}: {
  rows: FinalsStanding[]
  t: (key: TranslationKey) => string
  scrollable?: boolean
}) {
  const totals = totalsFor(rows)
  return (
    <div
      className={
        scrollable
          ? 'max-h-[70svh] overflow-auto rounded-md border border-gray-200 bg-white'
          : 'overflow-visible'
      }
    >
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead className={scrollable ? 'sticky top-0 bg-gray-50' : 'bg-gray-50'}>
          <tr>
            <th scope="col" className="border-b border-gray-200 px-3 py-2 text-start font-semibold text-gray-700">
              {t('finalsRank')}
            </th>
            <th scope="col" className="border-b border-gray-200 px-3 py-2 text-start font-semibold text-gray-700">
              {t('finalsStudentName')}
            </th>
            <th scope="col" className="border-b border-gray-200 px-3 py-2 text-start font-semibold text-gray-700">
              {t('rosterGroup')}
            </th>
            <th scope="col" className="border-b border-gray-200 px-3 py-2 text-end font-semibold text-gray-700">
              {t('finalsPages')}
            </th>
            <th scope="col" className="border-b border-gray-200 px-3 py-2 text-end font-semibold text-gray-700">
              {t('sabrLabel')}
            </th>
            <th scope="col" className="border-b border-gray-200 px-3 py-2 text-end font-semibold text-gray-700">
              {t('finalsScore')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                {t('finalsEmpty')}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.name} className="odd:bg-white even:bg-gray-50">
                <td className="border-b border-gray-100 px-3 py-2 text-start tabular-nums text-gray-800">
                  {index + 1}
                </td>
                <td className="border-b border-gray-100 px-3 py-2 text-start text-gray-800">
                  {row.name}
                </td>
                <td className="border-b border-gray-100 px-3 py-2 text-start text-gray-800">
                  {row.group || '-'}
                </td>
                <td className="border-b border-gray-100 px-3 py-2 text-end tabular-nums text-gray-800">
                  {row.pages}
                </td>
                <td className="border-b border-gray-100 px-3 py-2 text-end tabular-nums text-gray-800">
                  {row.cst}
                </td>
                <td className="border-b border-gray-100 px-3 py-2 text-end tabular-nums font-medium text-gray-900">
                  {formatScore(row.score)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot className={scrollable ? 'sticky bottom-0 bg-gray-50' : 'bg-gray-50'}>
            <tr>
              <td className="border-t border-gray-200 px-3 py-2" />
              <td className="border-t border-gray-200 px-3 py-2 text-start font-semibold text-gray-900">
                {t('finalsTotal')}
              </td>
              <td className="border-t border-gray-200 px-3 py-2" />
              <td className="border-t border-gray-200 px-3 py-2 text-end tabular-nums font-semibold text-gray-900">
                {totals.pages}
              </td>
              <td className="border-t border-gray-200 px-3 py-2 text-end tabular-nums font-semibold text-gray-900">
                {totals.cst}
              </td>
              <td className="border-t border-gray-200 px-3 py-2 text-end tabular-nums font-semibold text-gray-900">
                {formatScore(totals.score)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function rosterNames(sheet: RosterSheet): string[] {
  const names = sheet.rows
    .map((row) => row[sheet.nameColumnIndex]?.trim())
    .filter((name): name is string => Boolean(name))
  return Array.from(new Set(names))
}

function rosterGroups(sheet: RosterSheet): Map<string, string> {
  const headerIndex = sheet.headers.findIndex((header) => header === 'الحلقة')
  const groupIndex = headerIndex === -1 ? 7 : headerIndex
  const groups = new Map<string, string>()
  for (const row of sheet.rows) {
    const name = row[sheet.nameColumnIndex]?.trim()
    if (!name) continue
    groups.set(name.toLowerCase(), row[groupIndex]?.trim() ?? '')
  }
  return groups
}

export function FinalsView({ ready }: FinalsViewProps) {
  const { t } = useLocale()
  const [state, setQuery] = useQueryState()
  const pageFactor = state.tab === 'finals' ? state.factor : '10'
  const cstFactor = state.tab === 'finals' ? state.cst : '300'
  const sort: FinalsSort = state.tab === 'finals' ? state.sort : 'score'
  const [roster, setRoster] = useState<RosterSheet | null>(null)
  const [pageRows, setPageRows] = useState<SheetRowValues[] | null>(null)
  const [pointRows, setPointRows] = useState<PointsRowValues[] | null>(null)
  const [cstRows, setCstRows] = useState<CstRowValues[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setIsLoading(true)
    Promise.all([fetchRosterSheet(), fetchExistingRows(), fetchExistingPointRows(), fetchExistingCstRows()])
      .then(([sheet, rawPages, rawPoints, rawCst]) => {
        if (cancelled) return
        setRoster(sheet)
        setPageRows(parseSheetRows(rawPages))
        setPointRows(parsePointsRows(rawPoints))
        setCstRows(parseCstRows(rawCst))
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

  const scoreStandings = useMemo(() => {
    if (!roster || !pageRows || !pointRows || !cstRows) return []
    return computeFinalsStandings({
      names: rosterNames(roster),
      groups: rosterGroups(roster),
      pageRows,
      pointRows,
      cstRows,
      pageFactor: parsePageFactor(pageFactor),
      cstFactor: parsePageFactor(cstFactor),
    })
  }, [cstFactor, cstRows, pageFactor, pageRows, pointRows, roster])

  const pageStandings = useMemo(() => sortByPages(scoreStandings), [scoreStandings])
  const nameStandings = useMemo(() => sortByName(scoreStandings), [scoreStandings])
  const standings = sort === 'pages' ? pageStandings : scoreStandings
  const printSections = useMemo(
    () => [
      { id: 'finals-pages', title: t('finalsPrintByPages'), rows: pageStandings },
      { id: 'finals-score', title: t('finalsPrintByScore'), rows: scoreStandings },
      { id: 'finals-name', title: t('finalsPrintByName'), rows: nameStandings },
      ...groupTables(scoreStandings).map((group, index) => ({
        id: `finals-group-${index}`,
        title: group.key || t('finalsUnknownGroup'),
        rows: group.rows,
      })),
    ],
    [nameStandings, pageStandings, scoreStandings, t],
  )

  const loaded = roster !== null && pageRows !== null && pointRows !== null && cstRows !== null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-3 sm:p-6 print:max-w-none print:gap-2 print:p-0">
      <div className="hidden text-start print:block">
        <h1 className="text-xl font-semibold text-gray-900">
          {t('appTitle')} — {t('finalsTab')}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t('finalsPageFactor')}: {pageFactor}
          {' · '}
          {t('finalsCstFactor')}: {cstFactor}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 print:hidden">
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
        <div className="flex flex-col gap-1 rounded-md border border-gray-200 bg-white p-3 text-start sm:max-w-xs">
          <label htmlFor="finals-cst-factor" className="text-sm font-medium text-gray-700">
            {t('finalsCstFactor')}
          </label>
          <input
            id="finals-cst-factor"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={cstFactor}
            onChange={(event) => setQuery({ cst: event.target.value }, 'replace')}
            className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1 rounded-md border border-gray-200 bg-white p-3 text-start">
          <span className="text-sm font-medium text-gray-700">{t('finalsSort')}</span>
          <div className="grid grid-cols-2 gap-1">
            {(['score', 'pages'] as const).map((nextSort) => (
              <button
                key={nextSort}
                type="button"
                onClick={() => setQuery({ sort: nextSort }, 'replace')}
                aria-pressed={sort === nextSort}
                className={`min-h-10 rounded px-3 text-sm font-semibold ${
                  sort === nextSort ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t(nextSort === 'score' ? 'finalsScore' : 'finalsPages')}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={printPdf}
          disabled={!loaded || standings.length === 0}
          className="min-h-10 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:hover:bg-gray-300"
        >
          {t('finalsExportPdf')}
        </button>
      </div>

      {loadError && <p className="text-sm text-red-600 print:hidden">{loadError}</p>}
      {isLoading && <p className="text-sm text-gray-500 print:hidden">{t('finalsLoading')}</p>}

      {loaded && (
        <>
          <div className="print:hidden">
            <StandingsTable rows={standings} t={t} scrollable />
          </div>
          <div className="hidden print:block">
            <nav>
              <h2 className="mb-2 text-base font-semibold text-gray-900">{t('finalsPrintToc')}</h2>
              <ol className="list-decimal ps-6 text-sm">
                {printSections.map((section) => (
                  <li key={section.id} className="py-0.5">
                    <a href={`#${section.id}`} className="text-indigo-700 underline">
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            {printSections.map((section) => (
              <section id={section.id} key={section.id} className="print:break-before-page">
                <h2 className="mb-2 text-base font-semibold text-gray-900">{section.title}</h2>
                <StandingsTable rows={section.rows} t={t} />
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

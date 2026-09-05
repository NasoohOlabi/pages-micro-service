import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { parseSheetRows, type SheetRowValues } from '../sheets/schema'
import { fetchExistingRows, SheetsAccessError } from '../sheets/sheetsClient'
import { useLocale } from '../i18n/LocaleContext'
import type { Locale, TranslationKey } from '../i18n/translations'
import {
  buildTimeSeries,
  countByField,
  countByPage,
  countPagesInCurrentWeek,
  filterRows,
  juzPageRanges,
  localIsoDate,
  QURAN_PAGES,
  startOfIsoWeek,
  startOfMonth,
  uniqueStudentNames,
  type NamedCount,
  type TimeSeries,
} from './aggregations'

interface PagesStatsProps {
  ready: boolean
}

type StatsView = 'students' | 'time' | 'teachers' | 'coverage'
type DatePreset = 'week' | 'month' | 'all'

const LIST_CAP = 20
const JUZ_RANGES = juzPageRanges()

const VIEW_KEYS: Record<StatsView, TranslationKey> = {
  students: 'statsViewStudents',
  time: 'statsViewTime',
  teachers: 'statsViewTeachers',
  coverage: 'statsViewCoverage',
}

function isStatsView(value: string | null): value is StatsView {
  return value === 'students' || value === 'time' || value === 'teachers' || value === 'coverage'
}

function readViewFromUrl(): StatsView {
  const view = new URLSearchParams(window.location.search).get('view')
  return isStatsView(view) ? view : 'students'
}

function rangeForPreset(preset: DatePreset, today = localIsoDate()): { from: string | null; to: string | null } {
  if (preset === 'week') return { from: startOfIsoWeek(today), to: today }
  if (preset === 'month') return { from: startOfMonth(today), to: today }
  return { from: null, to: null }
}

function matchingPreset(from: string | null, to: string | null): DatePreset | 'custom' {
  const today = localIsoDate()
  const week = rangeForPreset('week', today)
  const month = rangeForPreset('month', today)
  if (!from && !to) return 'all'
  if (from === week.from && to === week.to) return 'week'
  if (from === month.from && to === month.to) return 'month'
  return 'custom'
}

function formatIsoDate(iso: string, locale: Locale): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(locale === 'ar' ? 'ar' : 'en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function PagesStats({ ready }: PagesStatsProps) {
  const { locale, t } = useLocale()
  const [view, setView] = useState<StatsView>(readViewFromUrl)
  const [from, setFrom] = useState<string | null>(() => rangeForPreset('month').from)
  const [to, setTo] = useState<string | null>(() => rangeForPreset('month').to)
  const [student, setStudent] = useState('')
  const [rows, setRows] = useState<SheetRowValues[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.get('view')) {
      url.searchParams.set('view', 'students')
      window.history.replaceState(null, '', url)
    }
    const handlePopState = () => setView(readViewFromUrl())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setIsLoading(true)
    fetchExistingRows()
      .then((raw) => {
        if (cancelled) return
        setRows(parseSheetRows(raw))
        setLoadError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(
          err instanceof SheetsAccessError ? err.message : t('statsLoadError'),
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ready, t])

  const studentOptions = useMemo(() => (rows ? uniqueStudentNames(rows) : []), [rows])

  const filtered = useMemo(() => {
    if (!rows) return []
    return filterRows(rows, {
      from,
      to,
      student: student || null,
    })
  }, [from, rows, student, to])

  const pageCounts = useMemo(() => countByPage(filtered), [filtered])
  const studentCounts = useMemo(() => countByField(filtered, 'student'), [filtered])
  const teacherCounts = useMemo(() => countByField(filtered, 'teacher'), [filtered])
  const timeSeries = useMemo(() => buildTimeSeries(filtered, { from, to }), [filtered, from, to])
  const uniqueStudents = useMemo(() => uniqueStudentNames(filtered).length, [filtered])
  const pagesThisWeek = useMemo(() => countPagesInCurrentWeek(filtered), [filtered])
  const activePreset = matchingPreset(from, to)

  useEffect(() => {
    setShowAll(false)
  }, [student, from, to, view])

  useEffect(() => {
    setSelectedBucket((current) => {
      if (current && timeSeries.buckets.some((bucket) => bucket.key === current)) return current
      const lastWithCount = [...timeSeries.buckets].reverse().find((bucket) => bucket.count > 0)
      return lastWithCount?.key ?? timeSeries.buckets.at(-1)?.key ?? null
    })
  }, [timeSeries])

  const selectView = (nextView: StatsView) => {
    const url = new URL(window.location.href)
    url.searchParams.set('view', nextView)
    window.history.pushState(null, '', url)
    setView(nextView)
  }

  const applyPreset = (preset: DatePreset) => {
    const range = rangeForPreset(preset)
    setFrom(range.from)
    setTo(range.to)
  }

  const selectedTime = timeSeries.buckets.find((bucket) => bucket.key === selectedBucket)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-3 sm:p-6">
      <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap gap-1">
          {(['week', 'month', 'all'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`min-h-10 rounded-md px-3 text-sm font-semibold ${
                activePreset === preset
                  ? 'bg-indigo-600 text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {preset === 'week'
                ? t('statsThisWeek')
                : preset === 'month'
                  ? t('statsThisMonth')
                  : t('statsAllTime')}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1 text-start">
            <label htmlFor="stats-from" className="text-sm font-medium text-gray-700">
              {t('statsFrom')}
            </label>
            <input
              id="stats-from"
              type="date"
              value={from ?? ''}
              max={to ?? undefined}
              onChange={(event) => setFrom(event.target.value || null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1 text-start">
            <label htmlFor="stats-to" className="text-sm font-medium text-gray-700">
              {t('statsTo')}
            </label>
            <input
              id="stats-to"
              type="date"
              value={to ?? ''}
              min={from ?? undefined}
              onChange={(event) => setTo(event.target.value || null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1 text-start">
            <label htmlFor="stats-student" className="text-sm font-medium text-gray-700">
              {t('studentLabel')}
            </label>
            <select
              id="stats-student"
              value={student}
              onChange={(event) => setStudent(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none"
            >
              <option value="">{t('statsAllStudents')}</option>
              {studentOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {isLoading && <p className="text-sm text-gray-500">{t('statsLoading')}</p>}

      {rows && (
        <>
          <div className={`grid gap-3 ${student ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
            <KpiCard label={t('statsTotalPages')} value={filtered.length} />
            <KpiCard
              label={t('statsUniquePages')}
              value={<span dir="ltr">{pageCounts.size} / {QURAN_PAGES}</span>}
            />
            {!student && <KpiCard label={t('statsUniqueStudents')} value={uniqueStudents} />}
            <KpiCard label={t('statsPagesThisWeek')} value={pagesThisWeek} />
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-md border border-gray-200 bg-white p-1 sm:grid-cols-4">
            {(['students', 'time', 'teachers', 'coverage'] as const).map((nextView) => (
              <button
                key={nextView}
                type="button"
                onClick={() => selectView(nextView)}
                aria-current={view === nextView ? 'page' : undefined}
                className={`min-h-10 rounded px-3 text-sm font-semibold ${
                  view === nextView ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t(VIEW_KEYS[nextView])}
              </button>
            ))}
          </div>

          <div className="flex min-h-64 flex-1 flex-col rounded-md border border-gray-200 bg-white p-3">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">{t('statsEmpty')}</p>
            ) : view === 'students' ? (
              <BarList
                items={studentCounts}
                showAll={showAll}
                onToggleShowAll={() => setShowAll((current) => !current)}
                showAllLabel={t('statsShowAll')}
                showLessLabel={t('statsShowLess')}
              />
            ) : view === 'teachers' ? (
              <BarList
                items={teacherCounts}
                showAll={showAll}
                onToggleShowAll={() => setShowAll((current) => !current)}
                showAllLabel={t('statsShowAll')}
                showLessLabel={t('statsShowLess')}
              />
            ) : view === 'time' ? (
              <TimeChart
                series={timeSeries}
                selectedKey={selectedBucket}
                onSelect={setSelectedBucket}
                locale={locale}
                t={t}
                selected={selectedTime}
              />
            ) : (
              <CoverageGrid counts={pageCounts} t={t} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function BarList({
  items,
  showAll,
  onToggleShowAll,
  showAllLabel,
  showLessLabel,
}: {
  items: NamedCount[]
  showAll: boolean
  onToggleShowAll: () => void
  showAllLabel: string
  showLessLabel: string
}) {
  const visible = showAll ? items : items.slice(0, LIST_CAP)
  const max = items[0]?.count ?? 0

  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {visible.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-sm text-gray-800 sm:w-40" title={item.name}>
            {item.name}
          </span>
          <div className="h-6 min-w-0 flex-1 rounded bg-gray-100">
            <div
              className="h-full rounded bg-indigo-500"
              style={{ width: max === 0 ? '0%' : `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-end text-sm font-medium text-gray-700">{item.count}</span>
        </div>
      ))}
      {items.length > LIST_CAP && (
        <button
          type="button"
          onClick={onToggleShowAll}
          className="self-start text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          {showAll ? showLessLabel : showAllLabel}
        </button>
      )}
    </div>
  )
}

function TimeChart({
  series,
  selectedKey,
  onSelect,
  locale,
  t,
  selected,
}: {
  series: TimeSeries
  selectedKey: string | null
  onSelect: (key: string) => void
  locale: Locale
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
  selected: TimeSeries['buckets'][number] | undefined
}) {
  const max = series.buckets.reduce((highest, bucket) => Math.max(highest, bucket.count), 0)
  const selectedLabel = selected
    ? series.grain === 'week'
      ? t('statsWeekOf', { date: formatIsoDate(selected.key, locale) })
      : formatIsoDate(selected.key, locale)
    : null

  if (series.buckets.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">{t('statsEmpty')}</p>
  }

  return (
    <div className="flex h-full min-h-48 flex-col gap-3">
      <div className="flex h-48 items-end gap-1 overflow-x-auto">
        {series.buckets.map((bucket) => {
          const titleLabel =
            series.grain === 'week'
              ? t('statsWeekOf', { date: formatIsoDate(bucket.key, locale) })
              : formatIsoDate(bucket.key, locale)
          const height = max === 0 ? 0 : (bucket.count / max) * 100
          const isSelected = bucket.key === selectedKey
          return (
            <button
              key={bucket.key}
              type="button"
              title={`${titleLabel}: ${bucket.count}`}
              onClick={() => onSelect(bucket.key)}
              className="flex h-full min-w-5 flex-1 flex-col justify-end sm:min-w-6"
            >
              <span
                className={`block w-full rounded-t ${isSelected ? 'bg-indigo-700' : 'bg-indigo-500'}`}
                style={{ height: `${bucket.count > 0 ? Math.max(height, 4) : 0}%` }}
              />
            </button>
          )
        })}
      </div>
      {selected && selectedLabel && (
        <p className="text-sm text-gray-700">
          {t('statsSelectedBar', { label: selectedLabel, count: selected.count })}
        </p>
      )}
    </div>
  )
}

const HEAT_LIGHT = { r: 191, g: 219, b: 254 }
const HEAT_DARK = { r: 30, g: 64, b: 175 }

function heatColor(count: number, max: number): string | undefined {
  if (count <= 0 || max <= 0) return undefined
  const t = count / max
  const r = Math.round(HEAT_LIGHT.r + (HEAT_DARK.r - HEAT_LIGHT.r) * t)
  const g = Math.round(HEAT_LIGHT.g + (HEAT_DARK.g - HEAT_LIGHT.g) * t)
  const b = Math.round(HEAT_LIGHT.b + (HEAT_DARK.b - HEAT_LIGHT.b) * t)
  return `rgb(${r} ${g} ${b})`
}

function CoverageGrid({
  counts,
  t,
}: {
  counts: Map<number, number>
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}) {
  let max = 0
  for (const count of counts.values()) {
    if (count > max) max = count
  }

  return (
    <div className="flex flex-col gap-2 overflow-auto">
      <div className="flex items-center gap-2 self-start text-xs text-gray-500">
        <span>{t('statsCoverageFew')}</span>
        <span
          className="h-2.5 w-16 rounded-sm"
          style={{
            background: `linear-gradient(to inline-end, rgb(${HEAT_LIGHT.r} ${HEAT_LIGHT.g} ${HEAT_LIGHT.b}), rgb(${HEAT_DARK.r} ${HEAT_DARK.g} ${HEAT_DARK.b}))`,
          }}
        />
        <span>{t('statsCoverageMost')}</span>
      </div>
      <div className="flex flex-col gap-1">
        {JUZ_RANGES.map((range) => (
          <div key={range.juz} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-gray-500">
              {t('statsJuz', { n: range.juz })}
            </span>
            <div className="flex flex-wrap gap-px">
              {Array.from({ length: range.end - range.start + 1 }, (_, index) => {
                const page = range.start + index
                const count = counts.get(page) ?? 0
                const color = heatColor(count, max)
                return (
                  <span
                    key={page}
                    title={t('statsCoverageCell', { page, count })}
                    className={color ? 'h-2.5 w-2.5' : 'h-2.5 w-2.5 bg-gray-200'}
                    style={color ? { backgroundColor: color } : undefined}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

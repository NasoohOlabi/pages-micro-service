import { useSyncExternalStore } from 'react'

export const APP_TABS = ['pages', 'points', 'attendance', 'students', 'finals'] as const
export type AppTab = (typeof APP_TABS)[number]

export type StatsView = 'students' | 'time' | 'teachers' | 'coverage'
export type HistoryMode = 'push' | 'replace'

export type QueryState =
  | { tab: 'pages'; sub: 'log' }
  | { tab: 'pages'; sub: 'stats'; view: StatsView; from: string | null; to: string | null; student: string }
  | { tab: 'points' }
  | { tab: 'attendance'; sub: 'student'; date: string }
  | { tab: 'attendance'; sub: 'group'; date: string; group: string }
  | { tab: 'students'; sub: 'list'; q: string }
  | { tab: 'students'; sub: 'add'; q: string }
  | { tab: 'finals'; factor: string }

export type QueryPatch = {
  tab?: AppTab
  sub?: 'log' | 'stats' | 'student' | 'group' | 'list' | 'add'
  view?: StatsView
  from?: string | null
  to?: string | null
  student?: string
  date?: string
  group?: string
  q?: string
  factor?: string
}

const DEFAULT_PAGES: QueryState = { tab: 'pages', sub: 'log' }
const STATS_VIEWS: readonly StatsView[] = ['students', 'time', 'teachers', 'coverage']

const listeners = new Set<() => void>()
let snapshot: QueryState = DEFAULT_PAGES
let didInit = false

function localIsoDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

function monthRange(today = localIsoDate()): { from: string; to: string } {
  return { from: startOfMonth(today), to: today }
}

function isStatsView(value: string | null): value is StatsView {
  return STATS_VIEWS.some((view) => view === value)
}

function parseIso(value: string | null): string | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

function defaultsFor(tab: AppTab): QueryState {
  switch (tab) {
    case 'pages':
      return DEFAULT_PAGES
    case 'points':
      return { tab: 'points' }
    case 'attendance':
      return { tab: 'attendance', sub: 'student', date: localIsoDate() }
    case 'students':
      return { tab: 'students', sub: 'list', q: '' }
    case 'finals':
      return { tab: 'finals', factor: '1' }
    default: {
      const _exhaustive: never = tab
      return _exhaustive
    }
  }
}

function pagesStatsDefaults(): QueryState {
  const month = monthRange()
  return {
    tab: 'pages',
    sub: 'stats',
    view: 'students',
    from: month.from,
    to: month.to,
    student: '',
  }
}

export function parseQueryState(search: string): QueryState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const tab = params.get('tab')
  const sub = params.get('sub')

  if (tab === 'points') return { tab: 'points' }

  if (tab === 'attendance') {
    const date = parseIso(params.get('date')) ?? localIsoDate()
    if (sub === 'group') return { tab: 'attendance', sub: 'group', date, group: params.get('group') ?? '' }
    return { tab: 'attendance', sub: 'student', date }
  }

  if (tab === 'students') {
    const q = params.get('q') ?? ''
    if (sub === 'add') return { tab: 'students', sub: 'add', q }
    return { tab: 'students', sub: 'list', q }
  }

  if (tab === 'finals') {
    const factor = params.get('factor')
    return { tab: 'finals', factor: factor ? factor : '1' }
  }

  if (sub === 'stats') {
    const month = monthRange()
    const view = params.get('view')
    return {
      tab: 'pages',
      sub: 'stats',
      view: isStatsView(view) ? view : 'students',
      from: params.has('from') ? parseIso(params.get('from')) : month.from,
      to: params.has('to') ? parseIso(params.get('to')) : month.to,
      student: params.get('student')?.trim() ?? '',
    }
  }

  return DEFAULT_PAGES
}

function currentHref(): string {
  return window.location.pathname + window.location.search
}

export function hrefFor(state: QueryState): string {
  const params = new URLSearchParams()

  if (state.tab !== 'pages') params.set('tab', state.tab)

  switch (state.tab) {
    case 'pages':
      if (state.sub === 'stats') {
        params.set('sub', 'stats')
        if (state.view !== 'students') params.set('view', state.view)
        if (state.from) params.set('from', state.from)
        if (state.to) params.set('to', state.to)
        if (state.student) params.set('student', state.student)
      }
      break
    case 'points':
      break
    case 'attendance':
      if (state.sub === 'group') {
        params.set('sub', 'group')
        if (state.group) params.set('group', state.group)
      }
      if (state.date !== localIsoDate()) params.set('date', state.date)
      break
    case 'students':
      if (state.sub === 'add') params.set('sub', 'add')
      if (state.q) params.set('q', state.q)
      break
    case 'finals':
      if (state.factor !== '1') params.set('factor', state.factor)
      break
    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }

  const qs = params.toString()
  return qs ? `${window.location.pathname}?${qs}` : window.location.pathname
}

function withSub(state: QueryState, sub: QueryPatch['sub']): QueryState {
  if (!sub) return state

  if (state.tab === 'pages') {
    if (sub === 'stats') return state.sub === 'stats' ? state : pagesStatsDefaults()
    if (sub === 'log') return DEFAULT_PAGES
    return state
  }

  if (state.tab === 'attendance') {
    const date = state.date
    if (sub === 'group') {
      const group = state.sub === 'group' ? state.group : ''
      return { tab: 'attendance', sub: 'group', date, group }
    }
    if (sub === 'student') return { tab: 'attendance', sub: 'student', date }
    return state
  }

  if (state.tab === 'students') {
    const q = state.q
    if (sub === 'add') return { tab: 'students', sub: 'add', q }
    if (sub === 'list') return { tab: 'students', sub: 'list', q }
    return state
  }

  return state
}

function withFields(state: QueryState, patch: QueryPatch): QueryState {
  if (state.tab === 'pages' && state.sub === 'stats') {
    return {
      ...state,
      view: patch.view ?? state.view,
      from: patch.from !== undefined ? patch.from : state.from,
      to: patch.to !== undefined ? patch.to : state.to,
      student: patch.student ?? state.student,
    }
  }

  if (state.tab === 'attendance') {
    const date = patch.date ?? state.date
    if (state.sub === 'group') {
      return { tab: 'attendance', sub: 'group', date, group: patch.group ?? state.group }
    }
    return { tab: 'attendance', sub: 'student', date }
  }

  if (state.tab === 'students') {
    return { ...state, q: patch.q ?? state.q }
  }

  if (state.tab === 'finals') {
    return { tab: 'finals', factor: patch.factor ?? state.factor }
  }

  return state
}

function applyPatch(current: QueryState, patch: QueryPatch): QueryState {
  let next = current
  if (patch.tab !== undefined && patch.tab !== current.tab) {
    next = defaultsFor(patch.tab)
  }
  if (patch.sub !== undefined) {
    next = withSub(next, patch.sub)
  }
  return withFields(next, patch)
}

function emit(next: QueryState) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

function onPopState() {
  emit(parseQueryState(window.location.search))
}

function materializeStatsRange() {
  if (snapshot.tab !== 'pages' || snapshot.sub !== 'stats') return
  const params = new URLSearchParams(window.location.search)
  if (params.has('from') || params.has('to')) return
  const href = hrefFor(snapshot)
  if (href !== currentHref()) window.history.replaceState(null, '', href)
}

function initFromLocation() {
  if (didInit) return
  didInit = true
  snapshot = parseQueryState(window.location.search)
  materializeStatsRange()
}

function subscribe(onStoreChange: () => void) {
  initFromLocation()
  listeners.add(onStoreChange)
  if (listeners.size === 1) window.addEventListener('popstate', onPopState)
  return () => {
    listeners.delete(onStoreChange)
    if (listeners.size === 0) window.removeEventListener('popstate', onPopState)
  }
}

function getSnapshot() {
  initFromLocation()
  return snapshot
}

function getServerSnapshot() {
  return DEFAULT_PAGES
}

export function setQuery(patch: QueryPatch, history: HistoryMode = 'replace') {
  initFromLocation()
  const next = applyPatch(snapshot, patch)
  const href = hrefFor(next)
  if (href !== currentHref()) {
    if (history === 'push') window.history.pushState(null, '', href)
    else window.history.replaceState(null, '', href)
  }
  emit(next)
}

export function useQueryState(): [QueryState, typeof setQuery] {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return [state, setQuery]
}

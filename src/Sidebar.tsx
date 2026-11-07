import { useState } from 'react'
import { useLocale } from './i18n/LocaleContext'
import type { TranslationKey } from './i18n/translations'
import { APP_TABS, type AppTab, useQueryState } from './url/queryState'

export const TAB_LABELS = {
  pages: 'pagesTab',
  memorization: 'memorizationTab',
  points: 'pointsTab',
  cst: 'cstTab',
  attendance: 'attendanceTab',
  students: 'studentsTab',
  finals: 'finalsTab',
  groups: 'groupsTab',
  activation: 'activationTab',
} as const satisfies Record<AppTab, TranslationKey>

export function Sidebar() {
  const { t } = useLocale()
  const [state, setQuery] = useQueryState()
  const [open, setOpen] = useState(false)
  return (
    <aside className="w-full shrink-0 self-start rounded-lg border border-gray-200 bg-white lg:sticky lg:top-28 lg:w-52 print:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-4 lg:border-b lg:border-gray-100">
        <p className="font-semibold text-indigo-900">{t('appTitle')}</p>
        <button type="button" aria-expanded={open} aria-controls="sidebar-navigation" onClick={() => setOpen((value) => !value)} className="flex min-h-10 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 lg:hidden">
          <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={open ? 'M6 6l12 12M6 18L18 6' : 'M4 6h16M4 12h16M4 18h16'} /></svg>
          {t('navigation')}
        </button>
      </div>
      <nav id="sidebar-navigation" aria-label={t('navigation')} className={`${open ? 'block' : 'hidden'} space-y-1 border-t border-gray-100 p-2 lg:block lg:max-h-[calc(100svh-12rem)] lg:overflow-y-auto lg:border-t-0`}>
        {APP_TABS.map((tab) => (
          <button key={tab} type="button" aria-current={state.tab === tab ? 'page' : undefined} onClick={() => { setQuery({ tab }, 'push'); setOpen(false) }} className={`flex min-h-12 w-full items-center rounded-md border-s-4 px-4 py-3 text-start text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${state.tab === tab ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            {t(TAB_LABELS[tab])}
          </button>
        ))}
      </nav>
    </aside>
  )
}

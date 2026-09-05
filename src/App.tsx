import { useEffect, useState } from 'react'
import { useGoogleAuth } from './auth/useGoogleAuth'
import { SignInButton } from './auth/SignInButton'
import { PagesTab } from './form/PagesTab'
import { PointsForm } from './form/PointsForm'
import { AttendanceForm } from './form/AttendanceForm'
import { RosterView } from './form/RosterView'
import { FinalsView } from './stats/FinalsView'
import { LanguageSwitcher } from './i18n/LanguageSwitcher'
import { UserMenu } from './auth/UserMenu'
import { useLocale } from './i18n/LocaleContext'
import type { TranslationKey } from './i18n/translations'
import { PwaUpdateToast } from './PwaUpdateToast'

const APP_TABS = ['pages', 'points', 'attendance', 'students', 'finals'] as const
type AppTab = (typeof APP_TABS)[number]

const TAB_LABELS = {
  pages: 'pagesTab',
  points: 'pointsTab',
  attendance: 'attendanceTab',
  students: 'studentsTab',
  finals: 'finalsTab',
} as const satisfies Record<AppTab, TranslationKey>

function isAppTab(value: string | null): value is AppTab {
  return APP_TABS.some((tab) => tab === value)
}

function readTabFromUrl(): AppTab {
  const tab = new URLSearchParams(window.location.search).get('tab')
  return isAppTab(tab) ? tab : 'pages'
}

function App() {
  const { ready, user, accessToken, error, signIn, signOut } = useGoogleAuth()
  const { t } = useLocale()
  const [activeTab, setActiveTab] = useState<AppTab>(readTabFromUrl)

  useEffect(() => {
    const handlePopState = () => setActiveTab(readTabFromUrl())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const selectTab = (tab: AppTab) => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.pushState(null, '', url)
    setActiveTab(tab)
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-start gap-2 bg-gray-50 px-4 py-3 sm:justify-center sm:gap-6 sm:py-8">
      <LanguageSwitcher className="absolute top-2 left-2 sm:top-4 sm:left-4" />
      {user && <UserMenu user={user} onSignOut={signOut} className="absolute top-2 right-2 sm:top-4 sm:right-4" />}

      <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">{t('appTitle')}</h1>

      {error && <p className="max-w-md text-center text-sm text-red-600">{error}</p>}

      {!user ? (
        <SignInButton onClick={signIn} disabled={!ready} />
      ) : (
        <div className="flex w-full max-w-6xl flex-col items-center gap-2 sm:gap-3">
          {!accessToken ? (
            <SignInButton onClick={signIn} disabled={!ready} />
          ) : (
            <>
              <div className="grid w-full max-w-3xl grid-cols-3 gap-1 rounded-md border border-gray-200 bg-white p-1 sm:grid-cols-5">
                {APP_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => selectTab(tab)}
                    aria-current={activeTab === tab ? 'page' : undefined}
                    className={`min-h-10 rounded px-3 text-sm font-semibold ${
                      activeTab === tab
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {t(TAB_LABELS[tab])}
                  </button>
                ))}
              </div>
              {activeTab === 'pages' ? (
                <PagesTab user={user} ready={ready} />
              ) : activeTab === 'points' ? (
                <PointsForm user={user} ready={ready} />
              ) : activeTab === 'students' ? (
                <RosterView ready={ready} />
              ) : activeTab === 'finals' ? (
                <FinalsView ready={ready} />
              ) : (
                <AttendanceForm ready={ready} />
              )}
            </>
          )}
        </div>
      )}
      <PwaUpdateToast />
    </div>
  )
}

export default App
